// Pre-game shell — used by `/`, `/login`, `/home`, `/character/*`, `/loading/:variant`.
// Plain centred parchment frame; no HUD, no canvas. Phase 5 components fill in
// the actual screens (Home, CharacterList, etc.); this layout only chrome.

import { Loading, Stack } from '@br/ui';
import { type JSX, Suspense } from 'solid-js';

export interface MenuLayoutProps {
  children?: JSX.Element;
}

export function MenuLayout(props: MenuLayoutProps): JSX.Element {
  return (
    <main
      data-layout="menu"
      style={{
        'min-height': '100vh',
        display: 'flex',
        'flex-direction': 'column',
        'background-color': 'var(--br-color-surface-base, #14110c)',
        color: 'var(--br-color-ink, #e8e2d2)',
      }}
    >
      <Stack
        gap="6"
        style={{
          flex: '1 1 auto',
          padding: 'var(--br-space-8, 2rem)',
          'max-width': '960px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Suspense fallback={<Loading label="Summoning…" />}>{props.children}</Suspense>
      </Stack>
    </main>
  );
}
