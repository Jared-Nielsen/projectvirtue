// Mirrors future protobuf message InventoryService; hand-written for now.
//
// Reference: Doc #14 §5 use/drag/drop verbs and Doc #15 inventory model.

import type {
  ArchetypeId,
  CharacterId,
  EntityId,
  ItemId,
  LocalizedString,
  LootContainerId,
} from './common';

export type ItemSlot =
  | 'head'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'cloak'
  | 'arms'
  | 'gloves'
  | 'belt'
  | 'legs'
  | 'feet'
  | 'ring1'
  | 'ring2'
  | 'mainHand'
  | 'offHand'
  | 'ranged'
  | 'ammo'
  | 'tool';

export type ItemRarity = 'mundane' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'artifact';

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'consumable'
  | 'reagent'
  | 'tool'
  | 'quest'
  | 'book'
  | 'misc'
  | 'currency'
  | 'food'
  | 'key';

export interface Item {
  readonly id: ItemId;
  readonly entityId: EntityId;
  readonly archetype: ArchetypeId;
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly description: string;
  readonly category: ItemCategory;
  readonly rarity: ItemRarity;
  readonly stackable: boolean;
  readonly stackSize: number;
  readonly weight: number;
  readonly value: number;
  readonly slot?: ItemSlot;
  readonly iconKey: string;
  readonly tags: readonly string[];
  readonly equipped: boolean;
  readonly bound: boolean;
  readonly durability?: { readonly current: number; readonly max: number };
}

/** Equipment is a denormalized projection of "items currently equipped to slots". */
export interface Equipment {
  readonly characterId: CharacterId;
  readonly slots: Readonly<Partial<Record<ItemSlot, ItemId>>>;
  /** Weight currently borne (for the encumbrance HUD). */
  readonly carriedWeight: number;
  readonly maxCarryWeight: number;
  readonly armorRating: number;
}

export interface LootContainer {
  readonly id: LootContainerId;
  readonly entityId: EntityId;
  readonly name: string;
  readonly locked: boolean;
  readonly trapped: boolean;
  readonly opened: boolean;
  readonly contents: readonly ItemId[];
  /** Items inside (denormalized snapshot for the loot UI). */
  readonly itemsExpanded: readonly Item[];
  readonly capacity: number;
  readonly weight: number;
}
