import type { Item } from '@br/types';
import { describe, expect, it } from 'vitest';
import { classifyEncumbrance, totalCarriedWeight } from './weight';

function mkItem(over: Partial<Item>): Item {
  return {
    id: 'x',
    entityId: 'e',
    archetype: 'a',
    name: 'X',
    displayName: { key: 'k', en: 'X' },
    description: '',
    category: 'misc',
    rarity: 'mundane',
    stackable: false,
    stackSize: 1,
    weight: 1,
    value: 0,
    iconKey: 'k',
    tags: [],
    equipped: false,
    bound: false,
    ...over,
  } as Item;
}

describe('totalCarriedWeight', () => {
  it('sums non-stackable weights', () => {
    const items = [mkItem({ weight: 4.5 }), mkItem({ weight: 6 })];
    expect(totalCarriedWeight(items)).toBe(10.5);
  });

  it('multiplies stackable items by stackSize', () => {
    const items = [
      mkItem({ stackable: true, stackSize: 4, weight: 0.5 }), // 2.0
      mkItem({ stackable: true, stackSize: 12, weight: 0.05 }), // 0.6
    ];
    expect(totalCarriedWeight(items)).toBe(2.6);
  });

  it('returns 0 for an empty inventory', () => {
    expect(totalCarriedWeight([])).toBe(0);
  });

  it('treats a stackable item with stackSize 0 as a single instance', () => {
    const items = [mkItem({ stackable: true, stackSize: 0, weight: 2 })];
    expect(totalCarriedWeight(items)).toBe(2);
  });
});

describe('classifyEncumbrance', () => {
  it('classifies under 35% as light', () => {
    expect(classifyEncumbrance(10, 100).status).toBe('light');
  });

  it('classifies 35–80% as normal', () => {
    expect(classifyEncumbrance(40, 100).status).toBe('normal');
    expect(classifyEncumbrance(79, 100).status).toBe('normal');
  });

  it('classifies 80–99% as heavy', () => {
    expect(classifyEncumbrance(80, 100).status).toBe('heavy');
    expect(classifyEncumbrance(95, 100).status).toBe('heavy');
  });

  it('classifies ≥100% as overloaded', () => {
    expect(classifyEncumbrance(100, 100).status).toBe('overloaded');
    expect(classifyEncumbrance(140, 100).status).toBe('overloaded');
  });

  it('clamps the percentage between 0 and 100', () => {
    expect(classifyEncumbrance(-5, 100).pct).toBe(0);
    expect(classifyEncumbrance(500, 100).pct).toBe(100);
  });

  it('handles a max of 0 without dividing by zero', () => {
    const r = classifyEncumbrance(5, 0);
    expect(r.max).toBe(1);
    expect(Number.isFinite(r.pct)).toBe(true);
  });
});
