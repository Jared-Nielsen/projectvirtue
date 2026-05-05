// `/play` — main game world. Phase 6 mounts a PixiJS canvas here; for Phase 3
// it is a placeholder div, but the surrounding `PlayLayout` chrome is real.

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Play(): JSX.Element {
  return (
    <Placeholder
      title="World"
      description="PixiJS canvas mount target (Phase 6)."
      endpoint="GET /v1/world/regions"
      load={() => mockClient.get('/v1/world/regions')}
    >
      <div
        aria-label="Canvas placeholder"
        style={{
          'aspect-ratio': '16 / 9',
          'background-color': 'rgba(0,0,0,0.6)',
          'border-radius': 'var(--br-radius-md, 6px)',
          display: 'grid',
          'place-items': 'center',
          color: 'rgba(255,255,255,0.4)',
          'font-family': 'monospace',
        }}
      >
        [ canvas ]
      </div>
    </Placeholder>
  );
}
