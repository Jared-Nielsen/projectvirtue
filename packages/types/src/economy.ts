// Mirrors future protobuf message EconomyService; hand-written for now.
//
// Reference: Doc #18 Economy, Crafting & Trade.

import type {
  CharacterId,
  Iso8601,
  ItemId,
  LocalizedString,
  MarketListingId,
  RecipeId,
  RegionId,
  StationId,
} from './common';

export interface Currency {
  readonly gold: number;
  readonly silver: number;
  readonly copper: number;
}

export type ListingStatus = 'open' | 'sold' | 'expired' | 'cancelled';

export interface MarketListing {
  readonly id: MarketListingId;
  readonly seller: { readonly characterId: CharacterId; readonly name: string };
  readonly itemId: ItemId;
  readonly itemName: string;
  readonly itemRarity: 'mundane' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'artifact';
  readonly quantity: number;
  readonly price: Currency;
  readonly regionId: RegionId;
  readonly listedAt: Iso8601;
  readonly expiresAt: Iso8601;
  readonly status: ListingStatus;
  readonly description: string;
}

export type CraftingDifficulty = 'trivial' | 'easy' | 'standard' | 'difficult' | 'masterwork';

export interface RecipeIngredient {
  readonly itemId: ItemId;
  readonly itemName: string;
  readonly qty: number;
}

export interface Recipe {
  readonly id: RecipeId;
  readonly name: LocalizedString;
  readonly description: string;
  readonly stationId: StationId;
  readonly skill:
    | 'smithing'
    | 'tailoring'
    | 'alchemy'
    | 'cooking'
    | 'inscription'
    | 'tinkering'
    | 'carpentry';
  readonly difficulty: CraftingDifficulty;
  readonly inputs: readonly RecipeIngredient[];
  readonly output: { readonly itemId: ItemId; readonly itemName: string; readonly qty: number };
  readonly successChance: number;
  readonly experience: number;
  readonly knownByPlayer: boolean;
  readonly iconKey: string;
}

export interface CraftingStation {
  readonly id: StationId;
  readonly name: string;
  readonly skill: Recipe['skill'];
  readonly regionId: RegionId;
  readonly iconKey: string;
  readonly description: string;
  readonly publicAccess: boolean;
}
