// Mirrors future protobuf scalar/branded types; hand-written for now.
//
// NOTE: branded ID types are nominal-only at the TS level. They become typedef
// aliases over `string` in the eventual ts-proto codegen output. Authors writing
// JSON mocks just produce string values — the brand is erased at runtime.
//
// TODO(zod): when runtime validation lands, attach Zod schemas alongside each
// branded ID and scalar; the JSON loaders will then validate at the boundary.

export type Brand<T, B extends string> = T & { readonly __brand: B };

// ---------- Identifiers (string-branded) ----------

export type AccountId = Brand<string, 'AccountId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type ShardId = Brand<string, 'ShardId'>;
export type RegionId = Brand<string, 'RegionId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type AvatarId = Brand<string, 'AvatarId'>;
export type CharacterId = Brand<string, 'CharacterId'>;
export type NpcId = Brand<string, 'NpcId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type ArchetypeId = Brand<string, 'ArchetypeId'>;
export type QuestId = Brand<string, 'QuestId'>;
export type ObjectiveId = Brand<string, 'ObjectiveId'>;
export type BookId = Brand<string, 'BookId'>;
export type DialogTreeId = Brand<string, 'DialogTreeId'>;
export type DialogNodeId = Brand<string, 'DialogNodeId'>;
export type SpellId = Brand<string, 'SpellId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
export type RecipeId = Brand<string, 'RecipeId'>;
export type StationId = Brand<string, 'StationId'>;
export type GuildId = Brand<string, 'GuildId'>;
export type FriendId = Brand<string, 'FriendId'>;
export type ChannelId = Brand<string, 'ChannelId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type PortraitId = Brand<string, 'PortraitId'>;
export type LandmarkId = Brand<string, 'LandmarkId'>;
export type LootContainerId = Brand<string, 'LootContainerId'>;
export type MarketListingId = Brand<string, 'MarketListingId'>;
export type EventId = Brand<string, 'EventId'>;

// ---------- Scalar wire types ----------

/** ISO-8601 UTC timestamp (string on the wire; Date constructed client-side). */
export type Iso8601 = string;

/** UUIDv4 (string on the wire). */
export type Uuid = string;

/** Server tick counter (uint64; serialized as string in protobuf JSON). */
export type ServerTick = number;

/** 2D tile coordinate (col, row). */
export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

/** 3D world position. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Localized string slot. The value is the source-locale (en) text; translations
 *  are joined at render time via i18n. */
export interface LocalizedString {
  readonly key: string;
  readonly en: string;
}

// ---------- Domain enums shared across files ----------

/** The eight Britannian Virtues (Doc #5). */
export type Virtue =
  | 'compassion'
  | 'honesty'
  | 'honor'
  | 'humility'
  | 'justice'
  | 'sacrifice'
  | 'spirituality'
  | 'valor';

export type GameMode = 'single-player' | 'persistent' | 'gm-campaign';

export type ErrorCode =
  | 'ERR_SHARD_BINDING'
  | 'ERR_CAPABILITY'
  | 'ERR_VIRTUE_REJECTED'
  | 'ERR_INVALID_TARGET'
  | 'ERR_OUT_OF_RANGE'
  | 'ERR_OWNERSHIP'
  | 'ERR_BUSY'
  | 'ERR_PHYSICS'
  | 'ERR_SCOPE_MISMATCH'
  | 'ERR_RATE_LIMIT'
  | 'ERR_UNKNOWN_ACTION'
  | 'ERR_PROTOCOL_VERSION'
  | 'ERR_NAMESPACE_VIOLATION'
  | 'ERR_AUTH'
  | 'ERR_NOT_FOUND'
  | 'ERR_INTERNAL';

/** Standard API error envelope returned from any mocked endpoint on failure. */
export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
