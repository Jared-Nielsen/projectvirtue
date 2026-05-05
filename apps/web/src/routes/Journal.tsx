// `/play/journal` — quest log + lore tabs placeholder (9-4-Journal.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Journal(): JSX.Element {
  return (
    <Placeholder
      title="Journal"
      description="Active quests, log history, codex links."
      endpoint="GET /v1/quests/active"
      load={() => mockClient.get('/v1/quests/active')}
    />
  );
}
