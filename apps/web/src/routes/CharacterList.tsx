// `/character` — list of saved avatars. Phase 5 fills in the rich card UI;
// this placeholder proves wiring to `/v1/characters`.

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function CharacterList(): JSX.Element {
  return (
    <Placeholder
      title="Characters"
      description="Choose an avatar to bring into the world."
      endpoint="GET /v1/characters"
      load={() => mockClient.get('/v1/characters')}
    />
  );
}
