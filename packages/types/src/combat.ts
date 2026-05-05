// Mirrors future protobuf message CombatService; hand-written for now.
//
// Reference: Doc #16 Combat & Magic.

import type { AbilityId, EntityId, ItemId, LocalizedString, ServerTick, SpellId } from './common';

export type CombatStance = 'idle' | 'aggressive' | 'defensive' | 'fleeing' | 'casting';

export type DamageType = 'physical' | 'fire' | 'cold' | 'poison' | 'lightning' | 'arcane' | 'holy';

export type StatusEffect =
  | 'on-fire'
  | 'poisoned'
  | 'wet'
  | 'paralyzed'
  | 'invisible'
  | 'charmed'
  | 'sleeping'
  | 'bleeding';

export interface Combatant {
  readonly entityId: EntityId;
  readonly name: string;
  readonly faction: 'player' | 'ally' | 'enemy' | 'neutral';
  readonly hp: { readonly current: number; readonly max: number };
  readonly mana: { readonly current: number; readonly max: number };
  readonly stamina: { readonly current: number; readonly max: number };
  readonly stance: CombatStance;
  readonly armorRating: number;
  readonly statusEffects: readonly StatusEffect[];
  readonly portrait?: string;
  readonly initiative: number;
}

export interface DamageInstance {
  readonly source: EntityId;
  readonly target: EntityId;
  readonly amount: number;
  readonly type: DamageType;
  readonly crit: boolean;
  readonly mitigated: number;
  readonly tick: ServerTick;
}

export interface CombatState {
  readonly encounterId: string;
  readonly regionId: string;
  readonly tick: ServerTick;
  readonly inCombat: boolean;
  readonly turnIndex: number;
  readonly participants: readonly Combatant[];
  readonly recentDamage: readonly DamageInstance[];
  readonly phase?: {
    readonly id: string;
    readonly label: LocalizedString;
    readonly remainingHp: number;
  };
  readonly bossEncounter: boolean;
}

export interface Ability {
  readonly id: AbilityId;
  readonly name: LocalizedString;
  readonly description: string;
  readonly cooldownSeconds: number;
  readonly costStamina: number;
  readonly costMana: number;
  readonly damageType?: DamageType;
  readonly basePower: number;
  readonly rangeTiles: number;
  readonly iconKey: string;
  readonly hotkey?: string;
}

export interface Spell {
  readonly id: SpellId;
  readonly name: LocalizedString;
  readonly circle: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly school: 'attack' | 'defense' | 'restoration' | 'illusion' | 'summon' | 'utility';
  readonly description: string;
  readonly reagents: readonly { readonly itemId: ItemId; readonly qty: number }[];
  readonly manaCost: number;
  readonly castSeconds: number;
  readonly rangeTiles: number;
  readonly damageType?: DamageType;
  readonly basePower: number;
  readonly iconKey: string;
  readonly known: boolean;
  readonly memorized: boolean;
}

export interface Spellbook {
  readonly characterId: string;
  readonly spells: readonly Spell[];
  readonly memorizedSlots: number;
}
