// Ability bar — concept-art reference 2-2-CombatForest.png + 2-6-DragonCombat.png.
//
// Hotbar of equipped abilities with hotkey labels (1-6 by default). Buttons
// are real <button> elements so they're keyboard-focusable and reachable
// via Tab; the hotkey listener fires the same handler. Cooldown overlay is
// a CSS gradient driven by a derived `cooldownPct` signal — for the mock
// data we treat all abilities as off-cooldown.

import type { Ability } from '@br/types';
import { type JSX, createMemo, onCleanup, onMount } from 'solid-js';
import { For } from 'solid-js';
import styles from './AbilityBar.module.css';
import shared from './hud-shared.module.css';

export interface AbilityBarProps {
  readonly abilities: readonly Ability[];
  readonly onSelect?: (ability: Ability) => void;
  /** Optional override of which slot is "active" — used to highlight queued. */
  readonly activeId?: string | undefined;
}

export function AbilityBar(props: AbilityBarProps): JSX.Element {
  const slots = createMemo(() => props.abilities.slice(0, 8));

  // TODO(player-intent): when the canvas accepts player commands (Wave 4),
  // forward the selected ability to the canvas EventTarget here.
  function fire(ab: Ability): void {
    props.onSelect?.(ab);
  }

  function onKeydown(ev: KeyboardEvent): void {
    if (ev.repeat || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    // Don't hijack hotkeys while typing in inputs.
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    const match = slots().find((a) => a.hotkey === ev.key);
    if (match) {
      ev.preventDefault();
      fire(match);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeydown);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKeydown);
  });

  return (
    <div
      class={`${shared.panel} ${styles.bar}`}
      role="toolbar"
      aria-label="Ability hotbar"
      data-testid="ability-bar"
    >
      <For each={slots()}>
        {(ab) => (
          <button
            type="button"
            class={`${styles.slot} ${props.activeId === ab.id ? styles.active : ''}`}
            title={`${ab.name.en}${ab.hotkey ? ` (${ab.hotkey})` : ''} — ${ab.description}`}
            aria-keyshortcuts={ab.hotkey}
            onClick={() => fire(ab)}
          >
            <span class={styles.glyph} aria-hidden="true">
              {ab.name.en.slice(0, 2)}
            </span>
            <span class={styles.label}>{ab.name.en}</span>
            <span class={styles.key} aria-hidden="true">
              {ab.hotkey ?? ''}
            </span>
          </button>
        )}
      </For>
    </div>
  );
}
