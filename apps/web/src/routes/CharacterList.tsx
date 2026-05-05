// `/character` — saved-avatar selector. Choose an existing character to
// bring into the world, or create a new one. Replaces the Phase 3
// placeholder JSON dump with a real card-based UI.

import type { Character } from '@br/types';
import { Button, Card, Loading, Stack } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { ErrorBoundary, For, type JSX, Show, Suspense, createResource } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './CharacterList.module.css';

interface CharactersPayload {
  readonly characters: readonly Character[];
}

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h played`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m played`;
}

function formatLastPlayed(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function CharacterList(): JSX.Element {
  const navigate = useNavigate();
  const [data] = createResource(() => mockClient.get<CharactersPayload>('/v1/characters'));

  return (
    <div class={styles.shell}>
      <header class={styles.head}>
        <h1 class={styles.title}>Choose your avatar</h1>
        <p class={styles.subtitle}>Step into Mythenor as one of your saved heroes.</p>
      </header>

      <ErrorBoundary
        fallback={(err) => (
          <div class={styles.errorPanel}>
            <p>The roster could not be retrieved.</p>
            <code>{String(err)}</code>
            <Button variant="secondary" onClick={() => navigate('/home')}>
              Back to home
            </Button>
          </div>
        )}
      >
        <Suspense fallback={<Loading label="Loading characters…" />}>
          <Show
            when={data()?.characters.length}
            fallback={
              <Card>
                <Stack gap="3" class={styles.emptyCard}>
                  <h2>No avatars yet</h2>
                  <p>Forge your first hero before you can step into the world.</p>
                  <Button variant="primary" onClick={() => navigate('/character/create')}>
                    Create a new avatar
                  </Button>
                </Stack>
              </Card>
            }
          >
            <ul class={styles.grid}>
              <For each={data()?.characters ?? []}>
                {(c) => (
                  <li class={styles.cell}>
                    <Card class={styles.card}>
                      <div class={styles.portrait} aria-hidden="true">
                        <span class={styles.initial}>{c.name.charAt(0)}</span>
                      </div>
                      <div class={styles.body}>
                        <h2 class={styles.name}>{c.name}</h2>
                        <Show when={c.publicTitle}>
                          <p class={styles.titleLine}>{c.publicTitle}</p>
                        </Show>
                        <p class={styles.meta}>
                          Level {c.level}
                          {' · '}
                          {c.race} {c.class}
                        </p>
                        <p class={styles.shardLine}>
                          {c.shardId.replace(/^shard_/, '').replace(/_/g, ' ')}
                        </p>
                        <p class={styles.lastPlayed}>
                          {formatLastPlayed(c.lastPlayedAt)}
                          {' · '}
                          {formatPlaytime(c.playtimeSeconds)}
                        </p>
                      </div>
                      <div class={styles.actions}>
                        <Button
                          variant="primary"
                          onClick={() => navigate('/play')}
                          aria-label={`Continue as ${c.name}`}
                        >
                          Continue
                        </Button>
                      </div>
                    </Card>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <div class={styles.footerRow}>
            <Button variant="secondary" onClick={() => navigate('/home')}>
              ← Back
            </Button>
            <Button variant="primary" onClick={() => navigate('/character/create')}>
              Create new avatar
            </Button>
          </div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
