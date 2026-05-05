// Mirrors future protobuf message CharacterService; hand-written for now.

import type {
  AvatarId,
  CharacterId,
  Iso8601,
  LocalizedString,
  PortraitId,
  ShardId,
  Virtue,
} from './common';

export type Race = 'human' | 'elf' | 'dwarf' | 'halfling' | 'gargoyle';

export type Class =
  | 'avatar'
  | 'paladin'
  | 'ranger'
  | 'mage'
  | 'bard'
  | 'tinker'
  | 'shepherd'
  | 'fighter'
  | 'druid';

export type VirtueAlignment = Virtue | 'balance';

export interface Stats {
  readonly strength: number;
  readonly dexterity: number;
  readonly intelligence: number;
  readonly constitution: number;
  readonly wisdom: number;
  readonly charisma: number;
}

export interface Portrait {
  readonly id: PortraitId;
  readonly url: string;
  readonly thumbUrl: string;
  readonly race: Race;
  readonly gender: 'male' | 'female' | 'androgynous';
  readonly mood: 'stoic' | 'fierce' | 'kind' | 'wise' | 'mischievous';
}

export interface Character {
  readonly id: CharacterId;
  readonly avatarId: AvatarId;
  readonly accountId: string;
  readonly shardId: ShardId;
  readonly name: string;
  readonly race: Race;
  readonly class: Class;
  readonly virtueAlignment: VirtueAlignment;
  readonly portraitId: PortraitId;
  readonly level: number;
  readonly experience: number;
  readonly stats: Stats;
  readonly hp: { readonly current: number; readonly max: number };
  readonly mana: { readonly current: number; readonly max: number };
  readonly stamina: { readonly current: number; readonly max: number };
  readonly currency: { readonly gold: number; readonly silver: number; readonly copper: number };
  readonly virtueScores: Readonly<Record<Virtue, number>>;
  readonly publicTitle: string;
  readonly createdAt: Iso8601;
  readonly lastPlayedAt: Iso8601;
  readonly playtimeSeconds: number;
  readonly location: {
    readonly regionId: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

/** Pre-rolled starter pack picked at creation; mirrors Doc #2 archetype starters. */
export interface CharacterTemplate {
  readonly id: string;
  readonly displayName: LocalizedString;
  readonly description: string;
  readonly race: Race;
  readonly class: Class;
  readonly virtueAlignment: VirtueAlignment;
  readonly baseStats: Stats;
  readonly startingItems: readonly string[];
  readonly startingSpells: readonly string[];
  readonly portraitOptions: readonly PortraitId[];
}

export interface CreateCharacterRequest {
  readonly name: string;
  readonly templateId: string;
  readonly race: Race;
  readonly class: Class;
  readonly virtueAlignment: VirtueAlignment;
  readonly portraitId: PortraitId;
  readonly statAllocation: Stats;
  readonly shardId: ShardId;
}

export interface CreateCharacterResponse {
  readonly character: Character;
  readonly tutorialQuestId: string;
}
