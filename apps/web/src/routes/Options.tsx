// `/play/options` — tabbed Options screen (9-9-Options.png).
//
// Concept-art interpretation: vertical tab rail (Audio / Video / Controls /
// Gameplay / Accessibility) with multi-section content on the right;
// Apply / Reset to defaults / Close in the footer. We pull each domain's
// option object as its own resource and hold local-state edits via a
// signal merged at apply time. Apply is mock — no PUT roundtrip yet.

import type {
  AccessibilityOptions,
  AudioOptions,
  GameplayOptions,
  KeyBinding,
  Keybindings,
  VideoOptions,
} from '@br/types';
import {
  Button,
  Card,
  Select,
  Slider,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Toggle,
  WindowFrame,
  toast,
} from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { For, type JSX, Suspense, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './Options.module.css';

export function Options(): JSX.Element {
  const navigate = useNavigate();

  const [audioRes] = createResource<AudioOptions>(() =>
    mockClient.get<AudioOptions>('/v1/options/audio'),
  );
  const [videoRes] = createResource<VideoOptions>(() =>
    mockClient.get<VideoOptions>('/v1/options/video'),
  );
  const [keysRes] = createResource<Keybindings>(() =>
    mockClient.get<Keybindings>('/v1/options/keybindings'),
  );
  const [gameRes] = createResource<GameplayOptions>(() =>
    mockClient.get<GameplayOptions>('/v1/options/gameplay'),
  );
  const [a11yRes] = createResource<AccessibilityOptions>(() =>
    mockClient.get<AccessibilityOptions>('/v1/options/accessibility'),
  );

  const [audio, setAudio] = createSignal<AudioOptions | null>(null);
  const [video, setVideo] = createSignal<VideoOptions | null>(null);
  const [game, setGame] = createSignal<GameplayOptions | null>(null);
  const [a11y, setA11y] = createSignal<AccessibilityOptions | null>(null);

  // Initialise the editable signals once each resource resolves.
  const _hydrate = (): void => {
    const a = audioRes();
    if (audio() === null && a) setAudio(a);
    const v = videoRes();
    if (video() === null && v) setVideo(v);
    const g = gameRes();
    if (game() === null && g) setGame(g);
    const x = a11yRes();
    if (a11y() === null && x) setA11y(x);
  };

  function patchAudio<K extends keyof AudioOptions>(k: K, v: AudioOptions[K]): void {
    _hydrate();
    setAudio((cur) => (cur ? { ...cur, [k]: v } : cur));
  }
  function patchVideo<K extends keyof VideoOptions>(k: K, v: VideoOptions[K]): void {
    _hydrate();
    setVideo((cur) => (cur ? { ...cur, [k]: v } : cur));
  }
  function patchGame<K extends keyof GameplayOptions>(k: K, v: GameplayOptions[K]): void {
    _hydrate();
    setGame((cur) => (cur ? { ...cur, [k]: v } : cur));
  }
  function patchA11y<K extends keyof AccessibilityOptions>(k: K, v: AccessibilityOptions[K]): void {
    _hydrate();
    setA11y((cur) => (cur ? { ...cur, [k]: v } : cur));
  }

  function apply(): void {
    // Apply is a mock — local state only. Wire the PUTs when the real
    // backend lands; the routes already exist in the mock route table.
    toast.show('Settings applied (mock — local state only).', { title: 'Options' });
  }

  function resetDefaults(): void {
    setAudio(audioRes() ?? null);
    setVideo(videoRes() ?? null);
    setGame(gameRes() ?? null);
    setA11y(a11yRes() ?? null);
    toast.show('Reset to defaults.', { title: 'Options' });
  }

  return (
    <Suspense fallback={<p>Opening the lectern…</p>}>
      <WindowFrame title="Options" onClose={() => navigate('/play')}>
        <Card>
          <div class={styles.shell}>
            <h1 class={styles.headline}>Options</h1>

            <Tabs defaultValue="audio">
              <div class={styles.layout}>
                <div class={styles.tablist}>
                  <TabList aria-label="Settings categories">
                    <Tab value="audio">Audio</Tab>
                    <Tab value="video">Video</Tab>
                    <Tab value="controls">Controls</Tab>
                    <Tab value="gameplay">Gameplay</Tab>
                    <Tab value="accessibility">Accessibility</Tab>
                  </TabList>
                </div>

                <div class={styles.panel}>
                  <TabPanel value="audio">
                    <AudioPanel data={audio() ?? audioRes()} patch={patchAudio} />
                  </TabPanel>
                  <TabPanel value="video">
                    <VideoPanel data={video() ?? videoRes()} patch={patchVideo} />
                  </TabPanel>
                  <TabPanel value="controls">
                    <ControlsPanel data={keysRes()} />
                  </TabPanel>
                  <TabPanel value="gameplay">
                    <GameplayPanel data={game() ?? gameRes()} patch={patchGame} />
                  </TabPanel>
                  <TabPanel value="accessibility">
                    <AccessibilityPanel data={a11y() ?? a11yRes()} patch={patchA11y} />
                  </TabPanel>
                </div>
              </div>
            </Tabs>

            <div class={styles.actions}>
              <Button variant="ghost" onClick={resetDefaults}>
                Reset to defaults
              </Button>
              <Button variant="secondary" onClick={() => navigate('/play')}>
                Close
              </Button>
              <Button onClick={apply}>Apply</Button>
            </div>
          </div>
        </Card>
      </WindowFrame>
    </Suspense>
  );
}

interface PanelProps<T> {
  readonly data: T | undefined;
  readonly patch: <K extends keyof T>(k: K, v: T[K]) => void;
}

function AudioPanel(props: PanelProps<AudioOptions>): JSX.Element {
  return (
    <Stack gap="3">
      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Volumes</h3>
        <For
          each={
            [
              ['masterVolume', 'Master volume'],
              ['musicVolume', 'Music'],
              ['sfxVolume', 'Sound effects'],
              ['ambienceVolume', 'Ambience'],
              ['voiceVolume', 'Voice'],
            ] as const
          }
        >
          {([key, label]) => (
            <div class={styles.row}>
              <span class={styles.rowLabel}>{label}</span>
              <Slider
                min={0}
                max={100}
                value={Math.round((props.data?.[key] ?? 0) * 100)}
                onValueChange={(v) => props.patch(key, (v / 100) as AudioOptions[typeof key])}
                aria-label={label}
              />
            </div>
          )}
        </For>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Behavior</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Mute when window unfocused</span>
          <Toggle
            checked={props.data?.muteWhenUnfocused ?? false}
            onChange={(e) => props.patch('muteWhenUnfocused', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Subtitles enabled</span>
          <Toggle
            checked={props.data?.subtitlesEnabled ?? false}
            onChange={(e) => props.patch('subtitlesEnabled', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Subtitle size</span>
          <Select
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
              { value: 'xl', label: 'Extra Large' },
            ]}
            value={props.data?.subtitleSize ?? 'md'}
            onChange={(e) =>
              props.patch('subtitleSize', e.currentTarget.value as AudioOptions['subtitleSize'])
            }
          />
        </div>
      </section>
    </Stack>
  );
}

function VideoPanel(props: PanelProps<VideoOptions>): JSX.Element {
  return (
    <Stack gap="3">
      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Display</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Resolution</span>
          <Select
            options={[
              { value: '1280x720', label: '1280 × 720' },
              { value: '1920x1080', label: '1920 × 1080' },
              { value: '2560x1440', label: '2560 × 1440' },
              { value: '3840x2160', label: '3840 × 2160' },
              { value: 'native', label: 'Native' },
            ]}
            value={props.data?.resolution ?? 'native'}
            onChange={(e) =>
              props.patch('resolution', e.currentTarget.value as VideoOptions['resolution'])
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Display mode</span>
          <Select
            options={[
              { value: 'fullscreen', label: 'Fullscreen' },
              { value: 'borderless', label: 'Borderless window' },
              { value: 'windowed', label: 'Windowed' },
            ]}
            value={props.data?.displayMode ?? 'borderless'}
            onChange={(e) =>
              props.patch('displayMode', e.currentTarget.value as VideoOptions['displayMode'])
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>VSync</span>
          <Toggle
            checked={props.data?.vsync ?? false}
            onChange={(e) => props.patch('vsync', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Frame rate cap</span>
          <Slider
            min={30}
            max={240}
            step={5}
            value={props.data?.frameRateCap ?? 60}
            onValueChange={(v) => props.patch('frameRateCap', v)}
            aria-label="Frame rate cap"
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Field of view</span>
          <Slider
            min={60}
            max={110}
            value={props.data?.fieldOfView ?? 72}
            onValueChange={(v) => props.patch('fieldOfView', v)}
            aria-label="Field of view"
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Quality</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Texture quality</span>
          <Select
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'ultra', label: 'Ultra' },
            ]}
            value={props.data?.textureQuality ?? 'high'}
            onChange={(e) =>
              props.patch('textureQuality', e.currentTarget.value as VideoOptions['textureQuality'])
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Shadow quality</span>
          <Select
            options={[
              { value: 'off', label: 'Off' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            value={props.data?.shadowQuality ?? 'high'}
            onChange={(e) =>
              props.patch('shadowQuality', e.currentTarget.value as VideoOptions['shadowQuality'])
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Bloom</span>
          <Toggle
            checked={props.data?.bloom ?? false}
            onChange={(e) => props.patch('bloom', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Motion blur</span>
          <Toggle
            checked={props.data?.motionBlur ?? false}
            onChange={(e) => props.patch('motionBlur', e.currentTarget.checked)}
          />
        </div>
      </section>
    </Stack>
  );
}

interface ControlsPanelProps {
  readonly data: Keybindings | undefined;
}

function ControlsPanel(props: ControlsPanelProps): JSX.Element {
  return (
    <Stack gap="3">
      <For each={['movement', 'combat', 'ui', 'social', 'system'] as const}>
        {(group) => {
          const bindings = (): readonly KeyBinding[] =>
            (props.data?.bindings ?? []).filter((b) => b.group === group);
          return (
            <section class={styles.section}>
              <h3 class={styles.sectionHead}>{group}</h3>
              <div class={styles.keybindGrid}>
                <For each={bindings()}>
                  {(b) => (
                    <div class={styles.keybindRow}>
                      <span class={styles.rowLabel}>{b.label}</span>
                      <span class={styles.keyChip} aria-label={`Primary: ${b.primary}`}>
                        {b.primary}
                      </span>
                      <span class={styles.keyChip} aria-label="Secondary binding">
                        {b.secondary ?? '—'}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </section>
          );
        }}
      </For>
      <p style={{ opacity: 0.65, 'font-size': '0.85rem', 'font-style': 'italic' }}>
        Re-binding lands with the keyboard service in Phase 7. Click Apply to roundtrip the existing
        config to the mock backend.
      </p>
    </Stack>
  );
}

function GameplayPanel(props: PanelProps<GameplayOptions>): JSX.Element {
  return (
    <Stack gap="3">
      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Tutorial</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Show tutorial hints</span>
          <Toggle
            checked={props.data?.showTutorialHints ?? true}
            onChange={(e) => props.patch('showTutorialHints', e.currentTarget.checked)}
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Combat</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Preferred combat style</span>
          <Select
            options={[
              { value: 'realtime', label: 'Real-time' },
              { value: 'paused', label: 'Auto-pause on commands' },
              { value: 'auto', label: 'Auto-suggest' },
            ]}
            value={props.data?.preferredCombatStyle ?? 'realtime'}
            onChange={(e) =>
              props.patch(
                'preferredCombatStyle',
                e.currentTarget.value as GameplayOptions['preferredCombatStyle'],
              )
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Damage numbers</span>
          <Toggle
            checked={props.data?.damageNumbers ?? true}
            onChange={(e) => props.patch('damageNumbers', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Auto-loot</span>
          <Toggle
            checked={props.data?.autoLootEnabled ?? false}
            onChange={(e) => props.patch('autoLootEnabled', e.currentTarget.checked)}
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Camera</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Camera follow</span>
          <Select
            options={[
              { value: 'free', label: 'Free' },
              { value: 'lock', label: 'Locked' },
              { value: 'smart', label: 'Smart' },
            ]}
            value={props.data?.cameraFollow ?? 'smart'}
            onChange={(e) =>
              props.patch('cameraFollow', e.currentTarget.value as GameplayOptions['cameraFollow'])
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Mouse-look</span>
          <Toggle
            checked={props.data?.mouseLook ?? false}
            onChange={(e) => props.patch('mouseLook', e.currentTarget.checked)}
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Tooltips</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Tooltip delay (ms)</span>
          <Slider
            min={0}
            max={1000}
            step={50}
            value={props.data?.tooltipDelayMs ?? 250}
            onValueChange={(v) => props.patch('tooltipDelayMs', v)}
            aria-label="Tooltip delay"
          />
        </div>
      </section>
    </Stack>
  );
}

function AccessibilityPanel(props: PanelProps<AccessibilityOptions>): JSX.Element {
  return (
    <Stack gap="3">
      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Vision</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>High contrast</span>
          <Toggle
            checked={props.data?.highContrast ?? false}
            onChange={(e) => props.patch('highContrast', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Color-blind mode</span>
          <Select
            options={[
              { value: 'off', label: 'Off' },
              { value: 'deuteranopia', label: 'Deuteranopia' },
              { value: 'protanopia', label: 'Protanopia' },
              { value: 'tritanopia', label: 'Tritanopia' },
            ]}
            value={props.data?.colorBlindMode ?? 'off'}
            onChange={(e) =>
              props.patch(
                'colorBlindMode',
                e.currentTarget.value as AccessibilityOptions['colorBlindMode'],
              )
            }
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Font scale</span>
          <Select
            options={[
              { value: '0.9', label: '90%' },
              { value: '1', label: '100%' },
              { value: '1.25', label: '125%' },
              { value: '1.5', label: '150%' },
            ]}
            value={String(props.data?.fontScale ?? 1)}
            onChange={(e) => {
              const next = Number(e.currentTarget.value) as AccessibilityOptions['fontScale'];
              props.patch('fontScale', next);
            }}
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Motion</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Reduce motion</span>
          <Toggle
            checked={props.data?.reducedMotion ?? false}
            onChange={(e) => props.patch('reducedMotion', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Screen shake</span>
          <Toggle
            checked={props.data?.screenShake ?? true}
            onChange={(e) => props.patch('screenShake', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Flashing effects</span>
          <Toggle
            checked={props.data?.flashingEffects ?? true}
            onChange={(e) => props.patch('flashingEffects', e.currentTarget.checked)}
          />
        </div>
      </section>

      <section class={styles.section}>
        <h3 class={styles.sectionHead}>Assistance</h3>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Captions for combat</span>
          <Toggle
            checked={props.data?.captionsForCombat ?? true}
            onChange={(e) => props.patch('captionsForCombat', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Hold to toggle (vs. hold)</span>
          <Toggle
            checked={props.data?.holdToToggle ?? false}
            onChange={(e) => props.patch('holdToToggle', e.currentTarget.checked)}
          />
        </div>
        <div class={styles.row}>
          <span class={styles.rowLabel}>Screen-reader output</span>
          <Toggle
            checked={props.data?.screenReader ?? false}
            onChange={(e) => props.patch('screenReader', e.currentTarget.checked)}
          />
        </div>
      </section>
    </Stack>
  );
}
