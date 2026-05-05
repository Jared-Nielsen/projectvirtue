// Pure helpers for the LevelUp screen. Extracted so the unit test can
// validate the budget arithmetic without instantiating Solid components.

import type { StatAllocation } from '@br/types';

export type AllocKey = keyof StatAllocation;

export const STAT_KEYS: readonly AllocKey[] = [
  'strength',
  'dexterity',
  'intelligence',
  'constitution',
  'wisdom',
  'charisma',
] as const;

/** Returns a fresh zero-filled allocation. */
export function zeroStatAllocation(): StatAllocation {
  return {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    constitution: 0,
    wisdom: 0,
    charisma: 0,
  };
}

/** Sum of all allocations. */
export function totalAllocated(a: StatAllocation): number {
  return STAT_KEYS.reduce<number>((sum, k) => sum + a[k], 0);
}

/** Apply +/- delta with budget enforcement. Returns the new allocation
 *  (or the original if the move would breach the budget or floor at 0). */
export function applyDelta(
  alloc: StatAllocation,
  key: AllocKey,
  delta: 1 | -1,
  budget: number,
): StatAllocation {
  const next: StatAllocation = { ...alloc, [key]: alloc[key] + delta };
  if (next[key] < 0) return alloc;
  if (delta > 0 && totalAllocated(next) > budget) return alloc;
  return next;
}
