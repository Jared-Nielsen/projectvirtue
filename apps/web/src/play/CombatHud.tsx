// Combat HUD overlay — concept-art reference 2-2-CombatForest.png.
//
// Composes the in-world combat layer:
//   • Top-center region banner (e.g. "Silverwood Forest")
//   • Top-right active-quest panel (mock data; reads /v1/quests/active)
//   • Top-left target frame (auto-targets the highest-initiative enemy)
//   • Bottom-left damage feed
//   • Bottom-center ability bar (hotkeys 1-6)
//   • Bottom-right minimap thumbnail
//
// Pulls combat state via createResource so the Suspense boundary inside
// PlayLayout shows the @br/ui Loading component while the mock latency
// resolves.

import type { Ability, CombatState, Combatant, Quest, Spell } from '@br/types';
import { MinimapPlaceholder } from '@br/ui';
import { type JSX, Show, createMemo, createResource, createSignal } from 'solid-js';
import { For } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { AbilityBar } from './AbilityBar';
import styles from './CombatHud.module.css';
import { DamageFeed } from './DamageFeed';
import { SpellRing } from './SpellRing';
import { TargetFrame } from './TargetFrame';
import shared from './hud-shared.module.css';

export interface CombatHudProps {
  /** Region label rendered in the top-center banner. */
  readonly regionLabel: string;
  /** Optional pre-fetched combat state (used by the Combat boss route). */
  readonly state?: CombatState;
}

interface QuestsPayload {
  readonly quests: readonly Quest[];
}
interface AbilitiesPayload {
  readonly abilities: readonly Ability[];
}

export function CombatHud(props: CombatHudProps): JSX.Element {
  const [state] = createResource<CombatState>(async () => {
    if (props.state) return props.state;
    return mockClient.get<CombatState>('/v1/combat/state');
  });
  const [abilities] = createResource(() =>
    mockClient.get<AbilitiesPayload>('/v1/combat/abilities'),
  );
  const [spellbook] = createResource(() =>
    mockClient.get<{ readonly spells: readonly Spell[]; readonly memorizedSlots: number }>(
      '/v1/combat/spellbook',
    ),
  );
  const [quests] = createResource(() => mockClient.get<QuestsPayload>('/v1/quests/active'));

  const target = createMemo<Combatant | null>(() => {
    const cs = state();
    if (!cs) return null;
    // Highest-initiative enemy is the implicit current target until the
    // canvas dispatches a click-target event (Wave 4 contract).
    const enemies = cs.participants.filter((p) => p.faction === 'enemy');
    enemies.sort((a, b) => b.initiative - a.initiative);
    return enemies[0] ?? null;
  });

  const player = createMemo<Combatant | null>(() => {
    const cs = state();
    if (!cs) return null;
    return cs.participants.find((p) => p.faction === 'player') ?? null;
  });

  const [castNotice, setCastNotice] = createSignal<string | null>(null);

  return (
    <div class={shared.hudLayer}>
      {/* Region banner */}
      <div class={`${shared.anchor} ${shared.topCenter}`}>
        <div class={shared.banner}>{props.regionLabel}</div>
        <Show when={state()}>
          {(s) => (
            <div class={shared.bannerSub}>
              {s().bossEncounter ? 'Boss encounter' : `Tick ${s().tick} · Turn ${s().turnIndex}`}
            </div>
          )}
        </Show>
      </div>

      {/* Active quests */}
      <div class={`${shared.anchor} ${shared.topRight} ${shared.panel} ${styles.questPanel}`}>
        <p class={styles.panelHead}>Active Quests</p>
        <Show when={quests()} fallback={<p class={styles.dim}>(none)</p>}>
          {(q) => (
            <ul class={styles.questList}>
              <For each={q().quests.slice(0, 4)}>
                {(quest) => (
                  <li>
                    <strong>{quest.title.en}</strong>
                    <Show when={quest.objectives[0]}>
                      {(obj) => <span class={styles.dim}> — {obj().description.en}</span>}
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          )}
        </Show>
      </div>

      {/* Target frame */}
      <div class={`${shared.anchor} ${shared.topLeft}`}>
        <TargetFrame target={target()} />
      </div>

      {/* Damage feed */}
      <Show when={state()}>
        {(s) => (
          <div class={`${shared.anchor} ${shared.bottomLeft}`}>
            <DamageFeed events={s().recentDamage} participants={s().participants} />
          </div>
        )}
      </Show>

      {/* Ability bar */}
      <div class={`${shared.anchor} ${shared.bottomCenter}`}>
        <Show when={abilities()}>
          {(a) => (
            <AbilityBar
              abilities={a().abilities}
              onSelect={(ab) => setCastNotice(`Queued: ${ab.name.en}`)}
            />
          )}
        </Show>
      </div>

      {/* Minimap thumbnail */}
      <div class={`${shared.anchor} ${shared.bottomRight} ${styles.minimap}`}>
        <MinimapPlaceholder label={`${props.regionLabel} minimap`} />
      </div>

      {/* Cast notice (transient) */}
      <Show when={castNotice()}>
        {(msg) => (
          <output class={`${shared.anchor} ${styles.castNotice}`} aria-live="polite">
            {msg()}
          </output>
        )}
      </Show>

      {/* Spell ring (Q to toggle) */}
      <Show when={spellbook() && player()}>
        {(_) => {
          const sb = spellbook();
          const pl = player();
          if (!sb || !pl) return null;
          return (
            <SpellRing
              spells={sb.spells}
              mana={pl.mana}
              onCast={(s) => setCastNotice(`Casting ${s.name.en}`)}
            />
          );
        }}
      </Show>
    </div>
  );
}
