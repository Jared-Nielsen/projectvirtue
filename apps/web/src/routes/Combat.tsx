// `/play/combat` — CombatHUD overlay placeholder (2-2-CombatForest.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Combat(): JSX.Element {
  return (
    <Placeholder
      title="Combat"
      description="Active encounter snapshot — abilities, spellbook, target ring."
      endpoint="GET /v1/combat/state"
      load={() => mockClient.get('/v1/combat/state')}
    />
  );
}
