// Rotator — picks the right variant component based on the route param,
// fetches the manifest, and selects a lore quote. Used by the
// `/loading/:variant` route via the thin `LoadingScreen.tsx` wrapper.

import type { LoadingScreenManifest, LoadingVariant } from '@br/types';
import { Loading } from '@br/ui';
import { type JSX, Show, createMemo, createResource } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { LoadingScreenDefault } from './LoadingScreenDefault';
import { LoadingScreenDungeon } from './LoadingScreenDungeon';
import { LoadingScreenMarine } from './LoadingScreenMarine';
import { LoadingScreenPaladinCastle } from './LoadingScreenPaladinCastle';
import { pickQuote, pickVariant } from './quotePool';

export interface LoadingScreenRotatorProps {
  /** Variant requested by the route or caller; falls back to manifest default. */
  readonly variant: string | undefined;
}

const VALID: readonly LoadingVariant[] = ['marine', 'dungeon', 'paladin-castle', 'default'];

function resolveVariant(requested: string | undefined, fallback: LoadingVariant): LoadingVariant {
  if (requested && (VALID as readonly string[]).includes(requested)) {
    return requested as LoadingVariant;
  }
  return fallback;
}

export function LoadingScreenRotator(props: LoadingScreenRotatorProps): JSX.Element {
  const [manifest] = createResource(() =>
    mockClient.get<LoadingScreenManifest>('/v1/loading-screens'),
  );

  const screen = createMemo(() => {
    const m = manifest();
    if (!m) return null;
    return pickVariant(m, props.variant);
  });

  const quote = createMemo(() => {
    const m = manifest();
    const s = screen();
    if (!m || !s) return null;
    return pickQuote(m, s.variant);
  });

  return (
    <Show when={manifest()} fallback={<Loading label="The veil draws…" />}>
      {(m) => {
        const variant = resolveVariant(props.variant, m().default);
        const tagline = screen()?.tagline ?? 'A Journey. A Choice. A Life.';
        const q = quote();
        switch (variant) {
          case 'marine':
            return <LoadingScreenMarine tagline={tagline} quote={q} />;
          case 'dungeon':
            return <LoadingScreenDungeon tagline={tagline} quote={q} />;
          case 'paladin-castle':
            return <LoadingScreenPaladinCastle tagline={tagline} quote={q} />;
          default:
            return <LoadingScreenDefault tagline={tagline} quote={q} />;
        }
      }}
    </Show>
  );
}
