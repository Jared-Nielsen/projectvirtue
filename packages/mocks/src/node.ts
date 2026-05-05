// Node-side MSW server setup. Used by vitest and SSR test paths.
//
// Typical vitest wiring:
//
//   // test/setup.ts
//   import { setupMockServer } from '@br/mocks/node';
//   const server = setupMockServer();
//   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
//   afterEach(() => server.resetHandlers());
//   afterAll(() => server.close());

import { type SetupServer, setupServer } from 'msw/node';
import { handlers } from './handlers';

let serverSingleton: SetupServer | null = null;

export function setupMockServer(): SetupServer {
  if (!serverSingleton) {
    serverSingleton = setupServer(...handlers);
  }
  return serverSingleton;
}

export function getMockServer(): SetupServer | null {
  return serverSingleton;
}

export { handlers } from './handlers';
