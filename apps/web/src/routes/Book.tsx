// `/play/book/:bookId` — book reader (9-5-ReadBook.png).
//
// Concept-art interpretation: parchment two-page spread with chapter list
// rail, illuminated drop-cap on the first page of a chapter, page-turn
// arrows below, and a "lore citations" panel below the spread that links
// to the codex (the art's chapter-jump ribbons on the right). Page-turn
// animation respects reduced motion preference automatically — we use a
// pure cross-fade rather than a 3D flip.

import type { Book as BookEntity } from '@br/types';
import { Button, Card, Cluster, Stack, WindowFrame } from '@br/ui';
import { useNavigate, useParams } from '@solidjs/router';
import { For, type JSX, Show, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './Book.module.css';
import { pageWindow, totalSpreads } from './book.helpers';

export function Book(): JSX.Element {
  const params = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const [book] = createResource<BookEntity>(() =>
    mockClient.get<BookEntity>(`/v1/books/${params.bookId}`),
  );

  const [spread, setSpread] = createSignal(0);

  const total = createMemo(() => totalSpreads(book()?.pages.length ?? 0));
  const visible = createMemo(() => pageWindow(book()?.pages ?? [], spread()));

  function go(delta: number): void {
    setSpread((cur) => Math.max(0, Math.min(total() - 1, cur + delta)));
  }

  return (
    <Suspense fallback={<p>Turning the cover…</p>}>
      <WindowFrame title={book()?.title ?? 'Book'} onClose={() => navigate('/play')}>
        <Card>
          <div class={styles.shell}>
            <h1 class={styles.headline}>Ancient Text</h1>

            <aside class={styles.aside} aria-label="Chapters">
              <h2 class={styles.asideHead}>Contents</h2>
              <For each={book()?.pages ?? []}>
                {(p, idx) => (
                  <button
                    type="button"
                    class={`${styles.chapter}${
                      Math.floor(idx() / 2) === spread() ? ` ${styles.active}` : ''
                    }`}
                    onClick={() => setSpread(Math.floor(idx() / 2))}
                  >
                    <span class={styles.chapterIndex}>
                      {romanNumeral(idx() + 1)} · pg {idx() + 1}
                    </span>
                    <span class={styles.chapterTitle}>{p.heading ?? `Page ${idx() + 1}`}</span>
                  </button>
                )}
              </For>
            </aside>

            <div class={styles.bookFrame}>
              <article class={styles.spread} aria-live="polite">
                <div class={styles.pages}>
                  <div class={styles.page}>
                    <Show when={visible().left}>
                      {(p) => (
                        <>
                          <Show when={p().heading}>
                            <h2 class={styles.pageHeading}>{p().heading}</h2>
                          </Show>
                          <p class={`${styles.pageBody}${p().heading ? ` ${styles.dropCap}` : ''}`}>
                            {p().body}
                          </p>
                          <Show when={p().illustration}>
                            <div class={styles.illustrationFrame}>
                              <span>"{p().illustration}"</span>
                            </div>
                          </Show>
                        </>
                      )}
                    </Show>
                  </div>

                  <div class={styles.page}>
                    <Show when={visible().right}>
                      {(p) => (
                        <>
                          <Show when={p().heading}>
                            <h2 class={styles.pageHeading}>{p().heading}</h2>
                          </Show>
                          <p class={`${styles.pageBody}${p().heading ? ` ${styles.dropCap}` : ''}`}>
                            {p().body}
                          </p>
                          <Show when={p().illustration}>
                            <div class={styles.illustrationFrame}>
                              <span>"{p().illustration}"</span>
                            </div>
                          </Show>
                        </>
                      )}
                    </Show>
                  </div>
                </div>
                <div class={styles.pageNumber}>
                  Pages {spread() * 2 + 1}–{Math.min((spread() + 1) * 2, book()?.pages.length ?? 0)}{' '}
                  / {book()?.pages.length ?? 0}
                </div>
              </article>

              <div class={styles.controls}>
                <Button
                  variant="secondary"
                  onClick={() => go(-1)}
                  disabled={spread() === 0}
                  leadingIcon={<span aria-hidden="true">‹</span>}
                >
                  Previous
                </Button>
                <Cluster gap="3" align="center">
                  <span style={{ opacity: 0.7, 'font-size': '0.85rem' }}>
                    {book()?.author} · {book()?.era}
                  </span>
                </Cluster>
                <Button
                  onClick={() => go(1)}
                  disabled={spread() >= total() - 1}
                  trailingIcon={<span aria-hidden="true">›</span>}
                >
                  Next
                </Button>
              </div>

              <Show when={(book()?.tags ?? []).length > 0}>
                <Stack gap="2">
                  <div class={styles.citationPanel}>
                    <span class={styles.citationLabel}>Lore Citations</span>
                    Cited in the codex under: {(book()?.tags ?? []).join(', ')}.
                  </div>
                </Stack>
              </Show>
            </div>
          </div>
        </Card>
      </WindowFrame>
    </Suspense>
  );
}

function romanNumeral(n: number): string {
  const map: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [num, sym] of map) {
    while (v >= num) {
      out += sym;
      v -= num;
    }
  }
  return out;
}
