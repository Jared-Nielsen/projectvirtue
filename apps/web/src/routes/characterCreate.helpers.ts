// Pure helpers extracted from CharacterCreate so the unit test (in
// __tests__/CharacterCreate.test.ts) can exercise the data shape transforms
// without spinning up the DOM. Keep all decisions deterministic — the UI
// re-rolls by bumping a seed integer and we map seed → stats by hashing.

import type { Stats, VirtueAlignment } from '@br/types';

export type StatKey = keyof Stats;

export const STAT_KEYS: readonly StatKey[] = [
  'strength',
  'dexterity',
  'intelligence',
  'constitution',
  'wisdom',
  'charisma',
] as const;

export type StepId = 'race' | 'class' | 'name' | 'virtue' | 'stats' | 'portrait' | 'review';

export const STEPS: readonly { readonly id: StepId; readonly label: string }[] = [
  { id: 'race', label: 'Race' },
  { id: 'class', label: 'Class' },
  { id: 'name', label: 'Name' },
  { id: 'virtue', label: 'Virtue' },
  { id: 'stats', label: 'Stats' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'review', label: 'Review' },
];

/**
 * Virtue alignment to starting stat bonus mapping. Mirrors Doc #5 — each
 * Virtue lifts one or two stats and tempers another. `balance` returns all
 * zeros (the Avatar's archetype). The numbers are small (-1..+2) because
 * the rolled stat boost is meant to be the dominant signal.
 */
export function virtueStarterBonus(v: VirtueAlignment): Stats {
  const empty: Stats = {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    constitution: 0,
    wisdom: 0,
    charisma: 0,
  };
  switch (v) {
    case 'mercy':
      return { ...empty, charisma: 2, wisdom: 1 };
    case 'truth':
      return { ...empty, intelligence: 2, charisma: 1 };
    case 'honor':
      return { ...empty, strength: 2, constitution: 1 };
    case 'humility':
      return { ...empty, wisdom: 2, charisma: -1 };
    case 'justice':
      return { ...empty, intelligence: 1, dexterity: 1, strength: 1 };
    case 'devotion':
      return { ...empty, constitution: 2, charisma: 1 };
    case 'insight':
      return { ...empty, wisdom: 2, intelligence: 1 };
    case 'courage':
      return { ...empty, strength: 1, dexterity: 1, constitution: 1 };
    case 'balance':
      return empty;
    default:
      return empty;
  }
}

/**
 * Deterministic stat roll keyed by `seed`. Returns a Stats object where
 * each value is in the range [-2, +2], representing the rolled deviation
 * from the template's base stats. Re-roll = increment seed.
 */
export function rollStats(seed: number): Stats {
  const result: Record<StatKey, number> = {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    constitution: 0,
    wisdom: 0,
    charisma: 0,
  };
  let h = (seed * 2654435761) >>> 0;
  for (const key of STAT_KEYS) {
    h = (h * 1664525 + 1013904223) >>> 0;
    // Map to -2..+2 inclusive.
    result[key] = (h % 5) - 2;
  }
  return result as Stats;
}

/**
 * Render the bonus column for a stat row: `roll±` and `virtue±`. Used by
 * the stats step.
 */
export function bonusFor(key: StatKey, v: VirtueAlignment, rolled: Stats): string {
  const r = rolled[key];
  const b = virtueStarterBonus(v)[key];
  const fmt = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
  if (r === 0 && b === 0) return '+0';
  if (b === 0) return `roll ${fmt(r)}`;
  if (r === 0) return `${v} ${fmt(b)}`;
  return `roll ${fmt(r)} · ${v} ${fmt(b)}`;
}
