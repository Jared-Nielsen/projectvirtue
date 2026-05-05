// `/play/dialog/:npcId` — branching dialog modal placeholder (9-1-DialogModals.png).

import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Dialog(): JSX.Element {
  const params = useParams<{ npcId: string }>();
  return (
    <Placeholder
      title={`Dialog — ${params.npcId}`}
      description="Branching dialog tree with response chips."
      endpoint={`GET /v1/dialog/${params.npcId}`}
      load={() => mockClient.get(`/v1/dialog/${params.npcId}`)}
    />
  );
}
