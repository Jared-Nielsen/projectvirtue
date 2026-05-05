// Composite MSW handler array. Apps wire this into setupWorker() (browser)
// or setupServer() (node/vitest).
//
// Each domain file exists for human navigability — the underlying source of
// truth is `route-table.ts`. To add or remove an endpoint, edit the route
// table; the per-domain files automatically pick up entries that match their
// prefix.

import { allHandlers } from './_lib';

export { authHandlers } from './auth';
export { accountHandlers } from './account';
export { shardHandlers } from './shard';
export { worldHandlers } from './world';
export { characterHandlers } from './character';
export { inventoryHandlers } from './inventory';
export { questHandlers } from './quest';
export { bookHandlers } from './book';
export { dialogHandlers } from './dialog';
export { combatHandlers } from './combat';
export { economyHandlers } from './economy';
export { socialHandlers } from './social';
export { voiceHandlers } from './voice';
export { optionsHandlers } from './options';
export { miscHandlers } from './misc';

export const handlers = allHandlers();
