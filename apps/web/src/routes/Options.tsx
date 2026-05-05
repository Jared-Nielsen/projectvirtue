// `/play/options` — placeholder for the tabbed options screen (9-9-Options.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Options(): JSX.Element {
  return (
    <Placeholder
      title="Options"
      description="Audio, video, controls, gameplay, accessibility."
      endpoint="GET /v1/options/audio"
      load={() => mockClient.get('/v1/options/audio')}
    />
  );
}
