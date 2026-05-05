// In-game shell — top bar (logo + character name + currency + settings),
// optional side panels, main outlet, and bottom HUD slot. Wraps every `/play/*`
// route. Phase 6 mounts a PixiJS canvas inside the main outlet; for now the
// outlet just renders the active child route.

import type { Character } from '@br/types';
import {
  Cluster,
  HealthBar,
  IconButton,
  Loading,
  ManaBar,
  MinimapPlaceholder,
  Popover,
  Slider,
  Stack,
  WindowFrame,
} from '@br/ui';
import { useNavigate } from '@solidjs/router';
import { type JSX, Show, Suspense, createResource, onCleanup, onMount } from 'solid-js';
import { signOut } from '../state/auth';
import { canvasState } from '../state/canvas';
import { mockClient } from '../state/mockClient';

// Footer icon size (px). Replacement art (kingdom sigils, scroll icons,
// etc.) drops in at this size; the explicit width/height keeps layout
// stable when SVGs swap to bitmaps.
const FOOTER_ICON_SIZE_PX = 44;

export interface PlayLayoutProps {
  children?: JSX.Element;
}

interface CharactersPayload {
  readonly characters: readonly Character[];
}

export function PlayLayout(props: PlayLayoutProps): JSX.Element {
  const navigate = useNavigate();
  const [data] = createResource(() =>
    mockClient.get<CharactersPayload>('/v1/characters').catch(() => null),
  );

  const active = (): Character | null => data()?.characters[0] ?? null;

  return (
    <div
      data-layout="play"
      style={{
        display: 'grid',
        'grid-template-rows': 'auto 1fr auto',
        height: '100vh',
        'background-color': 'var(--br-color-surface-base, #14110c)',
        color: 'var(--br-color-ink, #e8e2d2)',
      }}
    >
      <header
        style={{
          'border-bottom': '1px solid var(--br-color-border, #3a3328)',
          padding: 'var(--br-space-2, 0.5rem) var(--br-space-4, 1rem)',
        }}
      >
        <Cluster justify="space-between" gap="4">
          <Cluster gap="3" align="center">
            <strong style={{ 'letter-spacing': '0.08em' }}>PROJECT VIRTUE</strong>
            <Show when={active()}>
              {(c) => (
                <span style={{ opacity: 0.85 }}>
                  {c().name}
                  {c().publicTitle ? `, ${c().publicTitle}` : ''}
                </span>
              )}
            </Show>
          </Cluster>
          <Cluster gap="4" align="center">
            <Show when={active()}>
              {(c) => (
                <span aria-label="Currency" style={{ 'font-variant-numeric': 'tabular-nums' }}>
                  {c().currency.gold}g {c().currency.silver}s {c().currency.copper}c
                </span>
              )}
            </Show>
            <IconButton
              icon="scroll"
              label="Options"
              variant="ghost"
              onClick={() => navigate('/play/options')}
            />
            <IconButton
              icon="x"
              label="Sign out"
              variant="ghost"
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            />
          </Cluster>
        </Cluster>
      </header>

      <div
        style={{
          display: 'grid',
          'grid-template-columns': '240px 1fr 240px',
          gap: 'var(--br-space-3, 0.75rem)',
          padding: 'var(--br-space-3, 0.75rem)',
          overflow: 'hidden',
        }}
      >
        <aside aria-label="Left panel" style={{ overflow: 'auto' }}>
          <WindowFrame title="Party">
            <Stack gap="2">
              <Show
                when={active()}
                fallback={<span style={{ opacity: 0.6 }}>No active character.</span>}
              >
                {(c) => (
                  <>
                    <HealthBar value={c().hp.current} max={c().hp.max} label="HP" />
                    <ManaBar value={c().mana.current} max={c().mana.max} label="Mana" />
                  </>
                )}
              </Show>
            </Stack>
          </WindowFrame>
        </aside>

        <section
          aria-label="Main view"
          style={{
            'min-width': 0,
            overflow: 'auto',
            'border-radius': 'var(--br-radius-md, 6px)',
          }}
        >
          <Suspense fallback={<Loading label="Loading scene…" />}>{props.children}</Suspense>
        </section>

        <aside aria-label="Right panel" style={{ overflow: 'auto' }}>
          <WindowFrame title="Map">
            <MinimapPlaceholder label="Minimap" />
          </WindowFrame>
        </aside>
      </div>

      <footer
        style={{
          'border-top': '1px solid var(--br-color-border, #3a3328)',
          padding: 'var(--br-space-2, 0.5rem) var(--br-space-4, 1rem)',
        }}
      >
        <Cluster gap="3" justify="space-between" align="center">
          <Cluster gap="2">
            <FooterIcon
              icon="backpack"
              label="Inventory"
              onClick={() => navigate('/play/inventory')}
            />
            <FooterIcon icon="scroll" label="Journal" onClick={() => navigate('/play/journal')} />
            <FooterIcon icon="swords" label="Combat" onClick={() => navigate('/play/combat')} />
            <FooterIcon icon="gear" label="Options" onClick={() => navigate('/play/options')} />
          </Cluster>
          <Cluster gap="2" align="center">
            <TimeOfDayControl />
            <HudToggle />
          </Cluster>
        </Cluster>
      </footer>
    </div>
  );
}

interface FooterIconProps {
  readonly icon: 'backpack' | 'scroll' | 'swords' | 'gear';
  readonly label: string;
  readonly onClick: () => void;
}

/** Footer toolbar slot. Fixed pixel size so replacement art drops in
 *  cleanly; uses the @br/ui IconButton hover/focus visuals as-is. */
function FooterIcon(props: FooterIconProps): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        width: `${FOOTER_ICON_SIZE_PX}px`,
        height: `${FOOTER_ICON_SIZE_PX}px`,
      }}
    >
      <IconButton
        icon={props.icon}
        label={props.label}
        variant="ghost"
        size="lg"
        onClick={props.onClick}
        title={props.label}
      />
    </span>
  );
}

/** Sun icon → popover with a 0–24h slider for the day/night cycle.
 *  Dragging the slider pauses auto-advance; "Resume cycle" re-arms it. */
function TimeOfDayControl(): JSX.Element {
  const onSliderChange = (value: number): void => {
    canvasState.setCurrentHour(value);
    canvasState.setDayNightAutoAdvance(false);
  };
  return (
    <Popover
      trigger={
        <span
          style={{
            display: 'inline-flex',
            width: `${FOOTER_ICON_SIZE_PX}px`,
            height: `${FOOTER_ICON_SIZE_PX}px`,
          }}
        >
          <IconButton
            icon="sun"
            label="Time of day"
            variant="ghost"
            size="lg"
            title="Time of day"
          />
        </span>
      }
    >
      <div style={{ 'min-width': '220px', padding: 'var(--br-space-2, 0.5rem)' }}>
        <Slider
          label={`Time: ${canvasState.currentHour().toFixed(1)}h`}
          min={0}
          max={24}
          step={0.5}
          value={canvasState.currentHour()}
          showValue={false}
          marks={[
            { value: 0, label: '00' },
            { value: 6, label: '06' },
            { value: 12, label: '12' },
            { value: 18, label: '18' },
            { value: 24, label: '24' },
          ]}
          onValueChange={onSliderChange}
        />
        <Cluster gap="2" justify="end" align="center">
          <button
            type="button"
            onClick={() => canvasState.setDayNightAutoAdvance(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--br-color-border, #3a3328)',
              color: 'var(--br-color-ink, #e8e2d2)',
              padding: '4px 10px',
              'border-radius': '4px',
              cursor: 'pointer',
              'font-size': '0.85rem',
            }}
          >
            Resume cycle
          </button>
        </Cluster>
      </div>
    </Popover>
  );
}

/** Eye icon (+ keyboard 'H') toggles the canvas overlay layers
 *  (day/night tint, lighting, dev perf overlay). The world tiles +
 *  entities are unaffected so movement/click still work. */
function HudToggle(): JSX.Element {
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'h' && ev.key !== 'H') return;
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    canvasState.setHudOverlaysVisible(!canvasState.hudOverlaysVisible());
  };
  onMount(() => window.addEventListener('keydown', onKeyDown));
  onCleanup(() => window.removeEventListener('keydown', onKeyDown));

  return (
    <span
      style={{
        display: 'inline-flex',
        width: `${FOOTER_ICON_SIZE_PX}px`,
        height: `${FOOTER_ICON_SIZE_PX}px`,
      }}
    >
      <IconButton
        icon={canvasState.hudOverlaysVisible() ? 'eye' : 'eye-off'}
        label={
          canvasState.hudOverlaysVisible() ? 'Hide canvas overlays (H)' : 'Show canvas overlays (H)'
        }
        variant="ghost"
        size="lg"
        title={canvasState.hudOverlaysVisible() ? 'Hide overlays (H)' : 'Show overlays (H)'}
        onClick={() => canvasState.setHudOverlaysVisible(!canvasState.hudOverlaysVisible())}
      />
    </span>
  );
}
