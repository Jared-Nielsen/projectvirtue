// `/loading/:variant` — loading-screen dispatcher.
//
// Reads the manifest from /v1/loading-screens (sourced from
// @br/mocks `loadingscreens/index.json`), picks the requested variant or
// falls back to the manifest default, and shows a random lore quote.

import type {
  LoadingScreenManifest,
  LoadingScreen as LoadingScreenT,
  LoadingVariant,
} from '@br/types';
import { Card, Loading, Stack } from '@br/ui';
import { useParams } from '@solidjs/router';
import { type JSX, Show, createMemo, createResource } from 'solid-js';
import { mockClient } from '../state/mockClient';

const VARIANTS: readonly LoadingVariant[] = ['marine', 'dungeon', 'paladin-castle', 'default'];

function isVariant(v: string): v is LoadingVariant {
  return (VARIANTS as readonly string[]).includes(v);
}

function pickVariant(manifest: LoadingScreenManifest, requested: string): LoadingScreenT | null {
  const target = isVariant(requested) ? requested : manifest.default;
  const exact = manifest.variants.find((v) => v.variant === target);
  if (exact) return exact;
  return manifest.variants[0] ?? null;
}

function pickQuote(screen: LoadingScreenT): { text: string; attribution: string } | null {
  if (screen.quotes.length === 0) return null;
  const idx = Math.floor(Math.random() * screen.quotes.length);
  return screen.quotes[idx] ?? null;
}

export function LoadingScreen(): JSX.Element {
  const params = useParams<{ variant: string }>();
  const [manifest] = createResource(() =>
    mockClient.get<LoadingScreenManifest>('/v1/loading-screens'),
  );

  const screen = createMemo(() => {
    const m = manifest();
    if (!m) return null;
    return pickVariant(m, params.variant ?? '');
  });

  const quote = createMemo(() => {
    const s = screen();
    return s ? pickQuote(s) : null;
  });

  return (
    <Show when={screen()} fallback={<Loading label="The veil draws…" />}>
      {(s) => (
        <Card>
          <Stack gap="4" align="center">
            <h1 style={{ margin: 0, 'letter-spacing': '0.04em' }}>{s().tagline}</h1>
            <div
              aria-hidden="true"
              style={{
                width: '100%',
                'aspect-ratio': '21 / 9',
                'background-color': s().tint,
                'border-radius': 'var(--br-radius-md, 6px)',
                display: 'grid',
                'place-items': 'center',
                color: 'rgba(255,255,255,0.5)',
                'font-family': 'monospace',
              }}
            >
              [ {s().variant} ]
            </div>
            <Show when={quote()}>
              {(q) => (
                <blockquote style={{ margin: 0, 'max-width': '52ch', 'text-align': 'center' }}>
                  <p style={{ margin: 0, 'font-style': 'italic' }}>&ldquo;{q().text}&rdquo;</p>
                  <footer style={{ 'margin-top': '0.5rem', opacity: 0.7 }}>
                    — {q().attribution}
                  </footer>
                </blockquote>
              )}
            </Show>
          </Stack>
        </Card>
      )}
    </Show>
  );
}
