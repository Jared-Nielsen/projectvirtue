export enum TileType {
  DeepOcean = 0,
  ShallowWater = 1,
  Swamp = 2,
  Sand = 3,
  LightGrass = 4,
  DarkGrass = 5,
  Forest = 6,
  DenseForest = 7,
  Hills = 8,
  Mountains = 9,
  HighMountains = 10,
  Snow = 11,
  Lava = 12,
  Ruins = 13,
  Road = 14,
  CastleWall = 15,
}

export const NUM_TILE_TYPES = 16;

// Hex colors for placeholder pixel art — replace with sprite atlas later
export const TILE_COLORS: readonly number[] = [
  0x1a2e5a, // DeepOcean
  0x1e4d8c, // ShallowWater
  0x3a5c24, // Swamp
  0xc8b054, // Sand
  0x5aaa3c, // LightGrass
  0x3d8a28, // DarkGrass
  0x2a6622, // Forest
  0x1a4414, // DenseForest
  0x8b7355, // Hills
  0x7a7a8a, // Mountains
  0x5a5a6a, // HighMountains
  0xdce8ff, // Snow
  0xcc2200, // Lava
  0x5a4a3a, // Ruins (buried shrine)
  0x9a7a5a, // Road
  0x5a5a6a, // CastleWall (same as HighMountains — dark stone base under sprite)
];

export const TILE_NAMES: readonly string[] = [
  'Deep Ocean',      // DeepOcean
  'Shallow Water',   // ShallowWater
  'Swamp',           // Swamp
  'Sandy Shore',     // Sand
  'Grassland',       // LightGrass
  'Meadow',          // DarkGrass
  'Forest',          // Forest
  'Dense Forest',    // DenseForest
  'Hills',           // Hills
  'Mountains',       // Mountains
  'High Mountains',  // HighMountains
  'Snow',            // Snow
  'Lava',            // Lava
  'Ancient Ruins',   // Ruins
  'Road',            // Road
  'Castle Wall',     // CastleWall
];

export const TILE_WALKABLE: readonly boolean[] = [
  false, // DeepOcean
  false, // ShallowWater
  true,  // Swamp
  true,  // Sand
  true,  // LightGrass
  true,  // DarkGrass
  true,  // Forest
  true,  // DenseForest
  true,  // Hills
  false, // Mountains
  false, // HighMountains
  true,  // Snow
  false, // Lava
  true,  // Ruins
  true,  // Road
  false, // CastleWall
];
