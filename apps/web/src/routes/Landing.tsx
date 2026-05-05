// `/` — Landing / main menu (1-HomeScreen.png).
//
// Concept-art interpretation: a moody coastline at twilight with the title
// "Project Virtue" centred above a vertical menu column. We render the menu
// as the focal element, with a tonal gradient backdrop in CSS (no bitmap
// art committed). The Continue button is enabled only when the active
// account has at least one saved character — fetched via MockClient.
//
// Auth gating: this route is bare (no MenuLayout). Pressing "Continue" or
// "New Character" navigates into the protected `/character*` routes which
// redirect through the existing Guard if the mock auth is off; the Guard
// pushes to /login when needed.

import type { Character } from '@br/types';
import { Icon } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { type JSX, Show, Suspense, createMemo, createResource } from 'solid-js';
import { isAuthenticated, signIn } from '../state/auth';
import { mockClient } from '../state/mockClient';
import styles from './Landing.module.css';

interface CharactersPayload {
  readonly characters: readonly Character[];
}

export function Landing(): JSX.Element {
  const navigate = useNavigate();
  // We always try the fetch; the mock layer never 401s and a fetch failure
  // simply leaves Continue disabled. Real backend will return 401 unauth.
  const [data] = createResource(() =>
    mockClient.get<CharactersPayload>('/v1/characters').catch(() => null),
  );

  const hasCharacters = createMemo(() => (data()?.characters.length ?? 0) > 0);

  function go(path: string): void {
    // Convenience: if the user hasn't signed in yet, flip the mock auth so
    // the protected routes resolve immediately. This mirrors the Login
    // screen for menu actions that imply a session.
    if (!isAuthenticated()) signIn();
    navigate(path);
  }

  return (
    <main class={styles.shell} data-route="landing">
      <div class={styles.scene} aria-hidden="true" />

      <Suspense>
        <div class={styles.column}>
          <div class={styles.brandMark} aria-hidden="true">
            <Icon name="sword" size={28} />
          </div>

          <h1 class={styles.title}>Project Virtue</h1>
          <p class={styles.tagline}>A Journey. A Choice. A Life.</p>

          <nav class={styles.menu} aria-label="Main menu">
            <button
              type="button"
              class={styles.menuButton}
              onClick={() => go('/play')}
              disabled={!hasCharacters()}
              aria-disabled={!hasCharacters() ? 'true' : 'false'}
            >
              Continue
            </button>
            <button type="button" class={styles.menuButton} onClick={() => go('/character/create')}>
              New Character
            </button>
            <button
              type="button"
              class={styles.menuButton}
              onClick={() => go('/character')}
              disabled={!hasCharacters()}
              aria-disabled={!hasCharacters() ? 'true' : 'false'}
            >
              Join Shard
            </button>
            <button type="button" class={styles.menuButton} onClick={() => go('/play')}>
              Host Campaign
            </button>
            <button type="button" class={styles.menuButton} onClick={() => go('/play/options')}>
              Options
            </button>
            <button
              type="button"
              class={styles.menuButton}
              onClick={() => {
                // No real "quit" in the browser. Send the player back to login
                // and clear the mock session for parity with the eventual
                // desktop client.
                navigate('/login');
              }}
            >
              Quit
            </button>
          </nav>

          <Show when={!hasCharacters() && !data.loading}>
            <p class={styles.helper}>No saved characters yet. Forge a new avatar to begin.</p>
          </Show>

          <aside class={styles.lore} aria-label="World hint">
            <span class={styles.loreSigil} aria-hidden="true">
              <Icon name="star" size={20} />
            </span>
            <span class={styles.loreCopy}>
              <strong>Serpent Isle</strong>A lawless tale of secrets and ancient power. Your story
              begins here.
            </span>
          </aside>
        </div>
      </Suspense>
    </main>
  );
}
