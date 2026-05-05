// Damage feed — concept-art reference 2-2-CombatForest.png + 2-6-DragonCombat.png.
//
// Renders a chronological list of recent damage events. Two design intents:
//   1. Dedup adjacent identical entries (same source/target/type/amount) into
//      a single line with an "xN" suffix to keep the feed readable when the
//      tick rate is high. Pure function so it's easy to unit-test.
//   2. Color-code by damage type and crit so the player's eye finds the
//      meaningful events first.

import type { Combatant, DamageInstance, DamageType } from '@br/types';
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import styles from './DamageFeed.module.css';
import shared from './hud-shared.module.css';

export interface DamageFeedProps {
  readonly events: readonly DamageInstance[];
  readonly participants: readonly Combatant[];
  readonly limit?: number;
}

export interface FeedRow {
  readonly key: string;
  readonly text: string;
  readonly type: DamageType;
  readonly crit: boolean;
  readonly count: number;
}

/** Resolve an entityId → display name; fallback to the raw id if missing. */
function nameFor(participants: readonly Combatant[], id: string): string {
  for (const p of participants) {
    if (p.entityId === id) return p.name;
  }
  return id;
}

/** Pure: collapse identical adjacent rows into one with a count suffix. */
export function buildFeedRows(
  events: readonly DamageInstance[],
  participants: readonly Combatant[],
  limit = 12,
): readonly FeedRow[] {
  const out: FeedRow[] = [];
  for (const ev of events) {
    const sourceName = nameFor(participants, ev.source);
    const targetName = nameFor(participants, ev.target);
    const text = `${sourceName} hits ${targetName} for ${ev.amount} ${ev.type}${ev.crit ? '!' : ''}`;
    const last = out[out.length - 1];
    if (last && last.text === text && last.type === ev.type && last.crit === ev.crit) {
      out[out.length - 1] = { ...last, count: last.count + 1 };
      continue;
    }
    out.push({
      key: `${ev.tick}:${ev.source}:${ev.target}:${ev.amount}:${out.length}`,
      text,
      type: ev.type,
      crit: ev.crit,
      count: 1,
    });
  }
  // Tail-trim to the most recent `limit`.
  return out.length > limit ? out.slice(out.length - limit) : out;
}

function classFor(row: FeedRow): string {
  const parts: string[] = [shared.feedItem ?? ''];
  if (row.crit) parts.push(shared.feedCrit ?? '');
  if (row.type === 'fire') parts.push(shared.feedFire ?? '');
  else if (row.type === 'cold') parts.push(shared.feedCold ?? '');
  else if (row.type === 'holy') parts.push(shared.feedHoly ?? '');
  else if (row.type === 'poison' || row.type === 'physical') {
    parts.push(shared.feedDanger ?? '');
  }
  return parts.filter(Boolean).join(' ');
}

export function DamageFeed(props: DamageFeedProps): JSX.Element {
  const rows = (): readonly FeedRow[] =>
    buildFeedRows(props.events, props.participants, props.limit);
  return (
    <div
      class={`${shared.panel} ${shared.feed} ${styles.feed}`}
      role="log"
      aria-live="polite"
      aria-label="Combat log"
    >
      <For each={rows()}>
        {(row) => (
          <p class={classFor(row)}>
            {row.text}
            {row.count > 1 ? <span class={styles.count}> ×{row.count}</span> : null}
          </p>
        )}
      </For>
    </div>
  );
}
