// `/play/loot/:lootId` — loot chest grid placeholder (9-2-LootChest.png).

import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Loot(): JSX.Element {
  const params = useParams<{ lootId: string }>();
  return (
    <Placeholder
      title={`Loot — ${params.lootId}`}
      description="Take-all, take-one, weight."
      endpoint={`GET /v1/inventory/loot/${params.lootId}`}
      load={() => mockClient.get(`/v1/inventory/loot/${params.lootId}`)}
    />
  );
}
