import { PerlinNoise } from '../noise';
import { TileType, TILE_WALKABLE } from './TileType';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants';

// Each island: normalized center [0,1] and falloff scale (higher = smaller island)
const ISLANDS = [
  { nx: 0.50, ny: 0.50, scale: 4.5 },  // main (large, center)
  { nx: 0.12, ny: 0.18, scale: 6.5 },  // NW
  { nx: 0.88, ny: 0.15, scale: 6.5 },  // NE
  { nx: 0.14, ny: 0.82, scale: 6.0 },  // SW
  { nx: 0.86, ny: 0.84, scale: 6.0 },  // SE
  { nx: 0.50, ny: 0.09, scale: 8.0 },  // N (small)
  { nx: 0.50, ny: 0.91, scale: 8.0 },  // S (small)
  { nx: 0.09, ny: 0.50, scale: 7.5 },  // W
  { nx: 0.91, ny: 0.50, scale: 7.5 },  // E
] as const;

// Castles placed at the center of the five main islands
const CASTLE_CENTERS: Array<[number, number]> = [
  [0.50, 0.50],
  [0.12, 0.18],
  [0.88, 0.15],
  [0.14, 0.82],
  [0.86, 0.84],
];

// Shrine positions spread across all islands
export const SHRINE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0.50, 0.44],  // Spirituality — near main castle
  [0.54, 0.56],  // Honesty — main island east
  [0.12, 0.12],  // Compassion — NW island
  [0.88, 0.10],  // Valor — NE island
  [0.10, 0.82],  // Justice — SW island
  [0.88, 0.88],  // Sacrifice — SE island
  [0.50, 0.06],  // Honor — N island
  [0.50, 0.94],  // Humility — S island
];

export function generateWorld(seed: number): Uint8Array {
  const tiles = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
  const elevation = new PerlinNoise(seed);
  const moisture  = new PerlinNoise(seed ^ 0x1337beef);
  const detail    = new PerlinNoise(seed ^ 0xdeadcafe);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // Multi-island mask: take the max contribution from any island center
      let islandMask = 0;
      for (const { nx: icx, ny: icy, scale } of ISLANDS) {
        const dx   = x / WORLD_WIDTH  - icx;
        const dy   = y / WORLD_HEIGHT - icy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        islandMask = Math.max(islandMask, Math.max(0, 1 - dist * scale));
      }

      const e = elevation.octave(x, y, 6, 0.5, 96) * 0.5 + 0.5;
      const m = moisture.octave(x, y, 4, 0.5, 64)  * 0.5 + 0.5;
      const d = detail.octave(x, y, 3, 0.5, 24)    * 0.5 + 0.5;

      const maskedE = e * islandMask + (1 - islandMask) * 0.08;
      tiles[y * WORLD_WIDTH + x] = determineTile(maskedE, m, d);
    }
  }

  placeRuins(tiles);
  for (const [ncx, ncy] of CASTLE_CENTERS) {
    const ox = Math.floor(ncx * WORLD_WIDTH)  - 18;
    const oy = Math.floor(ncy * WORLD_HEIGHT) - 10;
    flattenForCastle(tiles, ox, oy);
    placeCastle(tiles, ox, oy);
  }

  return tiles;
}

function determineTile(e: number, m: number, d: number): TileType {
  if (e < 0.25) return TileType.DeepOcean;
  if (e < 0.33) return TileType.ShallowWater;
  if (e < 0.38) return m > 0.60 ? TileType.Swamp : TileType.Sand;

  if (e < 0.72) {
    if (m > 0.78) return TileType.DenseForest;
    if (m > 0.58) return TileType.Forest;
    if (m > 0.38) return e > 0.55 ? TileType.DarkGrass : TileType.LightGrass;
    return d > 0.58 ? TileType.Sand : TileType.LightGrass;
  }

  if (e < 0.82) return m > 0.50 ? TileType.Forest : TileType.Hills;
  if (e < 0.90) return TileType.Mountains;
  if (e < 0.95) return TileType.HighMountains;
  return TileType.Snow;
}

// Ensure a clear grass footprint so the castle doesn't float in ocean
function flattenForCastle(tiles: Uint8Array, ox: number, oy: number): void {
  for (let dy = -2; dy < 22; dy++) {
    for (let dx = -2; dx < 38; dx++) {
      const tx = ox + dx, ty = oy + dy;
      if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) continue;
      const t = tiles[ty * WORLD_WIDTH + tx];
      if (!TILE_WALKABLE[t]) tiles[ty * WORLD_WIDTH + tx] = TileType.LightGrass;
    }
  }
}

function placeCastle(tiles: Uint8Array, ox: number, oy: number): void {
  const W = TileType.CastleWall;
  const F = TileType.Road;

  // Base 18×10 layout; each cell is scaled 2×2 to produce the final 36×20 footprint.
  // Map room: base cols 11–15, rows 2–5  →  doubled cols 22–30, rows 4–10
  // Map room interior: base cols 12–14, rows 3–4  →  doubled cols 24–28, rows 6–8
  const BASE: TileType[][] = [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,W,W,W,F,F,F,F,F,F,W,W,W,W,W,F,W],
    [W,F,W,F,F,F,F,F,F,F,F,W,F,F,F,W,F,W],
    [W,F,W,W,W,F,F,F,F,F,F,W,F,F,F,W,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,W,W,F,W,W,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,F,F,F,W,W,W,W,W,W,W,W,W,W],
  ];

  const PATTERN: TileType[][] = [];
  for (const row of BASE) {
    const r: TileType[] = [];
    for (const t of row) r.push(t, t);
    PATTERN.push([...r], [...r]);
  }

  for (let dy = 0; dy < PATTERN.length; dy++) {
    for (let dx = 0; dx < PATTERN[dy].length; dx++) {
      const tx = ox + dx, ty = oy + dy;
      if (tx >= 0 && ty >= 0 && tx < WORLD_WIDTH && ty < WORLD_HEIGHT) {
        tiles[ty * WORLD_WIDTH + tx] = PATTERN[dy][dx];
      }
    }
  }
}

function placeRuins(tiles: Uint8Array): void {
  for (const [nx, ny] of SHRINE_POSITIONS) {
    const cx = Math.floor(nx * WORLD_WIDTH);
    const cy = Math.floor(ny * WORLD_HEIGHT);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 4) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) continue;
        if (TILE_WALKABLE[tiles[ty * WORLD_WIDTH + tx]]) {
          tiles[ty * WORLD_WIDTH + tx] = TileType.Ruins;
        }
      }
    }
  }
}
