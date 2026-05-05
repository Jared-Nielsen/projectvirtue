// `/play/levelup` — level-up celebration modal (9-3-ModalGainedALevel.png).
//
// Concept-art interpretation: hero "YOU GAINED A LEVEL" headline with a
// gilt level-N medallion, then two columns: stat allocation (one + per
// stat point) and learn-an-ability (single-pick, replaces "OR" divider in
// the art). Continue ships once the budget is spent.
//
// Wiring: `/v1/levelup/sample`. Apply is mock — no server call.

import type { LevelUpEvent, StatAllocation } from '@br/types';
import { Button, Card, Stack } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { For, type JSX, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './LevelUp.module.css';
import { STAT_KEYS, zeroStatAllocation } from './levelUp.helpers';

export function LevelUp(): JSX.Element {
  const navigate = useNavigate();
  const [event] = createResource<LevelUpEvent>(() =>
    mockClient.get<LevelUpEvent>('/v1/levelup/sample'),
  );

  const [alloc, setAlloc] = createSignal<StatAllocation>(zeroStatAllocation());
  const [pickedAbility, setPickedAbility] = createSignal<string | null>(null);

  const budget = createMemo(() => event()?.statPointsAvailable ?? 0);
  const spent = createMemo(() =>
    Object.values(alloc()).reduce<number>((a, b) => a + (b as number), 0),
  );
  const remaining = createMemo(() => Math.max(0, budget() - spent()));

  function adjust(key: keyof StatAllocation, delta: 1 | -1): void {
    setAlloc((cur) => {
      const next = { ...cur };
      const v = (next[key] as number) + delta;
      if (v < 0) return cur;
      if (delta > 0 && spent() >= budget()) return cur;
      next[key] = v;
      return next;
    });
  }

  return (
    <Suspense fallback={<p>Wisdom settles over you…</p>}>
      <Card>
        <div class={styles.shell}>
          <div class={styles.hero}>
            <h1 class={styles.heroLabel}>You Gained a Level</h1>
            <div class={styles.levelBadge} aria-label={`Level ${event()?.toLevel ?? '?'}`}>
              <Stack gap="0">
                <p class={styles.levelText}>Level</p>
                <p class={styles.levelNumber}>{event()?.toLevel ?? '?'}</p>
              </Stack>
            </div>
            <p class={styles.subtitle}>You have grown in strength and wisdom. Choose a reward.</p>
          </div>

          <p class={styles.budget}>
            Points remaining: <strong>{remaining()}</strong> / {budget()}
          </p>

          <div class={styles.columns}>
            <section class={styles.column} aria-label="Attribute increase">
              <h2 class={styles.columnHead}>Attribute increase</h2>
              <p style={{ margin: 0, opacity: 0.75, 'font-size': '0.8rem' }}>
                Permanently raise a stat. Each point lifts the underlying value by 1.
              </p>
              <For each={STAT_KEYS}>
                {(key) => (
                  <div class={styles.statRow}>
                    <span class={styles.statName}>{key}</span>
                    <button
                      type="button"
                      class={styles.allocBtn}
                      onClick={() => adjust(key, -1)}
                      disabled={(alloc()[key] as number) === 0}
                      aria-label={`Decrease ${key}`}
                    >
                      −
                    </button>
                    <span class={styles.statCount}>+{alloc()[key]}</span>
                    <button
                      type="button"
                      class={styles.allocBtn}
                      onClick={() => adjust(key, 1)}
                      disabled={remaining() === 0}
                      aria-label={`Increase ${key}`}
                    >
                      +
                    </button>
                  </div>
                )}
              </For>
            </section>

            <section class={styles.column} aria-label="New ability">
              <h2 class={styles.columnHead}>New ability</h2>
              <p style={{ margin: 0, opacity: 0.75, 'font-size': '0.8rem' }}>
                Learn a new edge. Single-pick — choose well.
              </p>
              <For each={[...(event()?.newAbilities ?? []), ...(event()?.newSpells ?? [])]}>
                {(ability) => (
                  <button
                    type="button"
                    class={styles.abilityRow}
                    onClick={() => setPickedAbility(ability)}
                    aria-pressed={pickedAbility() === ability ? 'true' : 'false'}
                    style={{
                      'background-color':
                        pickedAbility() === ability ? 'rgba(20,14,6,0.9)' : 'transparent',
                      cursor: 'pointer',
                      border: 'none',
                      'text-align': 'left',
                      color: 'inherit',
                      padding: '8px 0',
                    }}
                  >
                    <span class={styles.abilityName}>{abilityLabel(ability)}</span>
                    <span style={{ opacity: 0.7, 'font-size': '0.8rem' }}>
                      {pickedAbility() === ability ? 'Selected' : 'Learn'}
                    </span>
                    <span class={styles.abilityDesc}>{abilityFlavor(ability)}</span>
                  </button>
                )}
              </For>
            </section>
          </div>

          <p class={styles.lore}>"{event()?.loreFlavor ?? ''}"</p>

          <div class={styles.actions}>
            <Button
              variant="primary"
              onClick={() => navigate('/play')}
              disabled={remaining() > 0}
              title={remaining() > 0 ? 'Spend all your points before continuing.' : undefined}
            >
              Continue
            </Button>
          </div>
        </div>
      </Card>
    </Suspense>
  );
}

function abilityLabel(id: string): string {
  // "ability_rally" → "Rally"; "spell_in_mani" → "In Mani".
  const stripped = id.replace(/^(ability|spell)_/, '');
  return stripped
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function abilityFlavor(id: string): string {
  if (id.startsWith('spell_'))
    return 'Inscribed at the next reagent table; consumes the appropriate components.';
  return 'A martial edge — usable in melee with a short cooldown.';
}
