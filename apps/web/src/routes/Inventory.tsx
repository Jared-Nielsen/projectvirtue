// `/play/inventory` — overlay placeholder (InterfaceInventory.png).

import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Inventory(): JSX.Element {
  return (
    <Placeholder
      title="Inventory"
      description="Equipment, bag grid, weight bar, paperdoll preview."
      endpoint="GET /v1/inventory/items"
      load={() => mockClient.get('/v1/inventory/items')}
    />
  );
}
