// Player avatar with idle/walk animations + tile-by-tile movement.
//
// Animations: pulled from the sprite registry's named animation tracks. The
// sprite sheet ships south-facing strips ("lord.idle" / "lord.walk"); other
// directions are best represented later when the artist provides the full
// 8-way matrix. For today, all 8 directions reuse the south frames and the
// X scale is flipped for west-facing motion so the demo at least feels
// directional.
//
// Movement: the player walks an A* path one tile at a time. moveTo() sets a
// path; the per-frame update() lerps between consecutive tile centres at
// `speed` tiles/sec and advances the animation clock.

import { AnimatedSprite, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { GridPoint } from './pathfinding';
import { type SpriteRegistry, getAnimation } from './sprites';
import type { IsoMetrics, IsoToScreen } from './tiles';

export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface PlayerOptions {
  readonly registry: SpriteRegistry;
  readonly metrics: IsoMetrics;
  readonly project: IsoToScreen;
  readonly start: GridPoint;
  readonly speedTilesPerSec?: number;
  readonly archetype?: 'lord' | 'mage';
}

export class Player {
  readonly container: Container;
  private readonly sprite: AnimatedSprite | Sprite;
  private path: readonly GridPoint[] = [];
  private pathIdx = 0;
  private gridPos: GridPoint;
  private targetWorld: { x: number; y: number };
  private currentWorld: { x: number; y: number };
  private readonly speed: number;
  private readonly project: IsoToScreen;
  private readonly metrics: IsoMetrics;
  private readonly idleFrames: readonly Texture[];
  private readonly walkFrames: readonly Texture[];
  private direction: Direction = 's';
  private moving = false;

  constructor(opts: PlayerOptions) {
    this.metrics = opts.metrics;
    this.project = opts.project;
    this.gridPos = { x: opts.start.x, y: opts.start.y };
    this.speed = opts.speedTilesPerSec ?? 3;

    const archetype = opts.archetype ?? 'lord';
    this.idleFrames = getAnimation(opts.registry, `${archetype}.idle`);
    this.walkFrames = getAnimation(opts.registry, `${archetype}.walk`);

    this.container = new Container();
    this.container.label = 'player';

    if (this.idleFrames.length > 0) {
      const anim = new AnimatedSprite([...this.idleFrames]);
      anim.animationSpeed = 0.08;
      anim.play();
      anim.anchor.set(0.5, 0.85);
      anim.scale.set(0.55);
      this.sprite = anim;
    } else {
      // Last-ditch fallback: a coloured pawn so the player is still visible
      // when sprite manifest entries fail to resolve.
      const fallback = new Graphics();
      fallback.circle(0, -16, 10).fill({ color: 0xe6c870 });
      fallback.rect(-6, -16, 12, 18).fill({ color: 0x6a3f1f });
      const tex = opts.registry.base.source ? Sprite.from(opts.registry.base) : new Sprite();
      // Use the graphics directly via render — but Container accepts Graphics
      // as a child, so just reuse it as the sprite stand-in.
      this.container.addChild(fallback);
      this.sprite = tex;
      this.sprite.visible = false;
    }
    this.container.addChild(this.sprite);

    const start = this.project(this.gridPos.x, this.gridPos.y);
    this.currentWorld = { x: start.sx, y: start.sy };
    this.targetWorld = { ...this.currentWorld };
    this.applyTransform();
  }

  get position(): { readonly gx: number; readonly gy: number } {
    return { gx: this.gridPos.x, gy: this.gridPos.y };
  }

  get worldPosition(): { readonly x: number; readonly y: number } {
    return { x: this.currentWorld.x, y: this.currentWorld.y };
  }

  /** Replaces the active path. The first entry should be the player's current tile. */
  moveTo(path: readonly GridPoint[]): void {
    if (path.length === 0) {
      this.path = [];
      this.pathIdx = 0;
      this.moving = false;
      this.setAnimation('idle');
      return;
    }
    // Trim leading entry if it equals current tile so we don't double-step.
    const first = path[0];
    if (first && first.x === this.gridPos.x && first.y === this.gridPos.y) {
      this.path = path.slice(1);
    } else {
      this.path = path;
    }
    this.pathIdx = 0;
    this.advanceToNextWaypoint();
  }

  update(dtSec: number): void {
    if (!this.moving) return;
    const dx = this.targetWorld.x - this.currentWorld.x;
    const dy = this.targetWorld.y - this.currentWorld.y;
    const dist = Math.hypot(dx, dy);
    // One iso tile = (tileW/2, tileH/2) → a "tile" diagonal is roughly
    // tileW/2 in screen X. We measure progress in screen pixels per second.
    const pxPerSec = this.speed * (this.metrics.tileW / 2 + this.metrics.tileH / 2);
    const step = pxPerSec * dtSec;
    if (dist <= step || dist === 0) {
      this.currentWorld = { ...this.targetWorld };
      this.gridPos = this.path[this.pathIdx] ?? this.gridPos;
      this.pathIdx++;
      if (this.pathIdx > this.path.length - 1) {
        this.path = [];
        this.pathIdx = 0;
        this.moving = false;
        this.setAnimation('idle');
      } else {
        this.advanceToNextWaypoint();
      }
    } else {
      this.currentWorld.x += (dx / dist) * step;
      this.currentWorld.y += (dy / dist) * step;
    }
    this.applyTransform();
  }

  private advanceToNextWaypoint(): void {
    const next = this.path[this.pathIdx];
    if (!next) {
      this.moving = false;
      this.setAnimation('idle');
      return;
    }
    const target = this.project(next.x, next.y);
    this.targetWorld = { x: target.sx, y: target.sy };
    this.direction = directionFromDelta(next.x - this.gridPos.x, next.y - this.gridPos.y);
    this.moving = true;
    this.setAnimation('walk');
  }

  private setAnimation(kind: 'idle' | 'walk'): void {
    if (!(this.sprite instanceof AnimatedSprite)) return;
    const frames = kind === 'idle' ? this.idleFrames : this.walkFrames;
    if (frames.length === 0) return;
    this.sprite.textures = [...frames];
    this.sprite.animationSpeed = kind === 'walk' ? 0.16 : 0.08;
    this.sprite.play();
    // Mirror west-facing motion so the demo is at least directional.
    const facingWest = this.direction === 'w' || this.direction === 'nw' || this.direction === 'sw';
    const sign = facingWest ? -1 : 1;
    this.sprite.scale.x = Math.abs(this.sprite.scale.x) * sign;
  }

  private applyTransform(): void {
    this.container.x = this.currentWorld.x;
    this.container.y = this.currentWorld.y;
    // zIndex tracks isometric depth so the player paints between tile layers
    // appropriately (depth = grid x + grid y).
    this.container.zIndex = this.gridPos.x + this.gridPos.y + 0.5;
  }
}

function directionFromDelta(dx: number, dy: number): Direction {
  if (dx === 0 && dy === 0) return 's';
  if (dx > 0 && dy === 0) return 'e';
  if (dx < 0 && dy === 0) return 'w';
  if (dx === 0 && dy > 0) return 's';
  if (dx === 0 && dy < 0) return 'n';
  if (dx > 0 && dy > 0) return 'se';
  if (dx > 0 && dy < 0) return 'ne';
  if (dx < 0 && dy > 0) return 'sw';
  return 'nw';
}
