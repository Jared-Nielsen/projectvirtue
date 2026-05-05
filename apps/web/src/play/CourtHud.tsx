// Throne-room HUD — concept-art reference 2-4-HoldingCourt.png.
//
// Shows the NPC roster panel on the right and an ambient crowd-chatter
// feed on the bottom-left — both filtered to the current court NPCs. The
// route flips into "court" mode via a Solid signal owned by the parent
// (Play.tsx), so this component is purely presentational.

import type { Npc } from '@br/types';
import { type JSX, Show, createMemo, createResource } from 'solid-js';
import { For } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './CourtHud.module.css';
import shared from './hud-shared.module.css';

export interface CourtHudProps {
  /** Region whose NPCs constitute the court (default: region_britain). */
  readonly regionId?: string;
}

interface NpcsPayload {
  readonly npcs: readonly Npc[];
}

/** Fixed mock chatter — production builds will pull from a court ambient feed. */
const CROWD_CHATTER: readonly string[] = [
  'You see Lord Ethos.',
  'You see a royal guard.',
  'King Ethos: "Welcome to Ardania."',
  'You: "I bring word from the council of Britain."',
  'King Ethos: "Then please, speak."',
  'A lutist plays softly in the gallery.',
  'Your virtue has increased: Honesty.',
];

export function CourtHud(props: CourtHudProps): JSX.Element {
  const region = (): string => props.regionId ?? 'region_britain';
  const [npcs] = createResource(() => mockClient.get<NpcsPayload>('/v1/world/npcs'));

  const courtiers = createMemo(() => {
    const list = npcs();
    if (!list) return [] as readonly Npc[];
    return list.npcs
      .filter((n) => n.regionId === region() && n.disposition !== 'hostile')
      .slice(0, 8);
  });

  return (
    <div class={shared.hudLayer}>
      <div class={`${shared.anchor} ${shared.topCenter}`}>
        <div class={shared.banner}>Court of Ardania</div>
        <div class={shared.bannerSub}>Holding court · 2nd day of Spring</div>
      </div>

      <div class={`${shared.anchor} ${shared.topRight} ${shared.panel} ${styles.roster}`}>
        <p class={styles.head}>Court Roster</p>
        <Show
          when={courtiers().length > 0}
          fallback={<p class={styles.empty}>The hall is empty.</p>}
        >
          <ul class={styles.list}>
            <For each={courtiers()}>
              {(n) => (
                <li>
                  <span class={styles.name}>{n.name}</span>
                  <span class={styles.title}>{n.title}</span>
                  <span class={styles.activity}>{n.currentActivity}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class={`${shared.anchor} ${shared.bottomLeft} ${shared.panel} ${shared.feed}`}>
        <p class={styles.head}>Crowd</p>
        <For each={CROWD_CHATTER}>
          {(line) => <p class={`${shared.feedItem} ${styles.line}`}>{line}</p>}
        </For>
      </div>
    </div>
  );
}
