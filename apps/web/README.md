# @br/web — Game Client

Solid + Vite + (eventually) PixiJS client for Britannia Reborn.

This is the **Phase 0 scaffold**. The mock-to-real backend swap, full route map,
PixiJS canvas, and game screens are all out of scope here.

For the full plan see `/_todo/todobatch2.txt`. In particular:

- Phase 2 stands up `@br/mocks` with static JSON + `MockClient` + MSW.
- Phase 3 wires `@solidjs/router` and the route map (login, character, play, ...).
- Phase 6 boots the PixiJS canvas inside the `/play` route.

The eventual swap from mocks to real backend goes through the `MockClient`
seam in `@br/mocks` — replace it with a `ProtobufClient` that hits the Rust
shard server (Doc #41).
