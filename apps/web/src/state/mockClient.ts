// Singleton MockClient for the web app. Wave 3 will replace this with a typed
// service-layer (e.g. `accountService`, `worldService`) that wraps the same
// endpoint-shaped client; the eventual swap to a real `ProtobufClient` is then
// a one-file substitution per Doc #41.

import { MockClient } from '@br/mocks';

export const mockClient = new MockClient({
  // Small artificial delay to make Suspense visible during dev.
  latencyMs: 120,
});
