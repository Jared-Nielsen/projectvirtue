// `/play/levelup` — level-up celebration placeholder (9-3-ModalGainedALevel.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function LevelUp(): JSX.Element {
  return (
    <Placeholder
      title="Level Up"
      description="Stat allocation modal."
      endpoint="GET /v1/levelup/sample"
      load={() => mockClient.get('/v1/levelup/sample')}
    />
  );
}
