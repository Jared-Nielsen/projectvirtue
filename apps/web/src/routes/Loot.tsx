// `/play/loot/:lootId` — chest contents grid (9-2-LootChest.png).
//
// Concept-art interpretation: dual-pane grid, chest on the left,
// destination inventory on the right; encumbrance bar at the top of the
// inventory pane; "Take all" / "Close" actions below. We render real loot
// from the mock; the right pane shows a static slim inventory (the real
// inventory screen is owned by Batch C).
//
// Hover/focus a slot to see its tooltip — the rarity colors map to the
// design tokens. Take-one removes the item from the chest pane and drops
// it into the local inventory list (mock — no server round trip yet).

import type { Item, LootContainer } from '@br/types';
import { Button, Card, Cluster, Stack, WindowFrame } from '@br/ui';
import { useNavigate, useParams } from '@solidjs/router';
import { For, type JSX, Show, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './Loot.module.css';

const PLAYER_MAX_WEIGHT = 120;

export function Loot(): JSX.Element {
  const params = useParams<{ lootId: string }>();
  const navigate = useNavigate();

  const [chest] = createResource<LootContainer>(() =>
    mockClient.get<LootContainer>(`/v1/inventory/loot/${params.lootId}`),
  );

  // Local optimistic state. `taken` lives in player inventory.
  const [taken, setTaken] = createSignal<readonly Item[]>([]);
  const [removed, setRemoved] = createSignal<ReadonlySet<string>>(new Set());

  const remaining = createMemo<readonly Item[]>(() => {
    const all = chest()?.itemsExpanded ?? [];
    return all.filter((i) => !removed().has(i.id));
  });

  const carriedWeight = createMemo<number>(() =>
    taken().reduce((sum, item) => sum + item.weight * Math.max(1, item.stackSize), 0),
  );

  const weightPct = createMemo(() =>
    Math.max(0, Math.min(100, Math.round((carriedWeight() / PLAYER_MAX_WEIGHT) * 100))),
  );

  function takeOne(item: Item): void {
    setTaken((cur) => [...cur, item]);
    setRemoved((cur) => new Set([...cur, item.id]));
  }

  function takeAll(): void {
    const items = chest()?.itemsExpanded ?? [];
    const fresh = items.filter((i) => !removed().has(i.id));
    setTaken((cur) => [...cur, ...fresh]);
    setRemoved((cur) => new Set([...cur, ...fresh.map((i) => i.id)]));
  }

  return (
    <Suspense fallback={<p>Prying the lid…</p>}>
      <WindowFrame title="Loot Container" onClose={() => navigate('/play')}>
        <Card>
          <div class={styles.shell}>
            <p style={{ margin: 0, opacity: 0.85 }}>
              You open the chest and take stock of its contents.
            </p>

            <div class={styles.panes}>
              {/* Chest pane */}
              <section class={styles.pane} aria-label="Chest contents">
                <header class={styles.paneHead}>
                  <h2 class={styles.paneTitle}>{chest()?.name ?? 'Chest'}</h2>
                  <span class={styles.paneMeta}>
                    {remaining().length}/{chest()?.capacity ?? 0} slots
                  </span>
                </header>
                <div class={styles.grid}>
                  <For each={Array.from({ length: chest()?.capacity ?? 12 })}>
                    {(_, i) => {
                      const item = createMemo<Item | undefined>(() => remaining()[i()]);
                      return (
                        <Show
                          when={item()}
                          fallback={<div class={`${styles.slot} ${styles.slotEmpty}`} />}
                        >
                          {(it) => (
                            <button
                              type="button"
                              class={styles.slot}
                              data-rarity={it().rarity}
                              onClick={() => takeOne(it())}
                              aria-label={`Take ${it().displayName.en}`}
                            >
                              <span class={styles.slotGlyph} aria-hidden="true">
                                {it().displayName.en.charAt(0)}
                              </span>
                              <Show when={it().stackable && it().stackSize > 1}>
                                <span class={styles.slotStack}>{it().stackSize}</span>
                              </Show>
                              <span class={styles.tooltip} role="tooltip">
                                <span class={styles.tooltipName}>{it().displayName.en}</span>
                                <span class={styles.tooltipDesc}>"{it().description}"</span>
                                <span class={styles.tooltipMeta}>
                                  {it().rarity} · {it().weight.toFixed(2)} st · {it().value}gp
                                </span>
                              </span>
                            </button>
                          )}
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </section>

              {/* Player inventory pane */}
              <section class={styles.pane} aria-label="Your inventory">
                <header class={styles.paneHead}>
                  <h2 class={styles.paneTitle}>Inventory</h2>
                  <span class={styles.paneMeta}>{taken().length}/24 used</span>
                </header>

                <Stack gap="1" class={styles.weightBar}>
                  <Cluster justify="space-between">
                    <span style={{ 'font-size': '0.8rem', opacity: 0.75 }}>Encumbrance</span>
                    <span class={styles.paneMeta}>
                      {carriedWeight().toFixed(2)}/{PLAYER_MAX_WEIGHT} st
                    </span>
                  </Cluster>
                  <div
                    class={styles.weightTrack}
                    role="progressbar"
                    tabIndex={0}
                    aria-label="Encumbrance"
                    aria-valuenow={carriedWeight()}
                    aria-valuemin={0}
                    aria-valuemax={PLAYER_MAX_WEIGHT}
                  >
                    <div class={styles.weightFill} style={{ width: `${weightPct()}%` }} />
                  </div>
                </Stack>

                <div class={styles.grid}>
                  <For each={Array.from({ length: 24 })}>
                    {(_, i) => {
                      const it = createMemo<Item | undefined>(() => taken()[i()]);
                      return (
                        <Show
                          when={it()}
                          fallback={<div class={`${styles.slot} ${styles.slotEmpty}`} />}
                        >
                          {(item) => (
                            <span class={styles.slot} data-rarity={item().rarity}>
                              <span class={styles.slotGlyph} aria-hidden="true">
                                {item().displayName.en.charAt(0)}
                              </span>
                              <Show when={item().stackable && item().stackSize > 1}>
                                <span class={styles.slotStack}>{item().stackSize}</span>
                              </Show>
                            </span>
                          )}
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </section>
            </div>

            <div class={styles.actions}>
              <Button variant="primary" onClick={takeAll} disabled={remaining().length === 0}>
                Take all
              </Button>
              <Button variant="ghost" onClick={() => navigate('/play')}>
                Close
              </Button>
            </div>
          </div>
        </Card>
      </WindowFrame>
    </Suspense>
  );
}
