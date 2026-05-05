// Pure helpers for the inventory screen — kept separate from the JSX so the
// branching logic is easy to unit test.

import type { Equipment, Item, ItemSlot } from '@br/types';

export interface EncumbranceState {
  readonly carried: number;
  readonly max: number;
  readonly pct: number;
  readonly status: 'light' | 'normal' | 'heavy' | 'overloaded';
}

/** Sum the weight of every item the avatar is currently carrying. */
export function totalCarriedWeight(items: readonly Item[]): number {
  let sum = 0;
  for (const item of items) {
    const stack = item.stackable ? Math.max(item.stackSize, 1) : 1;
    sum += item.weight * stack;
  }
  return Math.round(sum * 100) / 100;
}

/** Bin the encumbrance into HUD tiers used by the StatGauge. */
export function classifyEncumbrance(carried: number, max: number): EncumbranceState {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (carried / safeMax) * 100));
  const status: EncumbranceState['status'] =
    pct >= 100 ? 'overloaded' : pct >= 80 ? 'heavy' : pct >= 35 ? 'normal' : 'light';
  return { carried, max: safeMax, pct, status };
}

/** Return only the items that match the given inventory slot, or that are
 * unassigned (loose bag items). */
export function itemsInSlot(items: readonly Item[], slot: ItemSlot | null): readonly Item[] {
  if (slot === null) return items.filter((i) => !i.equipped);
  return items.filter((i) => i.slot === slot && i.equipped);
}

/** Resolve the equipped item for a given slot via the equipment manifest. */
export function equippedItem(
  equipment: Equipment,
  items: readonly Item[],
  slot: ItemSlot,
): Item | null {
  const id = equipment.slots[slot];
  if (!id) return null;
  return items.find((i) => i.id === id) ?? null;
}
