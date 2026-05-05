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
  Stack,
  WindowFrame,
} from '@br/ui';
import { A, useNavigate } from '@solidjs/router';
import { type JSX, Show, Suspense, createResource } from 'solid-js';
import { signOut } from '../state/auth';
import { mockClient } from '../state/mockClient';

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
            <strong style={{ 'letter-spacing': '0.08em' }}>BRITANNIA REBORN</strong>
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
          <Cluster gap="3">
            <A href="/play/inventory">Inventory</A>
            <A href="/play/journal">Journal</A>
            <A href="/play/combat">Combat</A>
          </Cluster>
          <span style={{ opacity: 0.6, 'font-size': '0.85rem' }}>HUD slot</span>
        </Cluster>
      </footer>
    </div>
  );
}
