// Boss-encounter HUD — concept-art reference 2-6-DragonCombat.png.
//
// Header is a wide target frame variant fronted by the boss's name and a
// phase indicator (e.g. "Grounded — wing pinned"). The phase remaining-HP
// is shown as a sigil-gold pip strip above the health bar so the player
// can read both current HP and "fight progress".

import type { CombatState, Combatant } from '@br/types';
import { type JSX, Show, createMemo } from 'solid-js';
import { For } from 'solid-js';
import styles from './BossHud.module.css';
import { DamageFeed } from './DamageFeed';
import { TargetFrame } from './TargetFrame';
import shared from './hud-shared.module.css';

export interface BossHudProps {
  readonly state: CombatState;
}

export function BossHud(props: BossHudProps): JSX.Element {
  const boss = createMemo<Combatant | null>(() => {
    return props.state.participants.find((p) => p.faction === 'enemy') ?? null;
  });

  const phasePct = createMemo<number>(() => {
    const b = boss();
    const ph = props.state.phase;
    if (!b || !ph) return 100;
    if (b.hp.max <= 0) return 0;
    return Math.max(0, Math.min(100, (ph.remainingHp / b.hp.max) * 100));
  });

  return (
    <div class={shared.hudLayer}>
      <div class={`${shared.anchor} ${shared.topCenter} ${styles.bossHeader}`}>
        <Show when={boss()}>{(b) => <TargetFrame target={b()} variant="boss" />}</Show>
        <Show when={props.state.phase}>
          {(ph) => (
            <div class={styles.phase} aria-label="Boss phase">
              <span class={styles.phaseLabel}>{ph().label.en}</span>
              <div class={styles.phaseBar}>
                <div class={styles.phaseFill} style={{ width: `${phasePct()}%` }} />
              </div>
            </div>
          )}
        </Show>
      </div>

      <div class={`${shared.anchor} ${shared.bottomLeft}`}>
        <DamageFeed
          events={props.state.recentDamage}
          participants={props.state.participants}
          limit={20}
        />
      </div>

      <div class={`${shared.anchor} ${shared.topRight} ${shared.panel} ${styles.party}`}>
        <p class={styles.partyHead}>Combat Order</p>
        <ol class={styles.partyList}>
          <For each={props.state.participants.slice().sort((a, b) => b.initiative - a.initiative)}>
            {(p, idx) => (
              <li data-faction={p.faction}>
                <span class={styles.idx}>{idx() + 1}</span>
                <span class={styles.partyName}>{p.name}</span>
              </li>
            )}
          </For>
        </ol>
      </div>
    </div>
  );
}
