// `/play/inventory` — overlay route that mounts the inventory screen. The
// real layout, drag/drop, and tooltip wiring live in the dedicated module
// under `../inventory/InventoryScreen` so the same component is reachable
// from in-world hotkeys (Wave 4) without re-routing.

import type { JSX } from 'solid-js';
import { InventoryScreen } from '../inventory/InventoryScreen';

export function Inventory(): JSX.Element {
  return <InventoryScreen />;
}
