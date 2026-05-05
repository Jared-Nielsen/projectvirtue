// `/character/create` — multi-step character creation (10-1-AvatarCreation.png).
//
// Concept-art interpretation: a 6-tab wizard ("Race / Class / Appearance /
// Stats / Background / Review" in the art). We collapse Appearance into the
// portrait grid for fidelity to the available mock data (no body sliders),
// and replace "Background" with "Virtue" alignment per the spec, since the
// virtue pick drives starter bonuses. The right-rail Summary panel from
// the art is rolled into the final Review step. Stat re-roll button sits
// next to the stat list.
//
// Wiring: `/v1/characters/templates` and `/v1/characters/portraits`. We
// drive the in-flight form state with local Solid signals; only the final
// Create button POSTs to `/v1/characters` (mock).

import type {
  CharacterTemplate,
  CreateCharacterResponse,
  Portrait,
  Stats,
  VirtueAlignment,
} from '@br/types';
import { Button, Card, Cluster, Input, Stack, Tab, TabList, TabPanel, Tabs } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { For, type JSX, Show, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './CharacterCreate.module.css';
import {
  STAT_KEYS,
  STEPS,
  type StepId,
  bonusFor,
  rollStats,
  virtueStarterBonus,
} from './characterCreate.helpers';

interface TemplatesPayload {
  readonly templates: readonly CharacterTemplate[];
}

interface PortraitsPayload {
  readonly portraits: readonly Portrait[];
}

const VIRTUES: readonly VirtueAlignment[] = [
  'compassion',
  'honesty',
  'honor',
  'humility',
  'justice',
  'sacrifice',
  'spirituality',
  'valor',
  'balance',
];

export function CharacterCreate(): JSX.Element {
  const navigate = useNavigate();
  const [templates] = createResource<TemplatesPayload>(() =>
    mockClient.get<TemplatesPayload>('/v1/characters/templates'),
  );
  const [portraits] = createResource<PortraitsPayload>(() =>
    mockClient.get<PortraitsPayload>('/v1/characters/portraits'),
  );

  const [step, setStep] = createSignal<StepId>('race');
  const [templateId, setTemplateId] = createSignal<string | null>(null);
  const [classId, setClassId] = createSignal<string | null>(null);
  const [name, setName] = createSignal('');
  const [virtue, setVirtue] = createSignal<VirtueAlignment>('balance');
  const [portraitId, setPortraitId] = createSignal<string | null>(null);
  const [stats, setStats] = createSignal<Stats>(rollStats(0));
  const [seed, setSeed] = createSignal(1);
  const [submitting, setSubmitting] = createSignal(false);

  const tList = createMemo(() => templates()?.templates ?? []);
  const pList = createMemo(() => portraits()?.portraits ?? []);

  // Race & Class options derive from the templates list so we always offer
  // valid combinations. Pick first template that matches the selected race
  // when the user clicks a class card.
  const races = createMemo(() => {
    const seen = new Set<string>();
    return tList().filter((t) => {
      if (seen.has(t.race)) return false;
      seen.add(t.race);
      return true;
    });
  });
  const classesForRace = createMemo(() => {
    const tpl = tList().find((t) => t.id === templateId());
    if (!tpl) return [] as readonly CharacterTemplate[];
    return tList().filter((t) => t.race === tpl.race);
  });
  const activeTemplate = createMemo<CharacterTemplate | undefined>(
    () => tList().find((t) => t.id === classId()) ?? tList().find((t) => t.id === templateId()),
  );

  // Stats rolled from a deterministic seed so re-roll feels stable in tests.
  function reroll(): void {
    const s = seed() + 1;
    setSeed(s);
    setStats(rollStats(s));
  }

  const finalStats = createMemo<Stats>(() => {
    const base = activeTemplate()?.baseStats;
    const rolled = stats();
    const bonus = virtueStarterBonus(virtue());
    const out: { -readonly [K in keyof Stats]: number } = {
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      constitution: 0,
      wisdom: 0,
      charisma: 0,
    };
    for (const key of STAT_KEYS) {
      out[key] = (base?.[key] ?? 10) + rolled[key] + bonus[key];
    }
    return out;
  });

  const canProceed = createMemo<boolean>(() => {
    switch (step()) {
      case 'race':
        return templateId() !== null;
      case 'class':
        return classId() !== null;
      case 'name':
        return name().trim().length >= 2;
      case 'virtue':
        return virtue() !== null;
      case 'stats':
        return true;
      case 'portrait':
        return portraitId() !== null;
      case 'review':
        return name().trim().length >= 2 && portraitId() !== null;
      default:
        return false;
    }
  });

  function gotoStep(delta: 1 | -1): void {
    const idx = STEPS.findIndex((s) => s.id === step());
    const next = STEPS[idx + delta];
    if (next) setStep(next.id);
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    try {
      // The mock POST returns a fixed character; in real life we would send
      // the assembled CreateCharacterRequest. Here the interaction proves
      // the wire works.
      await mockClient.post<CreateCharacterResponse>('/v1/characters', {
        name: name(),
        templateId: classId() ?? templateId(),
        portraitId: portraitId(),
        virtueAlignment: virtue(),
      });
      navigate('/character');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <Suspense fallback={<p>Forging the rolls of the realm…</p>}>
        <div class={styles.shell}>
          <h1 class={styles.headline}>Create Your Hero</h1>

          <Tabs value={step()} onChange={(v) => setStep(v as StepId)}>
            <TabList aria-label="Creation steps">
              <For each={STEPS}>{(s) => <Tab value={s.id}>{s.label}</Tab>}</For>
            </TabList>

            <TabPanel value="race">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <p style={{ margin: 0, opacity: 0.8 }}>
                    Choose a race. This sets your starting kit and your portrait pool.
                  </p>
                  <div class={styles.optionList}>
                    <For each={races()}>
                      {(t) => (
                        <button
                          type="button"
                          class={`${styles.optionCard}${
                            templateId() === t.id ? ` ${styles.active}` : ''
                          }`}
                          onClick={() => {
                            setTemplateId(t.id);
                            setClassId(t.id);
                            setPortraitId(t.portraitOptions[0] ?? null);
                          }}
                        >
                          <span class={styles.optionTitle}>{capitalize(t.race)}</span>
                          <span class={styles.optionDesc}>
                            Starting class: {capitalize(t.class)}.
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="class">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <p style={{ margin: 0, opacity: 0.8 }}>
                    Choose a calling. Each class brings starter spells, items, and a virtue
                    inclination.
                  </p>
                  <div class={styles.optionList}>
                    <For each={classesForRace()}>
                      {(t) => (
                        <button
                          type="button"
                          class={`${styles.optionCard}${
                            classId() === t.id ? ` ${styles.active}` : ''
                          }`}
                          onClick={() => {
                            setClassId(t.id);
                            setVirtue(t.virtueAlignment);
                            setPortraitId(t.portraitOptions[0] ?? portraitId());
                          }}
                        >
                          <span class={styles.optionTitle}>{t.displayName.en}</span>
                          <span class={styles.optionDesc}>{t.description}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="name">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <Input
                    label="Avatar name"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    helperText="Two characters or more. Make it speakable; a herald will need it."
                    placeholder="Aramis the Stranger"
                    required
                  />
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="virtue">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <p style={{ margin: 0, opacity: 0.8 }}>
                    Pick a virtue alignment. It nudges your starting stats and locks a handful of
                    virtue-gated dialog choices open from the start.
                  </p>
                  <div class={styles.virtuePips}>
                    <For each={VIRTUES}>
                      {(v) => (
                        <button
                          type="button"
                          class={`${styles.virtuePip}${virtue() === v ? ` ${styles.active}` : ''}`}
                          onClick={() => setVirtue(v)}
                          aria-pressed={virtue() === v ? 'true' : 'false'}
                        >
                          {v}
                        </button>
                      )}
                    </For>
                  </div>
                  <p style={{ margin: 0, opacity: 0.65, 'font-size': '0.85rem' }}>
                    {bonusDescription(virtue())}
                  </p>
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="stats">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <Cluster justify="space-between" align="center">
                    <span style={{ opacity: 0.85 }}>
                      Roll the dice. Bonuses come from your virtue.
                    </span>
                    <Button variant="secondary" onClick={reroll}>
                      Re-roll
                    </Button>
                  </Cluster>

                  <ul aria-label="Stats" style={{ 'list-style': 'none', margin: 0, padding: 0 }}>
                    <For each={STAT_KEYS}>
                      {(key) => (
                        <li class={styles.statRow}>
                          <span class={styles.statName}>{capitalize(key)}</span>
                          <span class={styles.statValue}>{finalStats()[key]}</span>
                          <span class={styles.statBonus}>{bonusFor(key, virtue(), stats())}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="portrait">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <p style={{ margin: 0, opacity: 0.8 }}>
                    Choose a portrait. The pool is filtered by your race.
                  </p>
                  <div class={styles.portraitGrid}>
                    <For
                      each={pList().filter((p) => {
                        const race = activeTemplate()?.race;
                        return race ? p.race === race : true;
                      })}
                    >
                      {(p) => (
                        <button
                          type="button"
                          class={`${styles.portraitTile}${
                            portraitId() === p.id ? ` ${styles.active}` : ''
                          }`}
                          onClick={() => setPortraitId(p.id)}
                          aria-pressed={portraitId() === p.id ? 'true' : 'false'}
                        >
                          <span aria-hidden="true">{moodGlyph(p.mood)}</span>
                          <span>{p.mood}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Stack>
              </div>
            </TabPanel>

            <TabPanel value="review">
              <div class={styles.body}>
                <PortraitFrame portraitId={portraitId()} portraits={pList()} />
                <Stack gap="3">
                  <h2 style={{ margin: 0, 'letter-spacing': '0.1em' }}>Summary</h2>
                  <dl class={styles.summaryGrid}>
                    <dt>Name</dt>
                    <dd>{name() || '—'}</dd>
                    <dt>Race</dt>
                    <dd>{capitalize(activeTemplate()?.race ?? '—')}</dd>
                    <dt>Class</dt>
                    <dd>{activeTemplate()?.displayName.en ?? '—'}</dd>
                    <dt>Virtue</dt>
                    <dd style={{ 'text-transform': 'capitalize' }}>{virtue()}</dd>
                    <dt>Starting Items</dt>
                    <dd>{(activeTemplate()?.startingItems ?? []).join(', ') || '—'}</dd>
                    <dt>Stats</dt>
                    <dd>
                      <For each={STAT_KEYS}>
                        {(k) => (
                          <span style={{ 'margin-right': '0.75rem' }}>
                            {k.slice(0, 3).toUpperCase()} {finalStats()[k]}
                          </span>
                        )}
                      </For>
                    </dd>
                  </dl>
                </Stack>
              </div>
            </TabPanel>
          </Tabs>

          <div class={styles.footer}>
            <Button variant="ghost" onClick={() => gotoStep(-1)} disabled={step() === 'race'}>
              Back
            </Button>
            <span class={styles.stepProgress}>
              Step {STEPS.findIndex((s) => s.id === step()) + 1} of {STEPS.length}
            </span>
            <Show
              when={step() !== 'review'}
              fallback={
                <Button onClick={submit} loading={submitting()} disabled={!canProceed()}>
                  Take the Oath
                </Button>
              }
            >
              <Button onClick={() => gotoStep(1)} disabled={!canProceed()}>
                Next
              </Button>
            </Show>
          </div>
        </div>
      </Suspense>
    </Card>
  );
}

interface PortraitPanelProps {
  readonly portraitId: string | null;
  readonly portraits: readonly Portrait[];
}

function PortraitFrame(props: PortraitPanelProps): JSX.Element {
  const selected = (): Portrait | undefined =>
    props.portraits.find((p) => p.id === props.portraitId);
  return (
    <div class={styles.portrait} role="img" aria-label="Avatar preview">
      <Show when={selected()} fallback={<UnknownPortrait />}>
        {(s) => (
          <>
            <span class={styles.portraitGlyph} aria-hidden="true">
              {moodGlyph(s().mood)}
            </span>
            <span class={styles.portraitName}>
              {capitalize(s().race)} · {s().mood}
            </span>
          </>
        )}
      </Show>
    </div>
  );
}

function UnknownPortrait(): JSX.Element {
  return (
    <>
      <span class={styles.portraitGlyph} aria-hidden="true">
        ?
      </span>
      <span class={styles.portraitName}>No portrait yet</span>
    </>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function moodGlyph(mood: Portrait['mood']): string {
  switch (mood) {
    case 'stoic':
      return 'A';
    case 'fierce':
      return 'V';
    case 'kind':
      return 'C';
    case 'wise':
      return 'S';
    case 'mischievous':
      return 'M';
    default:
      return 'A';
  }
}

function bonusDescription(v: VirtueAlignment): string {
  const bonus = virtueStarterBonus(v);
  const parts = STAT_KEYS.filter((k) => bonus[k] !== 0).map(
    (k) => `${capitalize(k)} ${bonus[k] >= 0 ? '+' : ''}${bonus[k]}`,
  );
  if (parts.length === 0) return 'Balanced — no bonuses, no penalties.';
  return parts.join(' · ');
}
