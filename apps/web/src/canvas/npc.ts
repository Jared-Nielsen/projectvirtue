// NPC sprites with idle wandering.
//
// Each NPC owns a Container parented under the world. Behaviour is the
// stupidest-possible idle: every 5–8 seconds (jittered), pick a random
// walkable tile within a 3-tile radius of the spawn and stroll there. This
// is purely visual — schedule logic per Doc #17 (NPC Schedule) is server-
// authoritative and arrives via WorldService snapshots in production.

import type { Npc } from '@br/types';
import { AnimatedSprite, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { GridPoint, Walkable } from './pathfinding';
import { findPath } from './pathfinding';
import { type SpriteRegistry, getAnimation, getTexture } from './sprites';
import type { IsoMetrics, IsoToScreen } from './tiles';

export interface NpcOptions {
  readonly npc: Npc;
  readonly registry: SpriteRegistry;
  readonly metrics: IsoMetrics;
  readonly project: IsoToScreen;
  readonly grid: Walkable;
  readonly onClick?: (npc: Npc) => void;
}

const WANDER_RADIUS = 3;
const MIN_IDLE_MS = 5000;
const MAX_IDLE_MS = 8000;

export class NpcEntity {
  readonly container: Container;
  readonly npc: Npc;
  private readonly project: IsoToScreen;
  private readonly metrics: IsoMetrics;
  private readonly grid: Walkable;
  private readonly spawn: GridPoint;
  private readonly sprite: AnimatedSprite | Sprite | Graphics;
  private readonly nameLabel: Text;
  private grid_pos: GridPoint;
  private worldX: number;
  private worldY: number;
  private targetX: number;
  private targetY: number;
  private path: readonly GridPoint[] = [];
  private pathIdx = 0;
  private moving = false;
  private idleTimer: number;
  private speedPxPerSec: number;

  constructor(opts: NpcOptions) {
    this.npc = opts.npc;
    this.project = opts.project;
    this.metrics = opts.metrics;
    this.grid = opts.grid;
    this.spawn = { x: Math.floor(opts.npc.position.x), y: Math.floor(opts.npc.position.y) };
    this.grid_pos = { ...this.spawn };
    const start = this.project(this.grid_pos.x, this.grid_pos.y);
    this.worldX = start.sx;
    this.worldY = start.sy;
    this.targetX = start.sx;
    this.targetY = start.sy;
    this.idleTimer = randInt(MIN_IDLE_MS, MAX_IDLE_MS);
    this.speedPxPerSec = 1.5 * (this.metrics.tileW / 2 + this.metrics.tileH / 2);

    this.container = new Container();
    this.container.label = `npc:${opts.npc.id}`;
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    // Pick an animation track based on disposition. Friendly NPCs reuse the
    // mage idle; hostile ones use the lord idle so they look distinct.
    const trackKey = opts.npc.disposition === 'hostile' ? 'lord.idle' : 'mage.idle';
    const frames = getAnimation(opts.registry, trackKey);
    if (frames.length > 0) {
      const anim = new AnimatedSprite([...frames]);
      anim.animationSpeed = 0.06;
      anim.play();
      anim.anchor.set(0.5, 0.85);
      anim.scale.set(0.5);
      this.sprite = anim;
    } else {
      const fallbackKey = opts.npc.disposition === 'hostile' ? 'dir.s' : 'dir.s';
      const tex = getTexture(opts.registry, fallbackKey);
      if (tex) {
        const sp = new Sprite(tex);
        sp.anchor.set(0.5, 0.85);
        this.sprite = sp;
      } else {
        const g = new Graphics();
        const tint = opts.npc.disposition === 'hostile' ? 0xa83232 : 0x2a86c8;
        g.circle(0, -20, 8).fill({ color: 0xf0d6a8 });
        g.rect(-7, -16, 14, 22).fill({ color: tint });
        this.sprite = g;
      }
    }
    this.container.addChild(this.sprite);

    this.nameLabel = new Text({
      text: opts.npc.name,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = -54;
    this.nameLabel.visible = false;
    this.container.addChild(this.nameLabel);

    if (opts.onClick) {
      this.container.on('pointertap', () => opts.onClick?.(opts.npc));
    }
    this.container.on('pointerover', () => {
      this.nameLabel.visible = true;
    });
    this.container.on('pointerout', () => {
      this.nameLabel.visible = false;
    });

    this.applyTransform();
  }

  get position(): { readonly gx: number; readonly gy: number } {
    return { gx: this.grid_pos.x, gy: this.grid_pos.y };
  }

  get worldPosition(): { readonly x: number; readonly y: number } {
    return { x: this.worldX, y: this.worldY };
  }

  update(dtSec: number): void {
    if (!this.moving) {
      this.idleTimer -= dtSec * 1000;
      if (this.idleTimer <= 0) {
        this.startWander();
        this.idleTimer = randInt(MIN_IDLE_MS, MAX_IDLE_MS);
      }
      return;
    }
    const dx = this.targetX - this.worldX;
    const dy = this.targetY - this.worldY;
    const dist = Math.hypot(dx, dy);
    const step = this.speedPxPerSec * dtSec;
    if (dist <= step || dist === 0) {
      this.worldX = this.targetX;
      this.worldY = this.targetY;
      this.grid_pos = this.path[this.pathIdx] ?? this.grid_pos;
      this.pathIdx++;
      if (this.pathIdx > this.path.length - 1) {
        this.path = [];
        this.pathIdx = 0;
        this.moving = false;
      } else {
        const next = this.path[this.pathIdx];
        if (next) {
          const t = this.project(next.x, next.y);
          this.targetX = t.sx;
          this.targetY = t.sy;
        }
      }
    } else {
      this.worldX += (dx / dist) * step;
      this.worldY += (dy / dist) * step;
    }
    this.applyTransform();
  }

  private startWander(): void {
    // Pick a candidate tile within radius; up to 8 tries before giving up
    // (NPC stays put if the surrounding tiles are all blocked).
    for (let attempt = 0; attempt < 8; attempt++) {
      const dx = randInt(-WANDER_RADIUS, WANDER_RADIUS);
      const dy = randInt(-WANDER_RADIUS, WANDER_RADIUS);
      const tx = this.spawn.x + dx;
      const ty = this.spawn.y + dy;
      if (tx === this.grid_pos.x && ty === this.grid_pos.y) continue;
      if (!this.grid.isWalkable(tx, ty)) continue;
      const path = findPath(this.grid, this.grid_pos, { x: tx, y: ty }, 2000);
      if (!path || path.length < 2) continue;
      this.path = path.slice(1);
      this.pathIdx = 0;
      const next = this.path[0];
      if (!next) return;
      const t = this.project(next.x, next.y);
      this.targetX = t.sx;
      this.targetY = t.sy;
      this.moving = true;
      return;
    }
  }

  private applyTransform(): void {
    this.container.x = this.worldX;
    this.container.y = this.worldY;
    this.container.zIndex = this.grid_pos.x + this.grid_pos.y + 0.4;
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
