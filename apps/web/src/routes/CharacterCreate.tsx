// `/character/create` — character creation placeholder (10-1-AvatarCreation.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function CharacterCreate(): JSX.Element {
  return (
    <Placeholder
      title="Forge an Avatar"
      description="Race, class, virtue alignment, stat roll, portrait."
      endpoint="GET /v1/characters/templates"
      load={() => mockClient.get('/v1/characters/templates')}
    />
  );
}
