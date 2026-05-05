# @br/mocks

Static JSON stubs, an in-process `MockClient`, and an MSW handler set for the
Britannia Reborn frontend. Phase 2 deliverable; lives under
`/packages/mocks` of the monorepo.

## What's mocked

| Domain | Endpoints | JSON fixtures |
| --- | --- | --- |
| Auth | `POST /v1/auth/login`, `GET /v1/auth/me`, `POST /v1/auth/logout` | `data/auth/*.json` |
| Account | `GET/PUT /v1/account/profile`, `GET/PUT /v1/account/preferences` | `data/account/*.json` |
| Shard | `GET /v1/shards`, `GET /v1/shards/status` | `data/shards/*.json` |
| World | `GET /v1/world/regions`, `GET /v1/world/tiles/:regionId`, `GET /v1/world/npcs`, `GET /v1/world/landmarks` | `data/world/**/*.json` |
| Character | `GET /v1/characters`, `GET /v1/characters/templates`, `GET /v1/characters/portraits`, `POST /v1/characters` | `data/character/*.json` |
| Inventory + items | `GET /v1/inventory/items`, `GET /v1/inventory/equipment`, `GET /v1/inventory/loot/:lootId`, `GET /v1/items/catalog` | `data/inventory/**/*.json`, `data/items/*.json` |
| Quests + journal + books | `GET /v1/quests/active`, `GET /v1/quests/log`, `GET /v1/quests/templates`, `GET /v1/journal`, `GET /v1/books/codex`, `GET /v1/books/:bookId` | `data/quests/*.json`, `data/journal/*.json`, `data/books/*.json` |
| Dialog | `GET /v1/dialog/lord-british`, `GET /v1/dialog/iolo`, `GET /v1/dialog/branch` | `data/dialog/*.json` |
| Combat | `GET /v1/combat/state`, `GET /v1/combat/abilities`, `GET /v1/combat/spellbook`, `GET /v1/combat/dragon-encounter` | `data/combat/*.json` |
| Economy + crafting | `GET /v1/economy/market-listings`, `GET /v1/crafting/recipes`, `GET /v1/crafting/stations` | `data/economy/*.json`, `data/crafting/*.json` |
| Social + voice | `GET /v1/social/friends`, `GET /v1/social/guild`, `GET /v1/social/chat-history`, `GET /v1/voice/channels` | `data/social/*.json`, `data/voice/*.json` |
| Options | `GET/PUT /v1/options/{keybindings,audio,video,accessibility,gameplay}` | `data/options/*.json` |
| Misc | `GET /v1/levelup/sample`, `GET /v1/loading-screens`, `GET /v1/discord/presence`, `GET /v1/gm/campaigns`, `GET /v1/gm/campaigns/:id`, `POST /v1/telemetry/events` | `data/levelup/*.json`, `data/loadingscreens/*.json`, `data/discord/*.json`, `data/gm/*.json`, `data/telemetry/*.json` |

The canonical route table is `src/route-table.ts`. Per-domain handler files
under `src/handlers/` filter that table by URL prefix; both the in-process
`MockClient` and the MSW handlers consume the **same** loader functions in
`src/data-loader.ts`.

## Two consumers, one data set

There are two ways to consume these mocks; both share the same JSON fixtures
and the same route table.

1. **MSW worker (browser dev mode).** Apps install Mock Service Worker and
   call:

   ```ts
   // apps/web/src/main.tsx
   import { startMockWorker } from '@br/mocks/browser';

   if (import.meta.env.DEV) {
     await startMockWorker();
   }
   ```

   Real `fetch` calls in the browser are intercepted by the service worker
   and returned with mock JSON. **Production builds do not register the
   worker** — that's the whole point of the dev-only branch above.

   The worker file (`mockServiceWorker.js`) must be served from each app's
   public directory. Generate it once per app:

   ```bash
   pnpm dlx msw init apps/web/public --save
   pnpm dlx msw init apps/site/public --save
   ```

2. **`MockClient` (SSR / vitest / before MSW boots).** A fetch-shaped
   in-process client used in non-browser contexts and during the brief
   window before the service worker is ready:

   ```ts
   import { MockClient } from '@br/mocks';
   const client = new MockClient();
   const me = await client.get<Me>('/v1/auth/me');
   ```

   `MockClient` does not go through the service worker. It calls the route
   table directly; useful for tests and SSR.

3. **Vitest mock server.** The Node MSW server for unit / integration tests:

   ```ts
   // test/setup.ts
   import { setupMockServer } from '@br/mocks/node';
   const server = setupMockServer();
   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
   afterEach(() => server.resetHandlers());
   afterAll(() => server.close());
   ```

## Failure injection / latency

The dev panel (Wave 3) toggles two `sessionStorage` flags that the mock
layer reads on every request:

| Key | Values | Effect |
| --- | --- | --- |
| `br.mock.latencyMs` | non-negative integer | Artificial delay applied before each response |
| `br.mock.failureMode` | `auth`, `forbidden`, `not-found`, `server`, `timeout`, `network` | Short-circuit every request with the matching synthetic failure |

Both apply to **the MSW worker and the MockClient**. The MockClient also
exposes programmatic setters for tests:

```ts
const client = new MockClient({ latencyMs: 0, failureMode: 'server' });
client.setLatency(250);
client.setFailureMode(null);
```

`failureMode = 'network'` produces a real fetch network error (no JSON
body), which is useful for testing transport-error handling. The other
modes return a typed `ApiError` JSON body with the matching HTTP status.

## Type contract

Types come from `@br/types`, which is hand-written for now and structured
to mirror the eventual `/shared/proto` codegen output (Doc #22 §4.5). When
protobuf codegen lands, `@br/types/src` is replaced wholesale; this package
should keep building because it consumes types only by name.

> **TODO(zod):** runtime validation is not in this package yet. When it
> lands, `data-loader.ts` should pipe each fixture through the matching
> Zod schema before returning. Until then, the `as unknown as T` casts at
> the loader boundary are deliberate — JSON has no nominal types and the
> brand types in `@br/types` are erased at runtime.

## Swap path to a real backend

When the Rust authoritative server (Doc #41) and the Protobuf wire schema
(Doc #22 §4.5) come online, the migration is mechanical:

1. Replace `MockClient` instantiation with a `ProtobufClient` that talks
   to the real `/v1/*` endpoints (or, if the wire format is binary, the
   protobuf gateway). All call sites stay the same — the methods on the
   client are intentionally fetch-shaped.
2. Delete `startMockWorker()` invocations in `apps/*/src/main.tsx`. The
   service worker stops registering; MSW handlers are dropped from the
   bundle by tree-shaking.
3. Delete `@br/mocks/data/*.json`. The hand-written types in `@br/types`
   are replaced by codegen output. Anything that breaks at the call site
   gets fixed where it breaks (typecheck guides the edits).
4. Test setup (`setupMockServer`) stays useful for unit tests; the same
   handler array can talk to a real backend in integration mode by
   delegating instead of returning fixtures.

The intent is that **no UI code knows whether it's talking to a mock or a
real backend**. Everything funnels through `MockClient` (or its eventual
real cousin) and through services that the client populates.
