// Screen→grid hit-test for the editor canvas.
//
// The editor's tile grid sits inside a Pixi `world` Container at world
// origin (0,0). Painting a cell at (gx, gy) follows the same iso projection
// `tiles.ts` uses for the runtime canvas:
//
//   sx = (gx - gy) * (tileW / 2)
//   sy = (gx + gy) * (tileH / 2)
//
// The inverse is also a pure function — see `screenToIso` in `tiles.ts`.
// We re-export a thin wrapper that floors the result and clamps to the
// editor's grid bounds, returning null when the click missed the grid.

import { type IsoMetrics, screenToIso } from '../../canvas/tiles';

export interface GridCell {
  readonly x: number;
  readonly y: number;
}

export function worldToGrid(
  metrics: IsoMetrics,
  size: number,
  worldX: number,
  worldY: number,
): GridCell | null {
  const { gx, gy } = screenToIso(metrics, worldX, worldY);
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}
