// Target frame — concept-art reference 2-2-CombatForest.png.
//
// Shows the active target's name, faction-tinted health bar, and any
// active status effects. Announces the current target name via an
// aria-live region so screen readers track focus when the player swaps
// targets via canvas click. The aria-live region is visually hidden.

import type { Combatant, StatusEffect } from '@br/types';
import { HealthBar } from '@br/ui';
import { type JSX, Show } from 'solid-js';
import { For } from 'solid-js';
import styles from './TargetFrame.module.css';
import shared from './hud-shared.module.css';

export interface TargetFrameProps {
  readonly target: Combatant | null;
  /** Optional smaller layout (boss header uses the large variant via prop). */
  readonly variant?: 'compact' | 'boss';
}

/** Quick lookup of glyph + label for status effects so we keep DOM stable. */
const STATUS_GLYPHS: Record<StatusEffect, { readonly glyph: string; readonly label: string }> = {
  'on-fire': { glyph: '🔥', label: 'On fire' },
  poisoned: { glyph: '☠', label: 'Poisoned' },
  wet: { glyph: '💧', label: 'Wet' },
  paralyzed: { glyph: '⚡', label: 'Paralyzed' },
  invisible: { glyph: '◌', label: 'Invisible' },
  charmed: { glyph: '♥', label: 'Charmed' },
  sleeping: { glyph: '💤', label: 'Sleeping' },
  bleeding: { glyph: '🩸', label: 'Bleeding' },
};

export function TargetFrame(props: TargetFrameProps): JSX.Element {
  const variant = (): 'compact' | 'boss' => props.variant ?? 'compact';
  const t = (): Combatant | null => props.target;
  return (
    <div
      class={`${shared.panel} ${styles.frame} ${variant() === 'boss' ? styles.boss : styles.compact}`}
      data-faction={t()?.faction ?? 'none'}
    >
      <output class={shared.srOnly} aria-live="polite">
        <Show when={t()} fallback={<span>No target.</span>}>
          {(c) => <span>Target: {c().name}</span>}
        </Show>
      </output>
      <Show when={t()} fallback={<span class={styles.empty}>No target</span>}>
        {(c) => (
          <>
            <div class={styles.row}>
              <span class={styles.name}>{c().name}</span>
              <span class={styles.tick}>AR {c().armorRating}</span>
            </div>
            <HealthBar value={c().hp.current} max={c().hp.max} />
            <Show when={c().statusEffects.length > 0}>
              <ul class={styles.status} aria-label="Status effects">
                <For each={c().statusEffects}>
                  {(s) => {
                    const e = STATUS_GLYPHS[s];
                    return (
                      <li class={styles.statusChip} title={e.label}>
                        <span aria-hidden="true">{e.glyph}</span>
                        <span class={shared.srOnly}>{e.label}</span>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
