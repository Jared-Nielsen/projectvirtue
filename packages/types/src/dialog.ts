// Mirrors future protobuf message DialogService; hand-written for now.
//
// Reference: Doc #17 §2 keyword-driven dialogue. The "branch" tree below is
// a thin convenience layer for screens that want to render a tree-style UI;
// the canonical wire shape is the keyword map per Doc #17.

import type { DialogNodeId, DialogTreeId, LocalizedString, NpcId, Virtue } from './common';

export type Keyword = string;

export type ResponseId = string;

/** Dialogue side-effects mirror Doc #17 DialogueEffect union. */
export type DialogEffect =
  | { readonly kind: 'GiveItem'; readonly archetype: string; readonly qty: number }
  | {
      readonly kind: 'TakeItem';
      readonly archetype: string;
      readonly qty: number;
      readonly ownerCheck: boolean;
    }
  | { readonly kind: 'StartQuest'; readonly questId: string }
  | { readonly kind: 'CompleteQuest'; readonly questId: string }
  | { readonly kind: 'SetFlag'; readonly flagId: string; readonly value: boolean }
  | { readonly kind: 'ChangeVirtue'; readonly virtue: Virtue; readonly delta: number }
  | { readonly kind: 'TriggerCutscene'; readonly cutsceneId: string }
  | { readonly kind: 'EndDialogue' };

export interface DialogResponse {
  readonly id: ResponseId;
  readonly text: LocalizedString;
  readonly unlocks: readonly Keyword[];
  readonly locks: readonly Keyword[];
  readonly sideEffects: readonly DialogEffect[];
  readonly voicedClipKey?: string;
}

export interface DialogTree {
  readonly id: DialogTreeId;
  readonly npcId: NpcId;
  readonly opening: readonly Keyword[];
  /** Keyword → ResponseId dispatch map. */
  readonly keywords: Readonly<Record<Keyword, ResponseId>>;
  readonly responses: Readonly<Record<ResponseId, DialogResponse>>;
  readonly defaultResponseId: ResponseId;
}

/** Convenience tree-shaped dialog used by Doc #9-1 dialog modal mockups. */
export interface DialogNode {
  readonly id: DialogNodeId;
  readonly speaker: 'npc' | 'avatar' | 'narrator';
  readonly text: LocalizedString;
  readonly choices: readonly {
    readonly id: string;
    readonly label: LocalizedString;
    readonly nextNodeId?: DialogNodeId;
    readonly virtueRequired?: { readonly virtue: Virtue; readonly minScore: number };
    readonly endsConversation?: boolean;
  }[];
}

export interface NpcDialog {
  readonly npcId: NpcId;
  readonly npcName: string;
  readonly portrait: string;
  readonly tree: DialogTree;
  /** Optional pre-built linear / branching node list for screens that prefer it. */
  readonly nodes?: readonly DialogNode[];
  readonly entryNodeId?: DialogNodeId;
}
