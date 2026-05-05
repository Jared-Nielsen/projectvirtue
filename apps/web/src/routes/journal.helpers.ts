// Pure helpers for the Journal screen. Mostly transforms a flat quest list
// into the buckets the UI uses ("active / completed / failed / abandoned").

import type { Quest } from '@br/types';

export interface QuestGroups {
  readonly active: readonly Quest[];
  readonly completed: readonly Quest[];
  readonly failed: readonly Quest[];
  readonly abandoned: readonly Quest[];
  readonly available: readonly Quest[];
  readonly locked: readonly Quest[];
}

export function groupQuestsByState(quests: readonly Quest[]): QuestGroups {
  const active: Quest[] = [];
  const completed: Quest[] = [];
  const failed: Quest[] = [];
  const abandoned: Quest[] = [];
  const available: Quest[] = [];
  const locked: Quest[] = [];

  for (const q of quests) {
    switch (q.state) {
      case 'active':
        active.push(q);
        break;
      case 'completed':
        completed.push(q);
        break;
      case 'failed':
        failed.push(q);
        break;
      case 'abandoned':
        abandoned.push(q);
        break;
      case 'available':
        available.push(q);
        break;
      case 'locked':
        locked.push(q);
        break;
      default:
        // Unknown states fall into the "active" bucket so they remain visible.
        active.push(q);
        break;
    }
  }

  return { active, completed, failed, abandoned, available, locked };
}
