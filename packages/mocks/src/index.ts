/**
 * @br/mocks — static JSON stubs + MockClient + MSW handlers.
 *
 * Wave 3 consumers should import from this barrel for the in-process client
 * and data loaders, and from `@br/mocks/browser` to start the MSW worker.
 */

export {
  MockClient,
  MockClientError,
  type MockClientOptions,
  type MockRequestInit,
} from './client';
export { MockFailure, type FailureMode, failureFor } from './failure';
export { getLatencyMs, setLatency, sleep } from './latency';

// Route table is exported so dev panels can introspect available endpoints.
export {
  routeTable,
  matchRoute,
  compilePattern,
  type RouteEntry,
  type Method,
} from './route-table';

// Composite handler array (also re-exported per-domain for selective use).
export {
  handlers,
  authHandlers,
  accountHandlers,
  shardHandlers,
  worldHandlers,
  characterHandlers,
  inventoryHandlers,
  questHandlers,
  bookHandlers,
  dialogHandlers,
  combatHandlers,
  economyHandlers,
  socialHandlers,
  voiceHandlers,
  optionsHandlers,
  miscHandlers,
} from './handlers';

// Re-export the static JSON loaders for SSR / tests / dev panels that want
// the raw fixture data without going through the client.
export * as fixtures from './data-loader';
