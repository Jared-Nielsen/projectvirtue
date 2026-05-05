// Mirrors future protobuf message WorldService; hand-written for now.
//
// Reference: Doc #22 §6 region partitioning and Doc #17 §6 schedule slot.
// The TileMap shape is intentionally compact — the canvas agent only needs a
// 2D grid of tile IDs for prototype rendering.

import type {
  ArchetypeId,
  EntityId,
  LandmarkId,
  LocalizedString,
  NpcId,
  RegionId,
  TileCoord,
  Vec3,
} from './common';

export type Biome =
  | 'plains'
  | 'forest'
  | 'mountain'
  | 'water'
  | 'desert'
  | 'swamp'
  | 'town'
  | 'dungeon';

export interface Region {
  readonly id: RegionId;
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly biome: Biome;
  readonly tileMapKey: string;
  readonly description: string;
  readonly safeZone: boolean;
  readonly recommendedLevel: number;
  readonly neighbors: readonly RegionId[];
  /** Human-readable bounds for the marketing world map. */
  readonly bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  };
}

/** A single tile cell in the grid. */
export type TileType =
  | 'grass'
  | 'forest'
  | 'water'
  | 'mountain'
  | 'road'
  | 'town'
  | 'sand'
  | 'cave'
  | 'cobblestone'
  | 'plaza';

export interface Tile {
  readonly type: TileType;
  /** Optional decoration sprite key (rocks, flowers, signpost, etc.). */
  readonly decor?: string;
  readonly walkable: boolean;
  /** Region transition trigger — if set, walking onto this tile fires a region handoff. */
  readonly portalTo?: RegionId;
}

export interface TileMap {
  readonly regionId: RegionId;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  /** Row-major: rows[y][x]. */
  readonly rows: readonly (readonly Tile[])[];
  readonly origin: TileCoord;
}

export type NpcDisposition = 'friendly' | 'neutral' | 'hostile' | 'guard';

export interface Npc {
  readonly id: NpcId;
  readonly entityId: EntityId;
  readonly archetype: ArchetypeId;
  readonly name: string;
  readonly title: string;
  readonly regionId: RegionId;
  readonly position: Vec3;
  readonly disposition: NpcDisposition;
  readonly portrait: string;
  readonly dialogTreeId: string;
  /** Index into Schedule.slots; matches Doc #17 §6 [I*]. */
  readonly currentSlotIdx: number;
  readonly currentActivity: string;
}

export interface Landmark {
  readonly id: LandmarkId;
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly regionId: RegionId;
  readonly position: Vec3;
  readonly category: 'shrine' | 'town' | 'dungeon' | 'wonder' | 'moongate' | 'castle' | 'inn';
  readonly description: string;
  readonly discovered: boolean;
}
