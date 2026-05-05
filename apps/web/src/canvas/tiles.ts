// Isometric tile renderer.
//
// Projection: a standard 2:1 diamond. World tile (gx, gy) maps to:
//   sx = (gx - gy) * (TILE_W / 2)
//   sy = (gx + gy) * (TILE_H / 2)
//
// Z-sort: by (gx + gy) — deeper tiles paint first so foreground decor occludes
// background. Pixi's sortableChildren is enabled on the tile container; each
// tile sets its own zIndex using that depth metric.
//
// Tile graphics: the source SpriteSheet.png does NOT include iso ground
// tiles, so tile bodies are drawn as colour-filled diamonds via Graphics.
// Decor sprites (trees, buildings) are also primitive shapes for now —
// future content packs swap to authored art via the sprite registry.

import type { Tile, TileMap, TileType } from '@br/types';
import { Container, Graphics } from 'pixi.js';

export interface IsoMetrics {
  readonly tileW: number;
  readonly tileH: number;
}

export const DEFAULT_ISO: IsoMetrics = { tileW: 64, tileH: 32 };

export interface TileWorldRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4f7a3a,
  forest: 0x2f5a2a,
  water: 0x2a4d8a,
  mountain: 0x6e6258,
  road: 0x8a7551,
  town: 0x5b4631,
  sand: 0xc8b070,
  cave: 0x232021,
  cobblestone: 0x7a7468,
  plaza: 0xa89370,
};

const TILE_OUTLINE = 0x000000;
const TILE_OUTLINE_ALPHA = 0.18;

export type IsoToScreen = (gx: number, gy: number) => { sx: number; sy: number };

export function makeIsoProjector(metrics: IsoMetrics): IsoToScreen {
  const halfW = metrics.tileW / 2;
  const halfH = metrics.tileH / 2;
  return (gx: number, gy: number) => ({ sx: (gx - gy) * halfW, sy: (gx + gy) * halfH });
}

/**
 * Inverse projection: screen-space (relative to the world container) → tile
 * coordinate. The result may be fractional; callers floor when they need an
 * integer cell.
 */
export function screenToIso(
  metrics: IsoMetrics,
  sx: number,
  sy: number,
): { gx: number; gy: number } {
  const halfW = metrics.tileW / 2;
  const halfH = metrics.tileH / 2;
  const gx = sx / halfW + sy / halfH;
  const gy = sy / halfH - sx / halfW;
  return { gx: gx / 2, gy: gy / 2 };
}

export interface TileLayer {
  readonly container: Container;
  readonly metrics: IsoMetrics;
  readonly map: TileMap;
  readonly bounds: TileWorldRect;
  isWalkable(x: number, y: number): boolean;
  tileAt(x: number, y: number): Tile | null;
}

export function buildTileLayer(map: TileMap, metrics: IsoMetrics = DEFAULT_ISO): TileLayer {
  const container = new Container();
  container.sortableChildren = true;
  container.label = 'tiles';

  const project = makeIsoProjector(metrics);

  for (let y = 0; y < map.height; y++) {
    const row = map.rows[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const tile = row[x];
      if (!tile) continue;
      const { sx, sy } = project(x, y);
      const g = drawTile(tile, metrics);
      g.x = sx;
      g.y = sy;
      g.zIndex = x + y;
      // Hit-test as a simple rectangle around the diamond — Pixi v8 hitArea
      // is required when eventMode is 'static' on a Graphics. We attach the
      // grid coord on the tile so click handlers can read it back.
      g.eventMode = 'static';
      g.cursor = 'pointer';
      (g as Graphics & { __tile?: { x: number; y: number } }).__tile = { x, y };
      container.addChild(g);

      if (tile.decor) {
        const decor = drawDecor(tile.decor, metrics);
        if (decor) {
          decor.x = sx;
          decor.y = sy;
          decor.zIndex = x + y + 0.5;
          container.addChild(decor);
        }
      }
    }
  }

  // World bounds for camera clamping. Iso projection skews; compute the
  // true min/max in screen-space so the camera never reveals the void.
  const corners = [
    project(0, 0),
    project(map.width, 0),
    project(0, map.height),
    project(map.width, map.height),
  ];
  const xs = corners.map((c) => c.sx);
  const ys = corners.map((c) => c.sy);
  const bounds: TileWorldRect = {
    minX: Math.min(...xs) - metrics.tileW,
    maxX: Math.max(...xs) + metrics.tileW,
    minY: Math.min(...ys) - metrics.tileH,
    maxY: Math.max(...ys) + metrics.tileH,
  };

  return {
    container,
    metrics,
    map,
    bounds,
    isWalkable(x, y) {
      const tile = tileLookup(map, x, y);
      return tile?.walkable === true;
    },
    tileAt(x, y) {
      return tileLookup(map, x, y);
    },
  };
}

function tileLookup(map: TileMap, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const row = map.rows[y];
  if (!row) return null;
  return row[x] ?? null;
}

function drawTile(tile: Tile, m: IsoMetrics): Graphics {
  const halfW = m.tileW / 2;
  const halfH = m.tileH / 2;
  const colour = TILE_COLORS[tile.type] ?? 0x666666;
  const g = new Graphics();
  g.poly([0, -halfH, halfW, 0, 0, halfH, -halfW, 0])
    .fill({ color: colour, alpha: 1 })
    .stroke({ color: TILE_OUTLINE, alpha: TILE_OUTLINE_ALPHA, width: 1 });
  return g;
}

function drawDecor(name: string, m: IsoMetrics): Graphics | null {
  // Lightweight stylised decor — colour-coded silhouettes. Real art swaps in
  // when the sprite registry has an entry keyed `decor.<name>`.
  const g = new Graphics();
  switch (name) {
    case 'tree_oak':
      g.circle(0, -m.tileH * 0.9, m.tileH * 0.7).fill({ color: 0x2c6622, alpha: 0.95 });
      g.rect(-2, -m.tileH * 0.2, 4, m.tileH * 0.5).fill({ color: 0x4a2f1a });
      return g;
    case 'building_stone':
      g.rect(-m.tileW * 0.45, -m.tileH * 1.6, m.tileW * 0.9, m.tileH * 1.6)
        .fill({ color: 0x6f6862 })
        .stroke({ color: 0x000000, alpha: 0.4, width: 1 });
      g.poly([
        -m.tileW * 0.5,
        -m.tileH * 1.6,
        0,
        -m.tileH * 2.0,
        m.tileW * 0.5,
        -m.tileH * 1.6,
      ]).fill({ color: 0x4d3a2a });
      return g;
    case 'moongate':
      g.ellipse(0, -m.tileH * 0.7, m.tileW * 0.35, m.tileH * 0.9)
        .fill({ color: 0x4a3a8a, alpha: 0.7 })
        .stroke({ color: 0x8a7ad6, alpha: 0.9, width: 2 });
      return g;
    case 'dock':
      g.rect(-m.tileW * 0.4, -2, m.tileW * 0.8, 6).fill({ color: 0x6b4a2a });
      return g;
    default:
      return null;
  }
}

/** Hit-test helper: returns the tile under the given world-space point. */
export function tileAtWorldPoint(
  layer: TileLayer,
  worldX: number,
  worldY: number,
): { x: number; y: number } | null {
  const { gx, gy } = screenToIso(layer.metrics, worldX, worldY);
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  if (x < 0 || y < 0 || x >= layer.map.width || y >= layer.map.height) return null;
  return { x, y };
}
