// Canvas runtime: boots a PixiJS Application, builds the world, wires
// camera/player/NPCs/triggers/lighting/day-night/combat fx, and exposes a
// destroy() that tears it all down on Solid cleanup.
//
// WebGL fallback: Pixi v8 prefers WebGL2; we explicitly request webgl as
// the preference, which lets the renderer fall back to WebGL1 (and then
// canvas) when WebGL2 is unavailable. We also feature-detect WebGL2 up
// front so we can log a one-line warning that surfaces in the dev console
// — that warning is the contract the support team uses when triaging
// "screen is black" bug reports.

import { fixtures } from '@br/mocks';
import type { Npc } from '@br/types';
import { Application, Container } from 'pixi.js';
import { Camera } from './camera';
import { CombatFx } from './combatFx';
import { DayNight } from './dayNight';
import { LightingLayer } from './lighting';
import { NpcEntity } from './npc';
import { type Walkable, findPath } from './pathfinding';
import { PerfOverlay } from './perfOverlay';
import { Player } from './player';
import { type SpriteRegistry, loadSpriteRegistry } from './sprites';
import {
  DEFAULT_ISO,
  type TileLayer,
  buildTileLayer,
  makeIsoProjector,
  tileAtWorldPoint,
} from './tiles';
import { type TileTrigger, TriggerHost } from './triggers';

export interface CanvasRuntime {
  readonly app: Application;
  readonly events: EventTarget;
  destroy(): Promise<void>;
}

export interface MountOptions {
  readonly host: HTMLElement;
  /** Defaults to a fresh EventTarget; route layer can pass its own. */
  readonly events?: EventTarget;
  /** Force a specific GL preference for testing. */
  readonly preference?: 'webgl' | 'webgpu';
}

function detectWebGL(): 'webgl2' | 'webgl1' | 'none' {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2')) return 'webgl2';
    if (canvas.getContext('webgl') || canvas.getContext('experimental-webgl' as 'webgl')) {
      return 'webgl1';
    }
  } catch {
    /* ignore */
  }
  return 'none';
}

export async function mountCanvas(opts: MountOptions): Promise<CanvasRuntime> {
  const events = opts.events ?? new EventTarget();
  const gl = detectWebGL();
  if (gl === 'none') {
    // eslint-disable-next-line no-console
    console.warn(
      '[canvas] WebGL is unavailable; PixiJS will fall back to canvas2D and visuals will be reduced.',
    );
  } else if (gl === 'webgl1') {
    // eslint-disable-next-line no-console
    console.warn(
      '[canvas] WebGL2 unavailable; falling back to WebGL1. Some shader-based effects (planned) will degrade.',
    );
  }

  const app = new Application();
  await app.init({
    background: 0x101418,
    resizeTo: opts.host,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, globalThis.devicePixelRatio || 1),
    preference: opts.preference ?? 'webgl',
    powerPreference: 'high-performance',
  });
  opts.host.appendChild(app.canvas);
  app.canvas.style.display = 'block';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.tabIndex = 0;

  // Layer ordering: world (tiles + entities) → lighting → dayNight overlay
  // → combat fx → perf overlay. The world layer is what the camera moves;
  // the rest stay viewport-locked.
  const world = new Container();
  world.label = 'world';
  world.sortableChildren = true;
  app.stage.addChild(world);

  // Load assets.
  let registry: SpriteRegistry;
  try {
    registry = await loadSpriteRegistry();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[canvas] sprite registry load failed; continuing with primitives only.', err);
    // Build an empty registry stand-in so the rest of the boot still works.
    const { Texture } = await import('pixi.js');
    registry = {
      manifest: {
        image: '',
        size: { width: 0, height: 0 },
        tile: { isoWidth: DEFAULT_ISO.tileW, isoHeight: DEFAULT_ISO.tileH },
        frames: {},
        animations: {},
      },
      base: Texture.EMPTY,
      textures: new Map(),
      animations: new Map(),
    };
  }

  // Tile layer.
  const tileMap = fixtures.loadTileMapSosaria();
  const tileLayer = buildTileLayer(tileMap, DEFAULT_ISO);
  world.addChild(tileLayer.container);

  const project = makeIsoProjector(DEFAULT_ISO);
  const grid: Walkable = {
    width: tileLayer.map.width,
    height: tileLayer.map.height,
    isWalkable: (x, y) => tileLayer.isWalkable(x, y),
  };

  // Player.
  const playerStart = findOpenStart(tileLayer);
  const player = new Player({
    registry,
    metrics: DEFAULT_ISO,
    project,
    start: playerStart,
    speedTilesPerSec: 4,
    archetype: 'lord',
  });
  world.addChild(player.container);

  // NPCs (filter to the active region).
  const allNpcs = fixtures.loadNpcs().npcs;
  const npcs: NpcEntity[] = [];
  for (const npc of allNpcs) {
    if (npc.regionId !== tileMap.regionId) continue;
    if (!grid.isWalkable(Math.floor(npc.position.x), Math.floor(npc.position.y))) continue;
    const entity = new NpcEntity({
      npc,
      registry,
      metrics: DEFAULT_ISO,
      project,
      grid,
      onClick: (clicked) => triggerHost.fireDialog(clicked.id),
    });
    world.addChild(entity.container);
    npcs.push(entity);
  }

  // Triggers from the tile map (portalTo entries → transition triggers).
  const triggers: TileTrigger[] = [];
  for (let y = 0; y < tileMap.height; y++) {
    const row = tileMap.rows[y];
    if (!row) continue;
    for (let x = 0; x < tileMap.width; x++) {
      const tile = row[x];
      if (!tile) continue;
      if (tile.portalTo) {
        triggers.push({
          kind: 'transition',
          tile: { x, y },
          payload: { regionId: tile.portalTo },
        });
      }
    }
  }
  const triggerHost = new TriggerHost({
    target: events,
    triggers,
    npcs: allNpcs as unknown as Npc[],
  });

  // Camera.
  const camera = new Camera({
    stage: app.stage,
    app,
    world,
    bounds: tileLayer.bounds,
  });
  camera.setFollow(player.worldPosition);
  camera.centerOn(player.worldPosition.x, player.worldPosition.y);

  // Lighting + day/night + combat fx + perf overlay live above the world.
  const lighting = new LightingLayer();
  world.addChild(lighting.container);
  lighting.addLight({
    id: 'player-torch',
    x: player.worldPosition.x,
    y: player.worldPosition.y,
    radius: 140,
    intensity: 0.7,
    color: 0xffd28a,
  });

  const dayNight = new DayNight({ app });
  app.stage.addChild(dayNight.container);

  const combatFx = new CombatFx();
  world.addChild(combatFx.container);

  let perfOverlay: PerfOverlay | null = null;
  if (import.meta.env.DEV) {
    perfOverlay = new PerfOverlay(app);
    app.stage.addChild(perfOverlay.container);
  }

  // Click-to-move on the tile container.
  tileLayer.container.on('pointertap', (ev) => {
    const local = world.toLocal(ev.global);
    const tile = tileAtWorldPoint(tileLayer, local.x, local.y);
    if (!tile) return;
    if (!grid.isWalkable(tile.x, tile.y)) return;
    const path = findPath(grid, { x: player.position.gx, y: player.position.gy }, tile);
    if (path) player.moveTo(path);
  });

  // Demo: pick the nearest NPC as the combat target so floating numbers fly.
  if (npcs.length > 0) {
    const first = npcs[0];
    if (first) combatFx.setTarget(first.worldPosition);
  }

  // Per-frame tick.
  app.ticker.add((ticker) => {
    const dtSec = ticker.deltaMS / 1000;
    perfOverlay?.beginTick();

    for (const npc of npcs) npc.update(dtSec);
    player.update(dtSec);

    // Refresh follow target so the camera tracks player movement.
    if (camera.isFollowing()) {
      camera.setFollow(player.worldPosition);
    }
    camera.update(dtSec);

    // Lighting: torch follows player.
    lighting.updateLight('player-torch', {
      x: player.worldPosition.x,
      y: player.worldPosition.y,
    });

    // Triggers fire on tile changes.
    triggerHost.notify({ x: player.position.gx, y: player.position.gy });

    // Demo combat fx target tracks the first NPC's current world pos.
    if (npcs.length > 0) {
      const first = npcs[0];
      if (first) combatFx.setTarget(first.worldPosition);
    }
    dayNight.update(dtSec);
    combatFx.update(dtSec);
    perfOverlay?.endTick(dtSec);
  });

  return {
    app,
    events,
    async destroy() {
      app.ticker.stop();
      camera.destroy();
      lighting.destroy();
      dayNight.destroy();
      combatFx.destroy();
      perfOverlay?.destroy();
      app.destroy(true, { children: true, texture: false });
    },
  };
}

function findOpenStart(layer: TileLayer): { x: number; y: number } {
  // Prefer a road or plaza tile near the centre — visually obvious spawn.
  const cx = Math.floor(layer.map.width / 2);
  const cy = Math.floor(layer.map.height / 2);
  for (let r = 0; r < Math.max(layer.map.width, layer.map.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (layer.isWalkable(x, y)) return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}
