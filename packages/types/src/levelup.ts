// Mirrors future protobuf message LevelUpEvent; hand-written for now.

import type { CharacterId, Iso8601 } from './common';

export interface StatAllocation {
  readonly strength: number;
  readonly dexterity: number;
  readonly intelligence: number;
  readonly constitution: number;
  readonly wisdom: number;
  readonly charisma: number;
}

export interface LevelUpEvent {
  readonly characterId: CharacterId;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly hpDelta: number;
  readonly manaDelta: number;
  readonly staminaDelta: number;
  readonly statPointsAvailable: number;
  readonly statSuggested: StatAllocation;
  readonly newAbilities: readonly string[];
  readonly newSpells: readonly string[];
  readonly title?: string;
  readonly occurredAt: Iso8601;
  readonly loreFlavor: string;
}
