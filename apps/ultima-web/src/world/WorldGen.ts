import { PerlinNoise } from '../noise';
import { TileType, TILE_WALKABLE } from './TileType';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants';

// Approximate Britannia shrine positions as normalized [0,1] coords
// Honesty, Compassion, Valor, Justice, Sacrifice, Honor, Spirituality, Humility
const SHRINE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0.72, 0.22], // Honesty — Moonglow (east island)
  [0.42, 0.38], // Compassion — Britain (central)
  [0.30, 0.72], // Valor — Jhelom (south islands)
  [0.22, 0.28], // Justice — Yew (northwest forest)
  [0.65, 0.28], // Sacrifice — Minoc (northeast)
  [0.55, 0.68], // Honor — Trinsic (south)
  [0.50, 0.50], // Spirituality — center of the realm
  [0.48, 0.84], // Humility — far south cape
];

export function generateWorld(seed: number): Uint8Array {
  const tiles = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
  const elevation = new PerlinNoise(seed);
  const moisture = new PerlinNoise(seed ^ 0x1337beef);
  const detail = new PerlinNoise(seed ^ 0xdeadcafe);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // Normalize to [-1,1] for island mask
      const nx = (x / WORLD_WIDTH) * 2 - 1;
      const ny = (y / WORLD_HEIGHT) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const islandMask = Math.max(0, 1 - dist * 1.35);

      const e = elevation.octave(x, y, 6, 0.5, 96) * 0.5 + 0.5;
      const m = moisture.octave(x, y, 4, 0.5, 64) * 0.5 + 0.5;
      const d = detail.octave(x, y, 3, 0.5, 24) * 0.5 + 0.5;

      const maskedE = e * islandMask + (1 - islandMask) * 0.08;

      tiles[y * WORLD_WIDTH + x] = determineTile(maskedE, m, d);
    }
  }

  placeRuins(tiles, seed);
  placeCastle(tiles);

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

function placeCastle(tiles: Uint8Array): void {
  const W = TileType.CastleWall;
  const F = TileType.Road;

  // 13 wide × 9 tall. Gate at south wall cols 5-7.
  // Keep (3×3 outer) in NW corner with east-facing door.
  const PATTERN: TileType[][] = [
    [W,W,W,W,W,W,W,W,W,W,W,W,W],  // north wall
    [W,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,W,W,W,F,F,F,F,F,F,F,W],  // keep top
    [W,F,W,F,F,F,F,F,F,F,F,F,W],  // keep interior (door on east)
    [W,F,W,W,W,F,F,F,F,F,F,F,W],  // keep bottom
    [W,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,F,F,F,W,W,W,W,W],  // south wall with gate
  ];

  // Center castle on world; player spawns inside courtyard
  const OX = Math.floor(WORLD_WIDTH  / 2) - 6;
  const OY = Math.floor(WORLD_HEIGHT / 2) - 4;

  for (let dy = 0; dy < PATTERN.length; dy++) {
    for (let dx = 0; dx < PATTERN[dy].length; dx++) {
      const tx = OX + dx;
      const ty = OY + dy;
      if (tx >= 0 && ty >= 0 && tx < WORLD_WIDTH && ty < WORLD_HEIGHT) {
        tiles[ty * WORLD_WIDTH + tx] = PATTERN[dy][dx];
      }
    }
  }
}

function placeRuins(tiles: Uint8Array, _seed: number): void {
  for (const [nx, ny] of SHRINE_POSITIONS) {
    const cx = Math.floor(nx * WORLD_WIDTH);
    const cy = Math.floor(ny * WORLD_HEIGHT);

    // Diamond footprint — buried shrine foundation
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 4) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) continue;
        if (TILE_WALKABLE[tiles[ty * WORLD_WIDTH + tx]]) {
          tiles[ty * WORLD_WIDTH + tx] = TileType.Ruins;
        }
      }
    }
  }
}
