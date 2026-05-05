// Unit tests for the pure logic helpers used by the HUD overlays.
//
// Three suites:
//   • DamageFeed.buildFeedRows → adjacent-dedup behaviour and tail-trim.
//   • SpellRing.cycleIndex / slotPosition → ring math correctness.
//   • CityHud.placeLabels → tile-to-percent projection clamping.

import type { Combatant, DamageInstance, Npc, ServerTick } from '@br/types';
import { describe, expect, it } from 'vitest';
import { placeLabels } from '../CityHud';
import { buildFeedRows } from '../DamageFeed';
import { cycleIndex, slotPosition } from '../SpellRing';

const tick = (n: number): ServerTick => n as unknown as ServerTick;

const fakeParticipants: readonly Combatant[] = [
  {
    entityId: 'ent_player' as Combatant['entityId'],
    name: 'Avatar',
    faction: 'player',
    hp: { current: 80, max: 100 },
    mana: { current: 30, max: 50 },
    stamina: { current: 60, max: 80 },
    stance: 'aggressive',
    armorRating: 10,
    statusEffects: [],
    initiative: 14,
  },
  {
    entityId: 'ent_goblin' as Combatant['entityId'],
    name: 'Goblin',
    faction: 'enemy',
    hp: { current: 20, max: 28 },
    mana: { current: 0, max: 0 },
    stamina: { current: 30, max: 30 },
    stance: 'aggressive',
    armorRating: 4,
    statusEffects: [],
    initiative: 11,
  },
];

function dmg(
  partial: Partial<DamageInstance> & Pick<DamageInstance, 'amount' | 'tick'>,
): DamageInstance {
  return {
    source: 'ent_player' as DamageInstance['source'],
    target: 'ent_goblin' as DamageInstance['target'],
    type: 'physical',
    crit: false,
    mitigated: 0,
    ...partial,
  };
}

describe('DamageFeed.buildFeedRows', () => {
  it('emits one row per unique event when nothing dedups', () => {
    const events = [
      dmg({ amount: 12, tick: tick(1) }),
      dmg({ amount: 14, tick: tick(2) }),
      dmg({ amount: 9, tick: tick(3) }),
    ];
    const rows = buildFeedRows(events, fakeParticipants);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.text).toContain('Avatar hits Goblin for 12');
  });

  it('collapses adjacent duplicate events into one row with a count', () => {
    const events = [
      dmg({ amount: 5, tick: tick(1) }),
      dmg({ amount: 5, tick: tick(2) }),
      dmg({ amount: 5, tick: tick(3) }),
    ];
    const rows = buildFeedRows(events, fakeParticipants);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(3);
  });

  it('does NOT collapse when an unrelated event sits between duplicates', () => {
    const events = [
      dmg({ amount: 5, tick: tick(1) }),
      dmg({ amount: 7, tick: tick(2) }),
      dmg({ amount: 5, tick: tick(3) }),
    ];
    const rows = buildFeedRows(events, fakeParticipants);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.count === 1)).toBe(true);
  });

  it('treats crit-vs-noncrit as distinct rows even if amount matches', () => {
    const events = [
      dmg({ amount: 5, tick: tick(1), crit: false }),
      dmg({ amount: 5, tick: tick(2), crit: true }),
    ];
    const rows = buildFeedRows(events, fakeParticipants);
    expect(rows).toHaveLength(2);
  });

  it('tail-trims to the configured limit', () => {
    const events = Array.from({ length: 30 }, (_, i) => dmg({ amount: i, tick: tick(i) }));
    const rows = buildFeedRows(events, fakeParticipants, 5);
    expect(rows).toHaveLength(5);
    // Most recent event should be the last row.
    expect(rows[rows.length - 1]?.text).toContain('for 29');
  });

  it('falls back to the entityId when a participant cannot be resolved', () => {
    const events = [
      dmg({ source: 'ent_unknown' as DamageInstance['source'], amount: 1, tick: tick(1) }),
    ];
    const rows = buildFeedRows(events, fakeParticipants);
    expect(rows[0]?.text).toContain('ent_unknown');
  });
});

describe('SpellRing math', () => {
  it('cycleIndex wraps forward and backward over the ring length', () => {
    expect(cycleIndex(0, 1, 4)).toBe(1);
    expect(cycleIndex(3, 1, 4)).toBe(0);
    expect(cycleIndex(0, -1, 4)).toBe(3);
    expect(cycleIndex(2, -3, 4)).toBe(3);
  });

  it('cycleIndex returns 0 when the ring is empty', () => {
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });

  it('slotPosition starts at the top and proceeds clockwise', () => {
    const top = slotPosition(0, 4, 100);
    expect(top.x).toBeCloseTo(0, 5);
    expect(top.y).toBeCloseTo(-100, 5);
    const right = slotPosition(1, 4, 100);
    expect(right.x).toBeCloseTo(100, 5);
    expect(right.y).toBeCloseTo(0, 5);
    const bottom = slotPosition(2, 4, 100);
    expect(bottom.x).toBeCloseTo(0, 5);
    expect(bottom.y).toBeCloseTo(100, 5);
  });

  it('slotPosition handles a count of zero without throwing', () => {
    expect(slotPosition(0, 0, 100)).toEqual({ x: 0, y: 0 });
  });
});

describe('CityHud.placeLabels', () => {
  const bounds = { minX: 0, minY: 0, maxX: 32, maxY: 24 };
  const npc = (id: string, x: number, y: number): Npc =>
    ({
      id: id as Npc['id'],
      entityId: `ent_${id}` as Npc['entityId'],
      archetype: 'archetype.npc.test' as Npc['archetype'],
      name: id,
      title: 'Test',
      regionId: 'region_highmere' as Npc['regionId'],
      position: { x, y, z: 0 },
      disposition: 'friendly',
      portrait: '',
      dialogTreeId: 'tree_test',
      currentSlotIdx: 0,
      currentActivity: 'Idle',
    }) as unknown as Npc;

  it('clamps tile coordinates inside the visible 8-92% safe zone', () => {
    const labels = placeLabels([npc('a', 0, 0), npc('b', 32, 24)], bounds);
    const first = labels[0];
    const second = labels[1];
    expect(first?.leftPct).toBeGreaterThanOrEqual(8);
    expect(first?.topPct).toBeGreaterThanOrEqual(12);
    expect(second?.leftPct).toBeLessThanOrEqual(92);
    expect(second?.topPct).toBeLessThanOrEqual(82);
  });

  it('produces stable ordering matching the input', () => {
    const labels = placeLabels([npc('a', 4, 4), npc('b', 8, 8), npc('c', 12, 12)], bounds);
    expect(labels.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});
