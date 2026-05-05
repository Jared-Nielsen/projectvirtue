// `/play/journal` — quest log + lore tabs (9-4-Journal.png).
//
// Concept-art interpretation: top tabs (Quests / Notes / Lore / Bestiary /
// Factions / Tutorials), three-pane Quests view (active list / detail /
// notes), grid view for the Codex tabs. Factions and Tutorials in the art
// have no mock data backing — we render placeholder copy with a flag.

import type { CodexEntry, JournalEntry, Quest } from '@br/types';
import { Card, Stack, Tab, TabList, TabPanel, Tabs, WindowFrame } from '@br/ui';
import { A, useNavigate } from '@solidjs/router';
import { For, type JSX, Show, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './Journal.module.css';
import { groupQuestsByState } from './journal.helpers';

interface QuestsPayload {
  readonly quests: readonly Quest[];
}
interface JournalPayload {
  readonly entries: readonly JournalEntry[];
}
interface CodexPayload {
  readonly entries: readonly CodexEntry[];
}

export function Journal(): JSX.Element {
  const navigate = useNavigate();

  const [active] = createResource<QuestsPayload>(() =>
    mockClient.get<QuestsPayload>('/v1/quests/active'),
  );
  const [log] = createResource<QuestsPayload>(() =>
    mockClient.get<QuestsPayload>('/v1/quests/log'),
  );
  const [entries] = createResource<JournalPayload>(() =>
    mockClient.get<JournalPayload>('/v1/journal'),
  );
  const [codex] = createResource<CodexPayload>(() =>
    mockClient.get<CodexPayload>('/v1/books/codex'),
  );

  const grouped = createMemo(() => {
    const everything = [...(active()?.quests ?? []), ...(log()?.quests ?? [])];
    // Dedup by id; prefer the entry from `active` (more current state).
    const seen = new Set<string>();
    const merged: Quest[] = [];
    for (const q of everything) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      merged.push(q);
    }
    return groupQuestsByState(merged);
  });

  const [selected, setSelected] = createSignal<string | null>(null);

  const detail = createMemo<Quest | undefined>(() => {
    const id = selected();
    if (!id) {
      return grouped().active[0] ?? grouped().completed[0];
    }
    return [
      ...grouped().active,
      ...grouped().completed,
      ...grouped().failed,
      ...grouped().abandoned,
    ].find((q) => q.id === id);
  });

  const detailNotes = createMemo<readonly JournalEntry[]>(() => {
    const all = entries()?.entries ?? [];
    if (!detail()) return all;
    return all.filter((e) => e.questId === detail()?.id || !e.questId);
  });

  return (
    <Suspense fallback={<p>Unfurling the journal…</p>}>
      <WindowFrame title="Journal" onClose={() => navigate('/play')}>
        <Card>
          <div class={styles.shell}>
            <h1 class={styles.headline}>Journal</h1>

            <Tabs defaultValue="quests">
              <TabList aria-label="Journal tabs">
                <Tab value="quests">Quests</Tab>
                <Tab value="notes">Notes</Tab>
                <Tab value="lore">Lore</Tab>
                <Tab value="bestiary">Bestiary</Tab>
                <Tab value="factions">Factions</Tab>
                <Tab value="tutorials">Tutorials</Tab>
              </TabList>

              <TabPanel value="quests">
                <div class={styles.questPanes}>
                  <aside class={styles.list} aria-label="Quest list">
                    <Show when={grouped().active.length > 0}>
                      <h3 class={styles.listSection}>Active</h3>
                      <For each={grouped().active}>
                        {(q) => (
                          <button
                            type="button"
                            class={`${styles.listItem}${
                              detail()?.id === q.id ? ` ${styles.active}` : ''
                            }`}
                            onClick={() => setSelected(q.id)}
                            aria-pressed={detail()?.id === q.id ? 'true' : 'false'}
                          >
                            <span class={styles.listTitle}>{q.title.en}</span>
                            <span class={styles.listSub}>
                              Lvl {q.recommendedLevel} · {q.giver}
                            </span>
                            <span class={styles.virtueRow}>
                              <For each={q.virtueTags}>
                                {(v) => <span class={styles.virtuePill}>{v}</span>}
                              </For>
                            </span>
                          </button>
                        )}
                      </For>
                    </Show>

                    <Show when={grouped().completed.length > 0}>
                      <h3 class={styles.listSection}>Completed</h3>
                      <For each={grouped().completed}>
                        {(q) => (
                          <button
                            type="button"
                            class={`${styles.listItem}${
                              detail()?.id === q.id ? ` ${styles.active}` : ''
                            }`}
                            onClick={() => setSelected(q.id)}
                          >
                            <span class={styles.listTitle}>{q.title.en}</span>
                            <span class={styles.listSub}>{q.giver}</span>
                          </button>
                        )}
                      </For>
                    </Show>

                    <Show when={grouped().failed.length > 0}>
                      <h3 class={styles.listSection}>Failed</h3>
                      <For each={grouped().failed}>
                        {(q) => (
                          <button
                            type="button"
                            class={`${styles.listItem}${
                              detail()?.id === q.id ? ` ${styles.active}` : ''
                            }`}
                            onClick={() => setSelected(q.id)}
                          >
                            <span class={styles.listTitle}>{q.title.en}</span>
                            <span class={styles.listSub}>{q.giver}</span>
                          </button>
                        )}
                      </For>
                    </Show>
                  </aside>

                  <article class={styles.detail} aria-live="polite">
                    <Show
                      when={detail()}
                      fallback={<p style={{ opacity: 0.7 }}>Select a quest to read its tale.</p>}
                    >
                      {(q) => (
                        <>
                          <p class={styles.detailKicker}>
                            {q().state} · level {q().recommendedLevel} ·{' '}
                            {q().regionId.replace(/^region_/, '')}
                          </p>
                          <h2 class={styles.detailTitle}>{q().title.en}</h2>
                          <p class={styles.detailBody}>"{q().summary.en}"</p>
                          <Show when={q().objectives.length > 0}>
                            <ul class={styles.objectiveList} aria-label="Objectives">
                              <For each={q().objectives}>
                                {(o) => (
                                  <li class={styles.objectiveRow} data-status={o.status}>
                                    <span aria-hidden="true">
                                      {o.status === 'completed'
                                        ? '✓'
                                        : o.status === 'failed'
                                          ? '✗'
                                          : '·'}
                                    </span>
                                    <span class={styles.objectiveText}>
                                      {o.description.en}
                                      <Show when={o.optional}>
                                        <span
                                          style={{
                                            opacity: 0.6,
                                            'margin-left': '0.5rem',
                                            'font-size': '0.8rem',
                                          }}
                                        >
                                          (optional)
                                        </span>
                                      </Show>
                                    </span>
                                    <span class={styles.objectiveProgress}>
                                      {o.progress}/{o.target}
                                    </span>
                                  </li>
                                )}
                              </For>
                            </ul>
                          </Show>

                          <div class={styles.rewards} aria-label="Rewards">
                            <span class={styles.rewardTag}>{q().rewards.experience} xp</span>
                            <span class={styles.rewardTag}>{q().rewards.gold} gp</span>
                            <For each={q().rewards.items}>
                              {(item) => <span class={styles.rewardTag}>{itemLabel(item)}</span>}
                            </For>
                            <For each={Object.entries(q().rewards.virtueDeltas)}>
                              {([virtue, delta]) => (
                                <span class={styles.rewardTag}>
                                  {virtue} {delta && delta > 0 ? '+' : ''}
                                  {delta}
                                </span>
                              )}
                            </For>
                          </div>
                        </>
                      )}
                    </Show>
                  </article>

                  <aside class={styles.notes} aria-label="Quest notes">
                    <h3 class={styles.notesHead}>Quest Notes</h3>
                    <For
                      each={detailNotes()}
                      fallback={<p style={{ opacity: 0.7 }}>No notes yet.</p>}
                    >
                      {(e) => (
                        <Stack gap="1">
                          <h4
                            style={{
                              margin: 0,
                              'font-size': '0.95rem',
                              color: 'var(--br-color-sigil-200, #f4cc66)',
                            }}
                          >
                            {e.title}
                          </h4>
                          <p class={styles.note}>{e.body}</p>
                          <p class={styles.noteAuthor}>
                            {new Date(e.recordedAt).toLocaleDateString()} · {e.category}
                          </p>
                        </Stack>
                      )}
                    </For>
                  </aside>
                </div>
              </TabPanel>

              <TabPanel value="notes">
                <Stack gap="3">
                  <For each={entries()?.entries ?? []}>
                    {(e) => (
                      <article class={styles.codexCard}>
                        <h3 class={styles.codexTitle}>{e.title}</h3>
                        <span class={styles.codexCategory}>{e.category}</span>
                        <p class={styles.codexExcerpt}>{e.body}</p>
                        <p class={styles.noteAuthor}>{new Date(e.recordedAt).toLocaleString()}</p>
                      </article>
                    )}
                  </For>
                </Stack>
              </TabPanel>

              <TabPanel value="lore">
                <CodexGrid
                  entries={(codex()?.entries ?? []).filter((e) => isLoreCategory(e.category))}
                />
              </TabPanel>

              <TabPanel value="bestiary">
                <CodexGrid
                  entries={(codex()?.entries ?? []).filter((e) => e.category === 'bestiary')}
                />
              </TabPanel>

              <TabPanel value="factions">
                <p style={{ opacity: 0.65, 'font-style': 'italic' }}>
                  Factions are not yet stitched into the journal. Check back after the next
                  moon-tide.
                </p>
              </TabPanel>

              <TabPanel value="tutorials">
                <p style={{ opacity: 0.65, 'font-style': 'italic' }}>
                  Tutorials will appear here as you encounter new game mechanics.
                </p>
              </TabPanel>
            </Tabs>
          </div>
        </Card>
      </WindowFrame>
    </Suspense>
  );
}

function isLoreCategory(c: CodexEntry['category']): boolean {
  return c === 'lore' || c === 'history' || c === 'cartography' || c === 'arcana' || c === 'virtue';
}

function itemLabel(itemId: string): string {
  return itemId.replace(/^item_/, '').replace(/_/g, ' ');
}

interface CodexGridProps {
  readonly entries: readonly CodexEntry[];
}

function CodexGrid(props: CodexGridProps): JSX.Element {
  return (
    <div class={styles.codexGrid}>
      <For each={props.entries}>
        {(e) => (
          <article class={`${styles.codexCard}${e.discovered ? '' : ` ${styles.locked}`}`}>
            <h3 class={styles.codexTitle}>{e.discovered ? e.title : 'Unknown'}</h3>
            <span class={styles.codexCategory}>{e.category}</span>
            <p class={styles.codexExcerpt}>
              {e.discovered ? e.excerpt : 'You have not discovered this entry yet.'}
            </p>
            <Show when={e.discovered && e.bookId}>
              <A href={`/play/book/${e.bookId}`} class={styles.codexBookLink}>
                Read in full
              </A>
            </Show>
          </article>
        )}
      </For>
    </div>
  );
}
