import type { Quest } from '@br/types';
import { describe, expect, it } from 'vitest';
import { groupQuestsByState } from '../journal.helpers';

const stub = (id: string, state: Quest['state']): Quest =>
  ({
    id: id as Quest['id'],
    title: { key: id, en: id },
    summary: { key: id, en: '' },
    state,
    giver: '',
    regionId: '',
    recommendedLevel: 1,
    virtueTags: [],
    objectives: [],
    rewards: { experience: 0, gold: 0, items: [], virtueDeltas: {} },
  }) as Quest;

describe('journal.helpers', () => {
  it('buckets quests into the correct groups by state', () => {
    const result = groupQuestsByState([
      stub('a', 'active'),
      stub('b', 'completed'),
      stub('c', 'failed'),
      stub('d', 'abandoned'),
      stub('e', 'available'),
      stub('f', 'locked'),
    ]);
    expect(result.active.map((q) => q.id)).toEqual(['a']);
    expect(result.completed.map((q) => q.id)).toEqual(['b']);
    expect(result.failed.map((q) => q.id)).toEqual(['c']);
    expect(result.abandoned.map((q) => q.id)).toEqual(['d']);
    expect(result.available.map((q) => q.id)).toEqual(['e']);
    expect(result.locked.map((q) => q.id)).toEqual(['f']);
  });

  it('returns empty buckets when given an empty list', () => {
    const r = groupQuestsByState([]);
    expect(r.active.length).toBe(0);
    expect(r.completed.length).toBe(0);
  });

  it('preserves source order within each bucket', () => {
    const r = groupQuestsByState([
      stub('a', 'active'),
      stub('b', 'completed'),
      stub('c', 'active'),
      stub('d', 'active'),
    ]);
    expect(r.active.map((q) => q.id)).toEqual(['a', 'c', 'd']);
  });
});
