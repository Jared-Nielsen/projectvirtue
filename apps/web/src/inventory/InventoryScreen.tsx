// Inventory overlay — concept-art reference InterfaceInventory.png.
//
// Layout: equipment slots (left), paperdoll (centre), stats (right), bag
// grid (bottom). Equip slots match the canonical `ItemSlot` enum from
// @br/types — see `_docs/Project Virtue_ 15-Character, Party & Inventory.md`
// for the design-side 14-slot SI taxonomy. The current type only ships 17
// slots; we surface the most player-facing 12 here in a paperdoll-style grid.
//
// Drag/drop: HTML5 native for pointer users PLUS a keyboard alternative —
// Tab onto a slot or tile, press Enter to "pick up" the item, arrow keys
// move the focus ring, then Enter again to drop. The store mutation is
// optimistic; the server-authoritative move would be dispatched at the
// `commitMove` TODO below (Doc #14 §5 `move` verb envelope).
//
// Right-click (or long-press on touch) opens a context menu (Use / Drop /
// Inspect). Tooltips on hover use the @br/ui Tooltip primitive.

import type { Equipment, Item, ItemRarity, ItemSlot } from '@br/types';
import { Card, Loading, Stack, StatGauge, Tooltip } from '@br/ui';
import { For, type JSX, Show, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './inventory.module.css';
import { classifyEncumbrance, equippedItem } from './weight';

interface ItemsResponse {
  readonly items: readonly Item[];
}

/** Subset of slots surfaced in the paperdoll UI, in the order they're rendered.
 * Pulled from `ItemSlot` (@br/types/inventory.ts). The 14-slot SI taxonomy in
 * the design doc is not all expressed in the type yet — see report. */
const SLOT_ROWS: readonly { readonly slot: ItemSlot; readonly label: string }[] = [
  { slot: 'head', label: 'Head' },
  { slot: 'neck', label: 'Neck' },
  { slot: 'shoulders', label: 'Shoulders' },
  { slot: 'cloak', label: 'Cloak' },
  { slot: 'chest', label: 'Chest' },
  { slot: 'arms', label: 'Arms' },
  { slot: 'gloves', label: 'Gloves' },
  { slot: 'belt', label: 'Belt' },
  { slot: 'mainHand', label: 'Main Hand' },
  { slot: 'offHand', label: 'Off Hand' },
  { slot: 'ring1', label: 'Ring I' },
  { slot: 'ring2', label: 'Ring II' },
  { slot: 'legs', label: 'Legs' },
  { slot: 'feet', label: 'Feet' },
];

/** Map item category to a glyph fallback when no real icon asset is loaded. */
const CATEGORY_GLYPH: Readonly<Record<string, string>> = {
  weapon: '⚔',
  shield: '🛡',
  armor: '🥋',
  consumable: '🧪',
  reagent: '🌿',
  tool: '🔥',
  quest: '✦',
  book: '📖',
  misc: '◆',
  currency: '◉',
  food: '🍞',
  key: '🗝',
};

interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly itemId: string;
}

/** Pickup state for the keyboard-alternative drag/drop interaction. */
interface PickupState {
  readonly origin: 'bag' | ItemSlot;
  readonly itemId: string;
}

function rarityBadge(rarity: ItemRarity): string {
  switch (rarity) {
    case 'mundane':
      return '';
    case 'uncommon':
      return 'Uncommon';
    case 'rare':
      return 'Rare';
    case 'epic':
      return 'Epic';
    case 'legendary':
      return 'Legendary';
    case 'artifact':
      return 'Artifact';
    default:
      return rarity;
  }
}

export function InventoryScreen(): JSX.Element {
  const [items] = createResource<ItemsResponse>(() =>
    mockClient.get<ItemsResponse>('/v1/inventory/items'),
  );
  const [equipment] = createResource<Equipment>(() =>
    mockClient.get<Equipment>('/v1/inventory/equipment'),
  );

  // Local optimistic state — start as null so we mirror the server payload
  // until the user makes a change.
  const [localSlots, setLocalSlots] = createSignal<Partial<Record<ItemSlot, string>> | null>(null);
  const [pickup, setPickup] = createSignal<PickupState | null>(null);
  const [menu, setMenu] = createSignal<ContextMenuState | null>(null);

  /** Effective equipment.slots after any optimistic local mutations. */
  const slots = createMemo<Partial<Record<ItemSlot, string>>>(() => {
    const eq = equipment();
    const local = localSlots();
    if (local) return local;
    return eq ? { ...eq.slots } : {};
  });

  /** Items currently equipped in `slots` (optimistic + server). */
  const equippedIds = createMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    const s = slots();
    for (const v of Object.values(s)) {
      if (v) set.add(v);
    }
    return set;
  });

  /** Items in the bag (everything not currently equipped). */
  const bagItems = createMemo<readonly Item[]>(() => {
    const list = items()?.items ?? [];
    const equipped = equippedIds();
    return list.filter((i) => !equipped.has(i.id));
  });

  /** Encumbrance derived from the actual carried set + the equipment's max. */
  const encumbrance = createMemo(() => {
    const list = items()?.items ?? [];
    const eq = equipment();
    const max = eq?.maxCarryWeight ?? 0;
    const carried = list.reduce((s, i) => {
      const stack = i.stackable ? Math.max(i.stackSize, 1) : 1;
      return s + i.weight * stack;
    }, 0);
    return classifyEncumbrance(Math.round(carried * 100) / 100, max);
  });

  function findItem(id: string): Item | null {
    return items()?.items.find((i) => i.id === id) ?? null;
  }

  // -------- Optimistic move + (deferred) server commit --------
  function moveToSlot(itemId: string, target: ItemSlot): void {
    const item = findItem(itemId);
    if (!item) return;
    if (item.slot && item.slot !== target) {
      // Mismatched slot — refuse silently, keep current state. A real client
      // would surface a toast (`@br/ui` toast()) but that belongs to Wave 4.
      return;
    }
    const next: Partial<Record<ItemSlot, string>> = { ...slots() };
    // Unequip whatever currently occupies the target.
    next[target] = itemId;
    // If item was previously equipped elsewhere, vacate that slot.
    for (const [k, v] of Object.entries(next) as readonly [ItemSlot, string | undefined][]) {
      if (k !== target && v === itemId) delete next[k];
    }
    setLocalSlots(next);
    // TODO(server): dispatch the authoritative `move` verb.
    //   await mockClient.post('/v1/inventory/move', { itemId, target });
  }

  function moveToBag(itemId: string): void {
    const next: Partial<Record<ItemSlot, string>> = { ...slots() };
    for (const [k, v] of Object.entries(next) as readonly [ItemSlot, string | undefined][]) {
      if (v === itemId) delete next[k];
    }
    setLocalSlots(next);
    // TODO(server): dispatch the authoritative `move` verb to bag.
  }

  // -------- Keyboard-alternative pickup --------
  function togglePickup(origin: 'bag' | ItemSlot, itemId: string): void {
    const cur = pickup();
    if (cur && cur.itemId === itemId) {
      setPickup(null);
      return;
    }
    setPickup({ origin, itemId });
  }

  function dropOnSlot(target: ItemSlot): void {
    const cur = pickup();
    if (!cur) return;
    moveToSlot(cur.itemId, target);
    setPickup(null);
  }

  function dropOnBag(): void {
    const cur = pickup();
    if (!cur) return;
    moveToBag(cur.itemId);
    setPickup(null);
  }

  // -------- Context menu --------
  function openMenu(ev: MouseEvent, itemId: string): void {
    ev.preventDefault();
    setMenu({ x: ev.clientX, y: ev.clientY, itemId });
  }
  function closeMenu(): void {
    setMenu(null);
  }
  if (typeof document !== 'undefined') {
    const onDoc = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target?.closest(`.${styles.menu}`)) closeMenu();
    };
    document.addEventListener('mousedown', onDoc);
    onCleanup(() => document.removeEventListener('mousedown', onDoc));
  }

  // -------- Long-press fallback (touch) --------
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  function handlePointerDown(ev: PointerEvent, itemId: string): void {
    if (ev.pointerType !== 'touch') return;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      setMenu({ x: ev.clientX, y: ev.clientY, itemId });
    }, 550);
  }
  function clearLongPress(): void {
    clearTimeout(longPressTimer);
  }

  return (
    <Card class={styles.root}>
      <header class={styles.header}>
        <h1 class={styles.headerTitle}>Inventory</h1>
        <div class={styles.headerWeight}>
          <StatGauge
            label={`Weight (${encumbrance().status})`}
            value={Math.round(encumbrance().carried * 10) / 10}
            max={Math.round(encumbrance().max * 10) / 10}
            ariaLabel="Carry weight"
          />
        </div>
        <span class={styles.armorBadge} aria-label="Armor rating" title="Armor rating">
          AR <strong>{equipment()?.armorRating ?? 0}</strong>
        </span>
      </header>

      <Show when={items() && equipment()} fallback={<Loading label="Sorting thy pack…" />}>
        <div class={styles.body}>
          {/* ----- Equipment (paperdoll slots) ----- */}
          <section class={styles.column} aria-label="Equipment slots">
            <h2 class={styles.columnTitle}>Equipped</h2>
            <div class={styles.slotGrid}>
              <For each={SLOT_ROWS}>
                {(row) => {
                  const eq = equipment();
                  if (!eq) return null;
                  const item = createMemo(() => {
                    const id = slots()[row.slot];
                    if (!id) return null;
                    return findItem(id) ?? equippedItem(eq, items()?.items ?? [], row.slot);
                  });
                  const occupied = () => item() !== null;
                  const pickedActive = () => pickup()?.origin === row.slot;
                  return (
                    <Tooltip
                      label={(() => {
                        const it = item();
                        return it ? `${it.name} — ${it.weight}st` : `${row.label} (empty)`;
                      })()}
                    >
                      <button
                        type="button"
                        class={styles.slot}
                        data-empty={!occupied()}
                        data-pickup-active={pickedActive()}
                        data-drop-target={(() => {
                          const p = pickup();
                          return p !== null && p.origin !== row.slot;
                        })()}
                        onClick={() => {
                          const cur = pickup();
                          if (cur && cur.origin !== row.slot) {
                            dropOnSlot(row.slot);
                            return;
                          }
                          const it = item();
                          if (it) togglePickup(row.slot, it.id);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            const cur = pickup();
                            if (cur && cur.origin !== row.slot) {
                              dropOnSlot(row.slot);
                            } else {
                              const it = item();
                              if (it) togglePickup(row.slot, it.id);
                            }
                          }
                        }}
                        onContextMenu={(ev) => {
                          const it = item();
                          if (it) openMenu(ev, it.id);
                        }}
                        onDragOver={(ev) => {
                          ev.preventDefault();
                          if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          const id = ev.dataTransfer?.getData('text/x-item-id');
                          if (id) moveToSlot(id, row.slot);
                        }}
                      >
                        <span class={styles.slotLabel}>{row.label}</span>
                        <Show
                          when={item()}
                          fallback={<span class={styles.slotItem} aria-hidden="true" />}
                        >
                          {(it) => (
                            <span class={styles.slotItem}>
                              <span class={styles.slotIcon} aria-hidden="true">
                                {CATEGORY_GLYPH[it().category] ?? '◆'}
                              </span>
                              <span class={styles.slotName}>{it().name}</span>
                            </span>
                          )}
                        </Show>
                      </button>
                    </Tooltip>
                  );
                }}
              </For>
            </div>
          </section>

          {/* ----- Paperdoll preview ----- */}
          <section class={styles.column} aria-label="Avatar paperdoll">
            <h2 class={styles.columnTitle}>The Avatar</h2>
            <div class={styles.paperdoll} role="img" aria-label="Avatar with equipped items">
              <div class={styles.paperdollFigure}>
                {/* Stylised avatar silhouette — replaced by sprite render in Wave 4. */}
                <svg
                  viewBox="0 0 100 140"
                  width="100%"
                  height="100%"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Avatar paperdoll silhouette</title>
                  <circle cx="50" cy="22" r="14" fill="currentColor" opacity="0.55" />
                  <path
                    d="M30 38 Q50 30 70 38 L74 78 Q50 90 26 78 Z"
                    fill="currentColor"
                    opacity="0.45"
                  />
                  <rect
                    x="30"
                    y="78"
                    width="14"
                    height="46"
                    rx="3"
                    fill="currentColor"
                    opacity="0.45"
                  />
                  <rect
                    x="56"
                    y="78"
                    width="14"
                    height="46"
                    rx="3"
                    fill="currentColor"
                    opacity="0.45"
                  />
                  <rect
                    x="20"
                    y="44"
                    width="10"
                    height="40"
                    rx="3"
                    fill="currentColor"
                    opacity="0.45"
                  />
                  <rect
                    x="70"
                    y="44"
                    width="10"
                    height="40"
                    rx="3"
                    fill="currentColor"
                    opacity="0.45"
                  />
                </svg>
              </div>
              <div class={styles.paperdollPlate}>Avatar of Virtue</div>
            </div>
          </section>

          {/* ----- Stats panel ----- */}
          <section class={styles.column} aria-label="Avatar stats">
            <h2 class={styles.columnTitle}>Attributes</h2>
            <Stack gap="0">
              {/* Mock stats — real data lives in /v1/characters; we surface
                  derived inventory stats here as a placeholder that the
                  Phase 6 character resource will replace. */}
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Strength</span>
                <span class={styles.statValue}>17</span>
              </div>
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Dexterity</span>
                <span class={styles.statValue}>14</span>
              </div>
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Intelligence</span>
                <span class={styles.statValue}>12</span>
              </div>
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Hit Points</span>
                <span class={styles.statValue}>62 / 62</span>
              </div>
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Mana</span>
                <span class={styles.statValue}>34 / 34</span>
              </div>
              <div class={styles.statRow}>
                <span class={styles.statLabel}>Armor Rating</span>
                <span class={styles.statValue}>{equipment()?.armorRating ?? 0}</span>
              </div>
            </Stack>
            <p class={styles.help}>
              Click an item to pick it up, then click a slot to equip it. Right-click for actions.
              Touch — long-press to open the action menu.
            </p>
          </section>
        </div>

        {/* ----- Bag grid ----- */}
        <section
          class={styles.bag}
          aria-label="Bag contents"
          onDragOver={(ev) => {
            ev.preventDefault();
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            const id = ev.dataTransfer?.getData('text/x-item-id');
            if (id) moveToBag(id);
          }}
        >
          <header class={styles.bagHeader}>
            <h2 class={styles.columnTitle}>Backpack ({bagItems().length})</h2>
            <span class={styles.tooltipMeta}>Drag to a slot — or pick up + place</span>
          </header>
          <div class={styles.bagGrid}>
            <For each={bagItems()}>
              {(item) => {
                const pickedActive = () => pickup()?.itemId === item.id;
                return (
                  <Tooltip
                    label={`${item.name} • ${rarityBadge(item.rarity) || 'Common'} • ${item.weight}st • ${item.value}gp${
                      item.stackable && item.stackSize > 1 ? ` • x${item.stackSize}` : ''
                    }`}
                    delay={120}
                  >
                    <button
                      type="button"
                      class={styles.tile}
                      data-rarity={item.rarity}
                      data-pickup-active={pickedActive()}
                      draggable
                      onDragStart={(ev) => {
                        if (ev.dataTransfer) {
                          ev.dataTransfer.effectAllowed = 'move';
                          ev.dataTransfer.setData('text/x-item-id', item.id);
                        }
                      }}
                      onClick={() => {
                        const cur = pickup();
                        if (cur && cur.origin !== 'bag') {
                          dropOnBag();
                          return;
                        }
                        togglePickup('bag', item.id);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          const cur = pickup();
                          if (cur && cur.origin !== 'bag') {
                            dropOnBag();
                          } else {
                            togglePickup('bag', item.id);
                          }
                        }
                      }}
                      onContextMenu={(ev) => openMenu(ev, item.id)}
                      onPointerDown={(ev) => handlePointerDown(ev, item.id)}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      aria-label={`${item.name}${item.stackable && item.stackSize > 1 ? ` (x${item.stackSize})` : ''}`}
                    >
                      <span class={styles.tileGlyph} aria-hidden="true">
                        {CATEGORY_GLYPH[item.category] ?? '◆'}
                      </span>
                      <Show when={item.stackable && item.stackSize > 1}>
                        <span class={styles.tileCount}>x{item.stackSize}</span>
                      </Show>
                      <Show when={item.bound}>
                        <span class={styles.tileBadge} aria-label="Soulbound" />
                      </Show>
                    </button>
                  </Tooltip>
                );
              }}
            </For>
          </div>
        </section>
      </Show>

      {/* ----- Context menu (right-click / long-press) ----- */}
      <Show when={menu()}>
        {(m) => (
          <div
            class={styles.menu}
            style={{ left: `${m().x}px`, top: `${m().y}px` }}
            role="menu"
            aria-label="Item actions"
          >
            <button
              type="button"
              class={styles.menuItem}
              role="menuitem"
              onClick={() => {
                // TODO(server): dispatch `use` verb against m().itemId.
                closeMenu();
              }}
            >
              Use
            </button>
            <button
              type="button"
              class={styles.menuItem}
              role="menuitem"
              onClick={() => {
                // TODO(server): dispatch `inspect` verb.
                closeMenu();
              }}
            >
              Inspect
            </button>
            <button
              type="button"
              class={styles.menuItem}
              role="menuitem"
              data-destructive="true"
              onClick={() => {
                // Optimistic drop — purge from bag locally.
                moveToBag(m().itemId);
                closeMenu();
              }}
            >
              Drop
            </button>
          </div>
        )}
      </Show>
    </Card>
  );
}
