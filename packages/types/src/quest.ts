// Mirrors future protobuf message QuestService; hand-written for now.
//
// Reference: Doc #19 quest engine + Doc #36 procedural quest skeletons.

import type { CharacterId, Iso8601, LocalizedString, ObjectiveId, QuestId, Virtue } from './common';

export type QuestState = 'available' | 'active' | 'completed' | 'failed' | 'abandoned' | 'locked';

export type ObjectiveStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'optional';

export interface QuestObjective {
  readonly id: ObjectiveId;
  readonly questId: QuestId;
  readonly description: LocalizedString;
  readonly status: ObjectiveStatus;
  readonly progress: number;
  readonly target: number;
  readonly hidden: boolean;
  readonly optional: boolean;
}

export interface Quest {
  readonly id: QuestId;
  readonly title: LocalizedString;
  readonly summary: LocalizedString;
  readonly state: QuestState;
  readonly giver: string;
  readonly regionId: string;
  readonly recommendedLevel: number;
  readonly virtueTags: readonly Virtue[];
  readonly objectives: readonly QuestObjective[];
  readonly rewards: {
    readonly experience: number;
    readonly gold: number;
    readonly items: readonly string[];
    readonly virtueDeltas: Readonly<Partial<Record<Virtue, number>>>;
  };
  readonly acceptedAt?: Iso8601;
  readonly completedAt?: Iso8601;
}

export interface QuestTemplate {
  readonly id: string;
  readonly skeleton: 'fetch' | 'kill' | 'escort' | 'deliver' | 'investigate' | 'collect' | 'rescue';
  readonly title: LocalizedString;
  readonly virtueTags: readonly Virtue[];
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly objectives: readonly Omit<QuestObjective, 'questId' | 'progress' | 'status'>[];
}

export interface JournalEntry {
  readonly id: string;
  readonly characterId: CharacterId;
  readonly questId?: QuestId;
  readonly title: string;
  readonly body: string;
  readonly recordedAt: Iso8601;
  readonly category: 'quest' | 'lore' | 'rumor' | 'personal';
  readonly tags: readonly string[];
}
