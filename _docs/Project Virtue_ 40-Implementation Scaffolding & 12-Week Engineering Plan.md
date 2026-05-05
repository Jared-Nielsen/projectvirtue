# 40 — Implementation Scaffolding & 12-Week Engineering Plan

Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Implementation Kickoff Draft)
Date: May 2026
Author: [Engineering Lead]
Status: Normative engineering plan — selects repo strategy, language stack, build/CI tooling, branching model, and the week-by-week deliverable schedule that lifts Doc #11 into committed code. All BLOCK-P1 design questions are resolved per Doc #25; this doc is the green-light kickoff for Phase 1 prototype construction.

> **Updated 2026-05-04** to reflect Doc #41 — Engine & Stack ADR. The client section is now SPLIT into two production targets: **Client A — UE5** (production: desktop + PS5 + Xbox; carries cert, platform identity, voice I/O, full fidelity) and **Client B — TS / PixiJS / Solid.js** (permanent product surface, per Doc #41 OQ-2 resolution, 2026-05-04; web only; feature subset of Client A; never console; never authoritative). The authoritative server (Rust, single implementation) is unchanged. The wire protocol in `/shared/proto` (Protobuf, codegen for Rust + C++ + TS) is the source of truth; UE5 native replication is FORBIDDEN; the UE5 client is a "dumb view" that talks raw sockets to the Rust server. Determinism remains server-side only. See Doc #41 for the full 12-system boundary table.

Depends on: #1 Vision, #2 GDD, #4 Simulation, #6 Persistent World, #9 Tooling, #10 Style Bible, #11 Prototype Scope & Milestone Roadmap, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface, #21 Save Format & Shard DB, #22 Network Protocol & Replication, #23 Pathfinding & Spatial Systems, #25 BLOCK-P1 Resolutions, #28 Telemetry, #29 Moderation & Admin Tools, #31 Sprite Animation Pipeline, #32 Anti-cheat & Security Hardening, #33 Localization, #34 Accessibility.

Resolves: the engineering-execution `[OPEN]` set implicit in Doc #11 §4 (week-by-week deliverable definitions); supersedes the engine recommendation in Doc #9 §4 — see §3 below for the deliberate revision and migration note.

> **Note on Doc #9 supersession.** Doc #9 (May 2026, v1.1) recommended Unreal Engine 5 as the primary engine. That recommendation was made before the Doc #13 schema crystallised and before Docs #21–#23 nailed down the persistence + networking + pathfinding contracts. With those contracts now fixed, the actual workload of the authoritative server is *deterministic ECS simulation, dispatcher arbitration, JSONB persistence, and A* pathfinding* — none of which benefit from UE5's renderer, physics, or actor model. The 2D pixel-art client likewise does not need UE5. This doc therefore selects a Rust authoritative server + TypeScript browser client stack (§3). The `UE Subsystem` framing inside Doc #14 §2 is rewritten as a Rust crate (`mcp-server`) co-resident with the simulation; all five MCP invariants (Doc #14 §4) and all dispatcher contracts (Doc #13 §4) are preserved verbatim.

---

## 1. Purpose & Scope

This document is the engineering counterpart to the design-side build bible (Doc #11). It answers, concretely:

1. **Where does the code live?** — repo layout, monorepo strategy, workspace tool.
2. **What language is each layer written in, and why?** — language-pick rationale matrix.
3. **How do shared types stay in sync between server and client?** — codegen pipeline.
4. **How is the dev loop bootstrapped on a fresh laptop?** — local environment, seed data, devcontainer.
5. **How is correctness defended on every commit?** — CI matrix, test taxonomy, determinism harness.
6. **How are 12 weeks of work sequenced into shippable per-week deliverables?** — the schedule, with per-week DoD.

Out of scope for this document:
- Game-design content (Docs #2, #3, #5, #15–#19).
- Wire-format byte layouts (Doc #22 §4 owns this).
- DDL details (Doc #21 owns this).
- Sprite asset format (Doc #31 owns this).

---

## 2. Repo Strategy

### 2.1 Decision: monorepo

**Project Virtue ships as a single Git monorepo.** All server, client, shared schema, tooling, content, infrastructure, and documentation live under one repository, one CI graph, one commit history.

### 2.2 Justification

| Factor | Monorepo | Polyrepo | Verdict |
|---|---|---|---|
| Shared schema (Doc #13 Entity, Doc #22 wire types) drift across server/client | Atomic commit lands schema + server + client + codegen artifacts together | Schema bumps require coordinated 3-way PRs; window of incoherence | **monorepo** |
| Refactor a verb (Doc #13 §2) across dispatcher + client UI + UGC API | Single PR; CI runs all impacted packages | Multi-repo ceremony; stale artifacts likely | **monorepo** |
| Onboarding | `git clone && pnpm i && cargo build` | Clone N repos, hunt versions | **monorepo** |
| Build-graph caching | Tool-native (Cargo + pnpm + Turborepo), incremental | Per-repo CI; N parallel pipelines, no cross-cache | **monorepo** |
| Per-team ownership boundaries | `CODEOWNERS` per directory | Repo permissions | **either; CODEOWNERS is sufficient** |
| Repo size at Phase 1 | ~2 GB once content + legacy assets land (Doc #31 §12) | Splits across repos but same total | **monorepo, with Git LFS for binaries** |
| External UGC contributors | Forks the same repo; submit PRs | Has to know which repo | **monorepo** |
| Open-source split if we ever ship the engine separately | Subtree-split via `git subtree split` | Already split | **monorepo** (we can extract later; we cannot easily merge back) |

The single dispositive factor is **schema co-evolution**. The Entity, Verb, and PersistenceScope models in Doc #13 are touched by virtually every subsystem. A polyrepo split would force every Doc #13 change into a multi-PR dance with stale artifacts in between. We reject that operational cost.

### 2.3 Tooling: pnpm + Cargo + Turborepo

The repo holds three native build graphs:

- **Cargo workspace** for all Rust crates (server, shared schema, codegen, tools).
- **pnpm workspace** for all TypeScript packages (client, shared TS bindings, web tooling).
- **Turborepo** as the cross-language task orchestrator that knows how to run "build all / test all / lint all" with topological order, remote caching (Turbo Cloud or self-hosted via `@turbo/server`), and incremental hash-based skip.

| Tool | Why this and not the alternatives |
|---|---|
| **Cargo workspace** | Native to Rust; first-class incremental compilation; `cargo nextest` for parallel test runs; trivially CI-integrable. Bazel rejected — overhead doesn't pay back at our crate count. |
| **pnpm workspaces** | Hard-link node_modules (10× faster install vs npm/yarn-classic), strict isolation prevents phantom dependencies, native workspace protocol (`workspace:*`). Yarn Berry rejected — PnP causes pain with TypeScript + Vite. Lerna rejected — abandoned. |
| **Turborepo** | Cross-language task orchestration with content-hash caching; reads `turbo.json` task graph. Nx rejected — heavier, generator-centric, harder to integrate with a non-TS root. Bazel rejected as above. Make rejected — no caching. |

Rust crates and TS packages do not depend on each other directly at the build-graph level. They communicate via:
- **Generated artifacts** (codegen outputs in `/shared/generated/{rust,ts}`) — see §4.
- **Wire protocol** at runtime (Doc #22).
- **Process boundaries** (server → client over WebSocket).

This means the build graphs are largely independent; Turborepo only needs to enforce that codegen runs before either side compiles.

### 2.4 Git LFS

The following file globs are managed by Git LFS to keep base clone size sane:

```
*.png                    # sprite frames (Doc #31)
*.aseprite               # source art
*.ogg *.wav *.flac       # audio (Doc #27)
*.act *.pal              # palette tables
content/maps/**/*.bin    # exported map binaries
content/legacy/**/*      # 1992 reference assets (gated to license-holder access)
```

Engineers without LFS configured see pointer files — CI fails fast with a clear error message in that case (see §6.4).

---

## 3. Language & Framework Picks per Layer

### 3.1 Decision matrix

| Layer | Pick | Runner-up | Why this | Why not the runner-up |
|---|---|---|---|---|
| **Authoritative server (sim, dispatcher, replication, persistence)** | **Rust 1.78+** with Tokio + `bevy_ecs` (the ECS crate, used standalone — no `bevy` renderer, no `bevy_app` plugin sprawl) | Go 1.22 | Determinism (no GC pauses messing with 20 Hz sim tick, Doc #22 §3); zero-cost abstractions for the per-tick verb dispatcher hot path; type-system enforces the Doc #13 component-write contract via the borrow checker; `bevy_ecs` is a battle-tested archetype-based ECS without dragging the full Bevy renderer | Go's GC is fine for most servers but at 20 Hz with strict per-tick budgets, a stop-the-world pause is a measurable correctness risk for the lag-comp window; Go's lack of generics-based ECS means we'd hand-roll archetype storage; harder to encode Doc #13's `[I*]`-vs-`[I]` write rules at the type level |
| **Network runtime** | **Tokio** + `tokio-tungstenite` (WebSocket) + custom framed codec | `axum` for HTTP / SSE | Tokio is the de-facto async runtime; `tokio-tungstenite` is mature; we control framing for MessagePack channels (Doc #22 §4.1) | `axum` is used for the auth-stub HTTP service, just not for the game socket — see §3.4 |
| **ECS** | **`bevy_ecs` 0.14** (standalone) | `legion`, `hecs`, custom | Active maintenance, archetype storage matches our component-bag model, parallel system scheduling with explicit conflict detection | `legion` is essentially unmaintained as of 2025; `hecs` lacks parallel scheduling; rolling our own at Phase 1 is scope creep |
| **Spatial index (Doc #23 §9)** | **`rstar`** (R-tree) for entity broad-phase + custom tile grid for tile-static passability | `kdtree`, custom only | R-tree handles the dynamic-entity broad-phase well; tile grid is trivial 2D bitmap | `kdtree` rebalancing cost on every move is bad |
| **Pathfinding (Doc #23 §5)** | **`pathfinding`** crate (A* implementation) wrapped in our `MoverArchetype` query | hand-rolled A* | Library is correct, fast, well-tested; we own the cost-function lambda and the early-termination heuristic | Hand-roll is reinventable but Phase 1 will not benefit from ours |
| **Database driver** | **`sqlx`** (compile-time-checked SQL) for PostgreSQL; **`rusqlite`** for the local SQLite save (Doc #21 §2.1) | `diesel`, `sea-orm` | `sqlx` checks queries against a real DB schema at build time — catches Doc #21 DDL drift on the dev machine, before CI; supports Postgres + SQLite with the same query macros where possible | `diesel` is an ORM-first abstraction we don't want; `sea-orm` adds a layer for queries we'd rather write as SQL |
| **Cache / pubsub** | **Redis 7** via `redis-rs` async | KeyDB | Native Tokio support; Doc #21 §2.2 already names Redis | KeyDB is fine but no compelling reason to deviate |
| **Cross-region bus** | **NATS** via `async-nats` | Redis pub/sub fallback | Doc #22 §2 already lists NATS as preferred | Redis pub/sub is the documented fallback; we keep the abstraction trait so we can swap in tests |
| **Client A — UE5 (production: desktop + PS5 + Xbox; carries cert)** | **Unreal Engine 5** (renderer, input, UI, platform identity, voice I/O, full fidelity) | Unity, Godot | Per Doc #41: the production client across desktop and console. Cert-bearing platform binary; full audio fidelity; voice I/O. **MUST** treat itself as a "dumb view": zero authoritative logic, native UE5 replication FORBIDDEN, talks raw sockets to the Rust server using the `/shared/proto` wire schema (codegen → C++) | See Doc #9 §3 evaluation — UE5 wins on console + fidelity; alternatives ruled out there |
| **Client B — TS / PixiJS / Solid.js (permanent product surface, per Doc #41 OQ-2 resolution 2026-05-04)** | **TypeScript 5.5 + Vite + PixiJS 8 + Solid.js** | Phaser 4, Excalibur, Bevy in WASM | Per Doc #41: web-only thin client and a **permanent product surface** (not a Phase-1 throwaway). Builds the W3–W6 vertical slice and continues forever as the web-feature-flagged subset of Client A. NEVER console. NEVER authoritative. NEVER carries exclusive features (may OMIT features; never ADD). PixiJS is a tight, fast 2D scene-graph; we own the gameplay layer above it which matches our Doc #13 entity model; runs in any modern browser; no platform-store gatekeeping for the public web reach (Doc #6 §2). Solid.js overlay handles paperdoll/dialogue/spellbook (Doc #15 §5, Doc #17) with fine-grained reactivity. | Phaser is heavier and bundles state/scene/physics machinery we'd be fighting against; Excalibur is small but younger ecosystem; Bevy-in-WASM ships ~5 MB minimum and demands shared-array-buffer headers we'd rather not require for a public web client |
| **Shared types** | **Custom Rust→TS codegen via `ts-rs` 9.0** for internal Rust types; **Protobuf in `/shared/proto` is the wire source of truth** with codegen for **Rust + C++ (UE5) + TS** per Doc #41 | protobuf for everything, flatbuffers, capnproto | `ts-rs` lets the Rust types in `crates/shared` be the source of truth for *internal* shapes; the **wire** is protobuf-defined in `/shared/proto` so all three clients (Rust internal, C++ UE5, TS web) speak the same envelopes — see Doc #41 boundary table; flatbuffers/capnproto are zero-copy formats whose ergonomic cost is not justified at our message rates (10 Hz state, ~10/sec verbs/client) | Pure-protobuf-everything forces every internal Rust type to be a `prost`-generated struct — fights our Doc #13 component bag; flatbuffers lifetime story is rough in Rust |
| **Wire encoding** | **Protobuf for the wire envelope (per Doc #41 — `/shared/proto` is the source of truth, codegen for Rust + C++ + TS); MessagePack inner-channel encoding** (Doc #22 §4.1) via `rmp-serde` where applicable | JSON, CBOR, FlatBuffers | Doc #41 elevates protobuf from "handshake-only" to the canonical wire envelope so the UE5 (C++) and web (TS) clients can both decode the same packets; MessagePack remains an option for high-rate inner channels where the protobuf bump cadence would be a friction | JSON loses bytes at our scale; CBOR is fine but no advantage over Protobuf+MsgPack |
| **Asset pipeline** | **Aseprite CLI** for sprite extraction → custom Rust tool (`forge-assets`) for atlas + manifest gen → PNG + JSON sidecars (Doc #31 §2) | TexturePacker, Spine | Aseprite is the source of truth for pixel art; we own the manifest format (Doc #31) so a custom Rust tool gives us the exact output | TexturePacker is non-deterministic across versions; Spine is rigged 2D, wrong art style |
| **Audio (Doc #27)** | **`rodio`** server-side for SFX trigger fan-out; **Howler.js** client-side for playback | Web Audio raw, FMOD | Howler is the de-facto browser audio lib; FMOD is licensed and overkill for Phase 1 | — |
| **Auth** | **`forge-auth`** Rust binary (single-file binary, Phase 1 stub) — issues + introspects bearer tokens per Doc #25 §T-13-13 | Auth0, Keycloak, Supabase Auth | Doc #25 §T-13-13 is explicit: a small stub Phase 1, contract-first | Hosted auth providers are over-spec for the prototype demo |

### 3.2 Server: Rust + Tokio + bevy_ecs

The authoritative simulation runs as a single Rust binary, `forge-shard`. It is an ECS-driven, deterministic-by-tick game loop binding the Doc #14 §2 architecture diagram in Rust:

```
forge-shard (single binary)
├── tokio runtime
├── bevy_ecs World
│   ├── Components: Physical, State, Ownership, Container, Schedule, ScriptHook,
│   │               VirtueWeights, PersistenceScope, Combat, Magic, Perception,
│   │               Animation (Doc #31 §3)
│   └── Systems (scheduled at 20 Hz):
│       │  PerceptionTick → ScheduleTick (1 Hz gated) → AITick (2 Hz gated)
│       │  → DispatcherDrain → SimulationStep → ReplicationFlush (10 Hz gated)
│       └─ → PersistenceFlush (per write contract Doc #13 §4 step 5)
├── PlayerInputDispatcher (single ingress, Doc #13 §4 / Doc #14 §2)
├── VerbDispatcher (the choke point)
├── MCP Subsystem (`mcp-server` crate; stdio + SSE per Doc #14 §2)
├── Replication (per-region snapshot diff, Protobuf-encoded*, Doc #22)
└── Persistence (sqlx → Postgres / rusqlite → SQLite, Doc #21)
```

\* Wire encoding is Protobuf per ADR 0006 (supersedes ADR 0005 MessagePack); see §13.2.

The 20 Hz tick is driven by a `tokio::time::interval` with `MissedTickBehavior::Burst` so a long tick catches up rather than slipping silently — the determinism harness (§7.5) catches missed ticks via a watchdog.

### 3.3 Server determinism rules

These rules are mandatory and CI-enforced:

1. **No `HashMap` iteration in simulation systems.** Use `IndexMap` or sorted `BTreeMap`. CI lint via `clippy`'s `iter_without_into_iter` plus a custom lint script.
2. **No floating-point time.** All time is `u64` `ServerTick` (Doc #22 §3). Wall-clock `SystemTime` is permitted only at the Persistence boundary for `created_at` columns.
3. **Single RNG, seeded per shard.** `forge_rng::Rng` is the only RNG used in simulation; Doc #25 §T-13-7 (procedural-gen seed pinning) compatible.
4. **No `std::thread::spawn`.** All concurrency is `tokio::spawn`; the simulation step is single-threaded by construction (the parallel `bevy_ecs` scheduler is opt-in per system stage and disabled in the default Phase 1 build — turn back on once we have a determinism budget).
5. **Replay-test gate in CI.** A recorded 60-second session must replay byte-for-byte on Linux + macOS + (Phase 2) Windows runners.

### 3.4 Auth service: separate small binary

`forge-auth` is a small `axum`-based Rust HTTP server exposing the two endpoints in Doc #25 §T-13-13:

- `POST /auth/v1/issue` — designer/dev tooling issues a token mapping to a capability set.
- `POST /auth/v1/introspect` — the shard edge gateway calls this on every new MCP/SSE handshake.

State store: PostgreSQL (single table `tokens(token_hash, user_id, capabilities, expires_at)`) — separate database from the shard DB.

Phase 1 ships the stub form: a single hard-coded `dev-token` that introspects to `avatar.full` for the dev avatar. The contract is the introspection API shape, per Doc #25.

### 3.5 Clients: UE5 (production) + TS/PixiJS/Solid.js (web)

Per Doc #41, two clients are produced from the same Rust authoritative server and the same `/shared/proto` wire schema (codegen → Rust + C++ + TS). Both are subordinate views; neither holds authoritative state.

**Client A — UE5** (production: desktop + PS5 + Xbox; carries cert, platform identity, voice I/O, full audio + visual fidelity). Onboarding starts in W6; W12 goal = feature-equal between TS web and UE5 desktop. Console cert is Phase 2 (NOT in the 12-week prototype). **UE5 native replication is FORBIDDEN**; the UE5 client opens a raw socket to `forge-shard` and exchanges protobuf-encoded `ClientMessage`/`ServerMessage` envelopes. Zero authoritative logic ships in the UE5 client.

**Client B — TS / PixiJS / Solid.js** (web-only; **permanent product surface** per Doc #41 OQ-2 resolution, 2026-05-04 — not a Phase-1 throwaway). Builds the W3–W6 vertical slice and continues forever as a web-feature-flagged subset of Client A (may OMIT features, never ADD). Never console, never authoritative. Long-term hiring includes a permanent TS/PixiJS engineer role (not a short-term prototyper); CI investment, QA matrix, security review, accessibility (Doc #34), and localization parity (Doc #33) are on the same tier as Client A.

**Client B (web) layout:**

```
forge-client (Vite-built SPA)
├── PixiJS 8 scene
│   ├── TileLayer (z-floor stack; chunked streaming, §6.10 below)
│   ├── EntityLayer (sprite per Entity with [I*] state; Doc #31 AnimationComponent)
│   ├── EffectLayer (lighting, projectiles)
│   └── DebugLayer (dev-mode overlays)
├── Solid.js UI overlay
│   ├── PaperdollPanel (Doc #15 §5)
│   ├── DialoguePanel (Doc #17)
│   ├── SpellbookPanel (Doc #16)
│   ├── InventoryPanel (Doc #15)
│   ├── HUD (status, virtues, region label)
│   └── DevConsole (dev-only)
├── NetClient (WebSocket → Protobuf* → ClientMessage / ServerMessage)
├── PredictionEngine (movement-only, Doc #22 §6)
└── AssetLoader (manifest-driven, Doc #31)
```

\* Wire encoding is Protobuf per ADR 0006 (supersedes ADR 0005 MessagePack); see §13.2.

Audio (Doc #27) is a separate Howler.js wrapper bound to `EntitySpawn`/`EntityDelta` events. Localized strings (Doc #33) are loaded from a per-locale JSON bundle picked at boot.

### 3.6 Why not UE5 *for the server* (and why UE5 IS the production client)

**Updated 2026-05-04 per Doc #41.** The original v1.0 of this section argued against UE5 entirely. Doc #41 refines that: UE5 is rejected on the **server** for the reasons below, but is **selected as the production client** (Client A) for cert, console reach, voice I/O, and full audio/visual fidelity. This table is therefore now scoped to "why UE5 is not the authoritative server":

| UE5 strength | Phase 1 server need? | Verdict for SERVER use |
|---|---|---|
| AAA renderer with Lumen + Nanite | No — server is headless | unused server-side |
| Chaos physics | No — Doc #4 sim is custom Newtonian-lite, not Chaos | unused server-side |
| Native Replication graph | **No — FORBIDDEN per Doc #41.** Doc #22 specifies our own protobuf/WebSocket protocol; UE5 native replication MUST NOT be used. The UE5 client talks raw sockets to the Rust server. | forbidden by ADR |
| Blueprints visual scripting | No — our scripting is the Doc #19 UGC sandbox, separate language | unused server-side |
| Editor (UMG, Sequencer, World Composition) | No — our world editor is the in-game UGC editor (Doc #7); on the **client** UE5's UMG is fine for HUD work, but not server-relevant | client-only |
| Engine compile times | Negative server-side — UE5 cooks are 10–60 min, would kill server iteration loop | net negative for server |
| Server hosting cost | High — UE5 dedicated-server binaries are heavy | net negative |
| Web/browser deployment | Painful for the **web client** (UE5 → HTML5 was deprecated; pixel-streaming is bandwidth-heavy) — which is exactly why Client B (TS/PixiJS) exists alongside Client A | drives the two-client split |

UE5 IS the production client (desktop + PS5 + Xbox). The Rust authoritative server is single-implementation and the only place authoritative logic lives. The TS web client (Client B) covers the public web reach + W3–W6 vertical slice. See Doc #41 for the full 12-system boundary table.

---

## 4. Shared Schema & Codegen

### 4.1 Source of truth

**Rust types in `crates/shared` are the single source of truth.** Everything else is generated.

```
crates/shared/
├── src/
│   ├── entity.rs         // Doc #13 §1 — Entity, all components
│   ├── verb.rs           // Doc #13 §2 — VerbId, VerbInvocation, VerbResult
│   ├── persistence.rs    // Doc #13 §3 — PersistenceScope
│   ├── wire.rs           // Doc #22 §4 — ClientMessage, ServerMessage
│   ├── ids.rs            // EntityId, AvatarId, ShardId, RegionId, ServerTick, etc.
│   ├── animation.rs      // Doc #31 §3 — AnimationStateId, etc.
│   └── lib.rs
├── build.rs              // emits TS via ts-rs
└── Cargo.toml
```

Every public type derives `serde::Serialize`, `serde::Deserialize`, and `ts_rs::TS`. The `build.rs` step writes generated TS to `shared/generated/ts/`, which the client imports as `@forge/shared`.

Wire envelopes that need a hardened on-the-wire schema (the outer `ClientMessage` / `ServerMessage` union, the auth handshake) additionally have a protobuf `.proto` file in `shared/proto/`. The protobuf is the canonical wire schema; Rust uses `prost` and TS uses `ts-proto`. Both are committed to the repo (no codegen on first build).

### 4.2 Codegen pipeline

```
   crates/shared/src/*.rs   ──── ts-rs ──→  shared/generated/ts/*.ts   (consumed by client)
                                  │
                                  └─ git-checked: generated artifacts ARE committed
                                                  CI fails if regen produces a diff

   shared/proto/*.proto     ──── prost   ──→  crates/shared/src/wire_pb.rs
                            ──── ts-proto──→  shared/generated/ts/wire_pb.ts
```

Generated files are committed to Git. CI's `pnpm codegen:check` re-runs codegen and `git diff --exit-code`s — any drift is a build failure. This eliminates the "forgot to regen" class of bug.

### 4.3 Versioning

Each release of `crates/shared` bumps a `SCHEMA_VERSION: u32` constant. The client sends it in the `Auth` ClientMessage (Doc #22 §4.2). The server rejects mismatches with a clear `ERR_SCHEMA_VERSION` (Phase 2 will allow graceful degradation; Phase 1 hard-fails).

---

## 5. Top-Level Directory Layout

```
projectvirtue/
├── apps/
│   ├── forge-shard/             # Rust: the authoritative game server binary
│   ├── forge-auth/              # Rust: stub auth service
│   ├── forge-client/            # TypeScript: PixiJS + Solid.js client SPA
│   ├── forge-tools-cli/         # Rust: dev/admin CLI (seed, simulate, replay, dump)
│   └── forge-mcp-bridge/        # Rust: MCP stdio binary for local agents (Doc #14)
│
├── crates/                      # Rust workspace members
│   ├── shared/                  # Doc #13 + Doc #22 schema; ts-rs source of truth
│   ├── ecs/                     # bevy_ecs wrappers + component definitions
│   ├── verb-dispatcher/         # Doc #13 §4 dispatcher; verb registry; permission tables
│   ├── sim/                     # Doc #4 simulation systems (physics, fire, containers)
│   ├── virtue/                  # Doc #5 virtue scoring
│   ├── persistence/             # sqlx + rusqlite repositories; write contract enforcement
│   ├── replication/             # Doc #22 region replication
│   ├── spatial/                 # Doc #23 grid + R-tree + A* wrapper
│   ├── pathfinding/             # Doc #23 A* + cost lambdas
│   ├── network/                 # WebSocket + Protobuf codec* + channel mux
│   ├── mcp-server/              # Doc #14 surface; stdio + SSE
│   ├── audio-events/            # Doc #27 server-side SFX-trigger fan-out
│   ├── animation/               # Doc #31 server-side animation-state arbitration
│   ├── deterministic-rng/       # forge_rng::Rng (Doc #25 §T-13-7 compatible)
│   ├── telemetry/               # Doc #28 OTel + tracing wiring
│   ├── content-loader/          # archetype TOML + sprite manifest readers
│   ├── replay/                  # determinism harness; replay format
│   └── testkit/                 # cross-crate test utilities (mock dispatcher, mock DB)
│
├── packages/                    # TypeScript / pnpm workspace members
│   ├── client-core/             # PixiJS scene, input, prediction
│   ├── client-ui/               # Solid.js UI panels
│   ├── client-net/              # WebSocket + Protobuf client* 
│   ├── client-assets/           # asset loader, manifest types
│   ├── shared-ts/               # re-exports shared/generated/ts/* with a stable façade
│   └── eslint-config-forge/     # shared lint rules
│
├── shared/
│   ├── generated/
│   │   ├── rust/                # prost output (committed)
│   │   └── ts/                  # ts-rs output + ts-proto output (committed)
│   └── proto/                   # *.proto files
│
├── content/                     # Game content; under Git LFS where appropriate
│   ├── archetypes/              # *.toml — entity archetypes (Doc #13 §1)
│   ├── maps/britain/            # tile data + entity placement; binary maps + JSON sidecar
│   ├── maps/cave_of_trials/     # one procedural seed (Doc #11)
│   ├── sprites/                 # PNG frames + JSON metadata (Doc #31)
│   ├── audio/                   # OGG/WAV (Doc #27)
│   ├── localization/            # per-locale JSON (Doc #33)
│   ├── starting_kits.toml       # Doc #25 §T-15-6
│   └── data/                    # other reference TOML data files
│
├── tools/
│   ├── aseprite-export/         # CLI wrapper invoking Aseprite headless
│   ├── atlas-pack/              # forge-assets atlas builder (Rust)
│   ├── map-import/              # legacy U7 .DAT importer (Rust + Python helpers)
│   ├── archetype-lint/          # validates content/archetypes/*.toml against Doc #13
│   ├── style-validator/         # Doc #10 §6 style bible validator
│   └── replay-cli/              # command-line replay player
│
├── infra/
│   ├── docker/
│   │   ├── shard.Dockerfile
│   │   ├── auth.Dockerfile
│   │   ├── client.Dockerfile
│   │   └── postgres-init/
│   ├── docker-compose.yml       # local dev stack
│   ├── docker-compose.test.yml  # CI integration test stack
│   ├── terraform/               # cloud infra (Phase 2 placeholder)
│   ├── k8s/                     # Helm charts (Phase 2 placeholder)
│   └── grafana/                 # dashboards JSON (Doc #28 §4)
│
├── scripts/
│   ├── bootstrap.sh             # one-shot dev-env setup
│   ├── seed-shard.sh            # populate a local shard with Britain content
│   ├── run-determinism.sh       # replay-test runner
│   ├── codegen.sh               # ts-rs + prost regen
│   └── pre-commit.sh            # local pre-commit hook entrypoint
│
├── tests/
│   ├── integration/             # cross-crate integration; spins up real Postgres
│   │   ├── verb_dispatch/
│   │   ├── persistence/
│   │   ├── networking/
│   │   └── mcp/
│   ├── e2e/                     # full client+server scenarios via Playwright
│   │   ├── britain_smoke.spec.ts
│   │   ├── multiplayer_sync.spec.ts
│   │   └── ugc_publish.spec.ts
│   ├── replay/                  # recorded sessions for determinism gate
│   │   └── britain_60s_baseline.replay
│   └── perf/                    # criterion benchmarks; load-test scripts
│
├── _docs/                       # design docs (this doc lives here as #40)
│
├── adr/                         # Architecture Decision Records (numbered MD)
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── nightly.yml
│   │   ├── release.yml
│   │   └── preview-env.yml
│   └── CODEOWNERS
│
├── .claude/                     # claude-code config (untracked)
│
├── Cargo.toml                   # cargo workspace root
├── Cargo.lock
├── pnpm-workspace.yaml
├── package.json
├── turbo.json
├── biome.json
├── rust-toolchain.toml
├── .editorconfig
├── .gitattributes               # LFS rules
├── .gitignore
└── README.md
```

### 5.1 Sample `Cargo.toml` workspace root

```toml
[workspace]
resolver = "2"
members = [
    "apps/forge-shard",
    "apps/forge-auth",
    "apps/forge-tools-cli",
    "apps/forge-mcp-bridge",
    "crates/shared",
    "crates/ecs",
    "crates/verb-dispatcher",
    "crates/sim",
    "crates/virtue",
    "crates/persistence",
    "crates/replication",
    "crates/spatial",
    "crates/pathfinding",
    "crates/network",
    "crates/mcp-server",
    "crates/audio-events",
    "crates/animation",
    "crates/deterministic-rng",
    "crates/telemetry",
    "crates/content-loader",
    "crates/replay",
    "crates/testkit",
]

[workspace.package]
version      = "0.1.0"
edition      = "2021"
rust-version = "1.78"
authors      = ["Project Virtue Engineering"]
license      = "Proprietary"

[workspace.dependencies]
tokio          = { version = "1.38", features = ["full"] }
serde          = { version = "1.0", features = ["derive"] }
serde_json     = "1.0"
rmp-serde      = "1.3"
sqlx           = { version = "0.7", features = ["postgres", "sqlite", "runtime-tokio-rustls", "json", "chrono", "uuid", "macros"] }
rusqlite       = { version = "0.31", features = ["bundled", "json"] }
bevy_ecs       = "0.14"
rstar          = "0.12"
pathfinding    = "4.10"
prost          = "0.13"
ts-rs          = "9.0"
tracing        = "0.1"
tracing-subscriber = "0.3"
opentelemetry  = "0.23"
opentelemetry-otlp = "0.16"
thiserror      = "1.0"
anyhow         = "1.0"
uuid           = { version = "1.10", features = ["v4", "serde"] }
indexmap       = "2.4"
dashmap        = "6.0"
async-nats     = "0.35"
redis          = { version = "0.26", features = ["tokio-comp"] }

[profile.dev]
opt-level = 1                 # speed up sim a lot in dev without killing rebuild time
debug     = true

[profile.release]
opt-level     = 3
lto           = "thin"
codegen-units = 1
strip         = "symbols"
debug         = false
panic         = "abort"

[profile.test]
opt-level = 1                 # tests need to run sim at meaningful speed
```

### 5.2 Sample `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/forge-client"
  - "packages/*"
  - "tests/e2e"
```

### 5.3 Sample `turbo.json` (excerpt)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "shared/generated/ts/**",
    "shared/proto/**"
  ],
  "tasks": {
    "codegen": {
      "outputs": ["shared/generated/**"],
      "cache": true
    },
    "build": {
      "dependsOn": ["^build", "codegen"],
      "outputs": ["dist/**"]
    },
    "lint": { "dependsOn": ["codegen"] },
    "typecheck": { "dependsOn": ["codegen"] },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

---

## 6. Build & CI

### 6.1 GitHub Actions matrix

CI runs on every PR and on push to `main`. The matrix below treats **Client B (TS web) CI on the same tier as Client A (UE5)** — per Doc #41 OQ-2 resolution (2026-05-04), the web client is a permanent product surface, so its lint, typecheck, unit, e2e, and bundle/build artifact jobs are gating on the same cadence as the UE5 build pipeline.

| Job | Triggers | OS | Steps | SLA |
|---|---|---|---|---|
| `lint` | PR, push | ubuntu-latest | `cargo fmt --check`, `cargo clippy -- -D warnings`, `pnpm biome check` | < 3 min |
| `codegen-check` | PR, push | ubuntu-latest | `pnpm codegen` then `git diff --exit-code` | < 2 min |
| `typecheck` | PR, push | ubuntu-latest | `pnpm typecheck` | < 3 min |
| `unit-rust` | PR, push | ubuntu-latest, macos-14 | `cargo nextest run --workspace` | < 8 min |
| `unit-ts` | PR, push | ubuntu-latest | `pnpm test --filter=...` (Vitest) | < 4 min |
| `integration` | PR, push | ubuntu-latest | spins up `docker-compose.test.yml`; runs `cargo nextest run --features=integration --tests` | < 12 min |
| `determinism` | PR, push | ubuntu-latest | `scripts/run-determinism.sh tests/replay/britain_60s_baseline.replay` | < 5 min |
| `e2e` | PR (label `e2e`), push to `main` | ubuntu-latest | spins up full stack; runs Playwright | < 20 min |
| `build-artifacts` | push to `main`, tags | ubuntu-latest, macos-14 | builds release binaries + client bundle; uploads to artifact store | < 15 min |
| `nightly-perf` | cron `0 6 * * *` | ubuntu-latest | criterion benchmarks; tracks regressions in a comment on a tracking issue | < 30 min |
| `lfs-check` | PR | ubuntu-latest | scans for un-LFS'd binaries above 100 KB; fails clearly | < 1 min |

### 6.2 Sample `.github/workflows/ci.yml` (excerpt)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  CARGO_TERM_COLOR: always
  CARGO_INCREMENTAL: 0
  RUSTFLAGS: "-D warnings"
  RUST_BACKTRACE: 1

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - uses: dtolnay/rust-toolchain@stable
        with: { components: "rustfmt, clippy" }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: cargo fmt --all -- --check
      - run: cargo clippy --workspace --all-targets -- -D warnings
      - run: pnpm biome check .

  codegen-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm codegen
      - run: git diff --exit-code -- shared/generated/

  unit-rust:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix: { os: [ubuntu-latest, macos-14] }
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - run: cargo install cargo-nextest --locked
      - run: cargo nextest run --workspace --no-fail-fast

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: forge, POSTGRES_DB: forge_test }
        ports: ["5432:5432"]
        options: --health-cmd "pg_isready -U postgres" --health-interval 5s
      redis:
        image: redis:7
        ports: ["6379:6379"]
      nats:
        image: nats:2.10
        ports: ["4222:4222"]
    env:
      DATABASE_URL: postgres://postgres:forge@localhost:5432/forge_test
      REDIS_URL: redis://localhost:6379
      NATS_URL: nats://localhost:4222
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - run: cargo sqlx migrate run --source crates/persistence/migrations
      - run: cargo nextest run --workspace --features integration

  determinism:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - run: cargo build --release -p forge-tools-cli
      - run: ./scripts/run-determinism.sh tests/replay/britain_60s_baseline.replay
```

### 6.3 Pre-commit hooks

Managed by [`lefthook`](https://lefthook.dev) (`lefthook.yml` at repo root). Engineers install via `pnpm bootstrap` (which calls `lefthook install`). Hooks run only on staged files:

- `cargo fmt --check` on staged `*.rs`
- `cargo clippy` only on the affected crate (lefthook's glob filter feeds the crate path)
- `biome check` on staged `*.ts`/`*.tsx`/`*.json`
- `pnpm typecheck --filter` for affected TS packages
- `commitlint` against the conventional-commits spec (next subsection)
- secret-scan via `gitleaks`

### 6.4 Conventional commits

Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org). Type vocabulary:

- `feat` — user-visible feature
- `fix` — bug fix
- `chore` — build/CI/tooling/non-runtime
- `refactor` — internal restructuring, no behaviour change
- `perf` — performance change
- `docs` — `_docs/`, `adr/`, code doc-comments
- `test` — test-only changes
- `content` — content/archetypes/maps/sprites/audio/localization

Scope is the directory or crate name (`feat(verb-dispatcher): ...`). Breaking changes use `!` (`feat(shared)!: ...`) and a `BREAKING CHANGE:` footer.

`commitlint` enforces this in CI and as a pre-commit hook. The `release.yml` workflow uses commit history to generate changelogs.

### 6.5 LFS guard

`tools/lfs-check.sh` walks staged files, flags any `>100 KB` blob not in the LFS attribute set, and prints a one-liner remediation: `git lfs track '*.<ext>' && git add .gitattributes && git add <file>`. CI runs the same script.

---

## 7. Local Development Environment

### 7.1 Bootstrap command

A single command on a fresh laptop:

```sh
./scripts/bootstrap.sh
```

This script:

1. Verifies prerequisites (Rust ≥ 1.78, Node ≥ 20, pnpm 9, Docker, `lefthook`, `gitleaks`, `git lfs`, `aseprite` if doing art); prints actionable install hints for each missing one.
2. `git lfs install` and `git lfs pull`.
3. `pnpm install --frozen-lockfile`.
4. `pnpm codegen`.
5. `cargo fetch`.
6. `lefthook install`.
7. `docker compose -f infra/docker-compose.yml up -d` (Postgres, Redis, NATS, the auth-stub).
8. `cargo sqlx migrate run --source crates/persistence/migrations`.
9. `./scripts/seed-shard.sh britain` — populates a local shard with the Britain content set.
10. Prints a "you're ready" message and the next-step commands.

Time budget: < 8 minutes on a 2024 laptop with cached LFS.

### 7.2 docker-compose stack

`infra/docker-compose.yml` runs the dependencies; the shard, auth, and client run *outside* compose during dev (so the engineer gets fast `cargo run` / `vite` rebuilds with native FS watchers):

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER:     forge
      POSTGRES_PASSWORD: forge
      POSTGRES_DB:       forge_dev
    ports: ["5432:5432"]
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./docker/postgres-init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U forge"]
      interval: 5s
  redis:
    image: redis:7
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
  nats:
    image: nats:2.10
    command: ["-js"]                  # JetStream enabled
    ports: ["4222:4222", "8222:8222"]
  jaeger:
    image: jaegertracing/all-in-one:1.58
    ports: ["16686:16686", "4317:4317"]
  prometheus:
    image: prom/prometheus:v2.54
    volumes: ["./grafana/prometheus.yml:/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]
  grafana:
    image: grafana/grafana:11.1
    volumes: ["./grafana/dashboards:/var/lib/grafana/dashboards"]
    ports: ["3000:3000"]
volumes:
  pg-data:
```

A separate `docker-compose.test.yml` differs only in volume strategy (no persistent volumes; ephemeral databases per CI run).

### 7.3 Dev containers

`.devcontainer/devcontainer.json` provides a reproducible VS Code / GitHub Codespaces environment with all of the above pre-installed. Engineers who prefer not to install Rust/Node locally use this; CI uses a similar image so dev-prod parity is high.

### 7.4 Seed data

`scripts/seed-shard.sh britain` runs `forge-tools-cli seed --map britain --reset`, which:

1. Truncates all shard tables (with a confirmation prompt if not `--reset`).
2. Inserts archetypes from `content/archetypes/*.toml` (Doc #13).
3. Inserts the Britain region geometry (Doc #23 §2 `RegionGeometry`).
4. Inserts ~2,500 placed entities (NPCs, fixtures, lootable items) per `content/maps/britain/placement.toml`.
5. Inserts the 15 Phase-1 NPC schedules per Doc #17.
6. Inserts the starting-kit data per Doc #25 §T-15-6.
7. Mints a `dev-token` for `dev_avatar` with `avatar.full` capability.
8. Prints connection strings.

### 7.5 Determinism harness

`crates/replay/` provides:

- A recorder that captures every `VerbInvocation`, `RNG` consumption, and `ServerTick` boundary for a wall-clock window.
- A player that re-feeds the captured stream into a fresh shard process and asserts the same `EntityDelta` byte stream comes out at every tick.
- A `replay format v1` (committed in `crates/replay/FORMAT.md`) — a length-prefixed MessagePack stream (replay-only on-disk format; wire encoding is Protobuf per ADR 0006).

`tests/replay/britain_60s_baseline.replay` is the canonical baseline. CI's determinism job replays it and fails on any divergence. When intentional changes break determinism (e.g. a sim-rule change), the procedure is documented in §11.4.

---

## 8. Testing Strategy

### 8.1 Test taxonomy

| Tier | Lives in | Runs in CI | Runs locally on save | Owns |
|---|---|---|---|---|
| **Unit** | `crates/<x>/src/**` (`#[cfg(test)] mod tests`) and `packages/<x>/src/**.test.ts` | `unit-rust`, `unit-ts` | yes (file-watch) | one function or one module's contract |
| **Property** | same, via `proptest` (Rust) and `fast-check` (TS) | `unit-rust`, `unit-ts` | yes | invariants — verb dispatcher conservation laws, persistence round-trips |
| **Integration** | `tests/integration/**` | `integration` (Postgres + Redis + NATS spun up) | yes if Docker is up | cross-crate flows; real DB; no client |
| **Determinism / replay** | `tests/replay/*.replay` + harness | `determinism` | yes via `scripts/run-determinism.sh` | bit-identical replay |
| **End-to-end** | `tests/e2e/**` (Playwright) | `e2e` (label-gated on PR) | rarely (slow) | full client + server scenario |
| **Performance** | `tests/perf/**` (Criterion + k6) | `nightly-perf` | on demand | regression detection |
| **Security** | `tests/integration/security/**` | `integration` | as needed | Doc #32 invariants — capability gates, rate limits, replay attacks |

### 8.2 Coverage targets (Phase 1 prototype)

- **Crates touching the verb dispatcher** (`verb-dispatcher`, `sim`, `virtue`, `persistence`, `replication`): ≥ 80% line coverage. Branch coverage tracked but not gated.
- **Other crates**: ≥ 60%.
- **TS packages**: ≥ 50%, with the `client-net` and `shared-ts` packages held to 80%.

Coverage is reported (`cargo llvm-cov`, `vitest --coverage`) but not block-merging; quality of tests > raw line %.

### 8.3 Rust testing tools

- `cargo nextest run` — parallel test runner; faster + better isolation than `cargo test`.
- `proptest` for property-based tests.
- `insta` for snapshot tests of generated wire payloads / JSON exports.
- `mockall` only when absolutely necessary (we prefer trait-driven test doubles in `crates/testkit`).
- `criterion` for benchmarks.

### 8.4 TS testing tools

- `vitest` for unit + component tests.
- `@solidjs/testing-library` for Solid components.
- `playwright` for e2e.
- `msw` for network mocks in unit tests.

### 8.5 Integration test pattern

Every integration test resets a transactional sandbox per test:

```rust
#[sqlx::test(migrator = "crates::persistence::MIGRATOR")]
async fn verb_examine_writes_no_state(pool: PgPool) {
    let mut harness = TestHarness::new(pool).await;
    let avatar = harness.spawn_avatar("dev_avatar").await;
    let bread = harness.spawn_entity("item.food.bread.ration").await;
    let result = harness.dispatch(VerbInvocation::examine(avatar, bread)).await;
    assert!(result.is_ok());
    assert_eq!(harness.audit_log().writes_count(), 0); // examine MUST be read-only
}
```

`#[sqlx::test]` runs each test against a fresh database with migrations applied, dropping it on teardown. CI's Postgres service runs at concurrency 1 to avoid flaky cross-test interference; locally an engineer can crank parallelism if they have the cores.

---

## 9. Observability

Per Doc #28 (Telemetry, Analytics & Live Ops). Phase 1 ships the Three Pillars:

### 9.1 Structured logs

**`tracing`** (Rust) and **`pino`** (TS) emit JSON-lines structured logs to stdout. In dev they're pretty-printed via `tracing-subscriber::fmt`; in prod they go through `tracing-opentelemetry` to an OTLP endpoint.

Required log fields on every event:

| Field | Type | Source |
|---|---|---|
| `ts` | RFC3339 | auto |
| `level` | enum | auto |
| `target` | string | auto |
| `shard_id` | string | bound at process start |
| `region_id` | string | per-region span |
| `server_tick` | u64 | bound on the simulation span |
| `avatar_id` | u64 nullable | bound when in a verb-dispatch path |
| `verb_id` | string nullable | bound when in a verb-dispatch path |
| `invocation_id` | uuid nullable | bound when in a verb-dispatch path |
| `trace_id` | hex | OTel propagation |
| `span_id` | hex | OTel propagation |
| `message` | string | the log message |

### 9.2 Metrics

OpenTelemetry meter → OTLP → Prometheus. Phase 1 baseline metrics:

| Metric | Type | Labels | Notes |
|---|---|---|---|
| `forge_sim_tick_duration_ms` | histogram | `shard,region` | tick budget watchdog |
| `forge_verbs_dispatched_total` | counter | `shard,verb,result` | result ∈ {ok, err} |
| `forge_verb_duration_ms` | histogram | `shard,verb` | per-verb p50/p99 |
| `forge_replication_payload_bytes` | histogram | `shard,region` | bandwidth |
| `forge_persistence_write_duration_ms` | histogram | `shard,scope,backend` | scope ∈ Doc #13 §3 set |
| `forge_persistence_write_failures_total` | counter | `shard,scope,reason` | hard-fail tracking |
| `forge_active_avatars` | gauge | `shard,region` | CCU per region |
| `forge_mcp_sessions` | gauge | `shard,capability_tier` | per Doc #25 §T-13-13 |
| `forge_pathfinding_query_duration_ms` | histogram | `shard,region` | A* perf |

### 9.3 Traces

Every `VerbInvocation` opens a root span. Child spans are created at each Doc #13 §4 dispatch step (validate, score, persist, replicate). Cross-process propagation: client → WebSocket frame includes `traceparent` headers in the envelope; server picks them up.

### 9.4 Dashboards

Grafana dashboards live in `infra/grafana/dashboards/` as JSON, version-controlled. Phase 1 dashboards:

- **Shard Health** — tick duration, verb throughput, replication lag, active CCU.
- **Persistence** — write latency, failure rate, table sizes, vacuum status.
- **MCP** — sessions per tier, rate-limit denials, introspection failures.
- **Network** — bytes per channel, dropped frames, region-handoff latency (Doc #22 §7).
- **Determinism** — tick miss count (the watchdog above).

---

## 10. Secrets Management

### 10.1 Decision: **SOPS + age**

Project secrets are encrypted at rest with [SOPS](https://github.com/getsops/sops) using `age` keys. Encrypted files live in the repo at `infra/secrets/`; the unencrypted form never enters Git history.

### 10.2 Why SOPS over alternatives

| Option | Verdict | Rationale |
|---|---|---|
| **SOPS + age** | **chosen** | Encrypted-at-rest in the repo; offline-decryptable; age keys are simple `~/.config/sops/age/keys.txt`; CI decrypts via a stored `age` private key in GitHub Secrets; no SaaS dependency; first-class Terraform/Helm integration |
| 1Password CLI | rejected for repo secrets | Great for personal credentials; but gating CI on a 1Password Connect server is a runtime dependency we don't want to introduce in Phase 1 |
| Doppler | rejected | SaaS; another vendor account to manage; pricing concerns at scale |
| Vault | rejected for Phase 1 | Too heavy for a prototype; revisit Phase 2 for production secrets |
| Plain `.env` files | rejected | Cannot be safely committed; engineers will inevitably accidentally commit unencrypted ones |

The `lefthook` pre-commit gitleaks scan catches the failure mode where an engineer commits an unencrypted secret-shaped string.

### 10.3 What's in secrets

| Secret | Owner | Rotation cadence |
|---|---|---|
| Postgres dev password | local dev | static |
| Postgres prod password | live ops | 90 days |
| `dev-token` for the auth stub | local dev | static |
| Production auth-service signing key | live ops | 30 days |
| Telemetry OTLP endpoint token | live ops | 90 days |
| GitHub Actions deploy keys | infra | 90 days |
| Aseprite license key | art lead | per-license |

Phase 1 ships only the dev-side secrets. Production secrets are placeholders until the hosting story (post-prototype) is fleshed out.

---

## 11. Branching, Releases, Feature Flags

### 11.1 Trunk-based development

- **`main` is always shippable.** Every merge to `main` must keep CI green.
- **Short-lived feature branches** (target life: < 3 days). Long-lived branches are rejected at code-review time.
- **No `develop`/`release`/`master` branches.** GitFlow's complexity is unjustified at our team size.
- **Squash-merge** is the only merge mode. PR title becomes the squash-commit subject; PR description becomes the body.

### 11.2 PR rules

- ≥ 1 approving review from a CODEOWNER for the touched directories.
- All required CI checks green.
- Conventional-commits-compliant title.
- Linked to a tracking issue (the `Closes #N` footer convention).
- Changes touching `_docs/` require a doc-owner review (typically the design lead).

### 11.3 Feature flags

A small `crates/feature-flags` provides a single source: a TOML file in `content/feature_flags.toml` plus runtime overrides via env vars. Flag definitions are typed at compile time:

```rust
// crates/feature-flags/src/lib.rs
forge_flags! {
    pub fn ENABLE_CHAOS_ZONE() -> bool = false;
    pub fn ENABLE_UGC_PUBLISH() -> bool = false;
    pub fn ENABLE_PVP() -> bool = false;
    pub fn ENABLE_PROCEDURAL_DUNGEON() -> bool = false;
}
```

Production runs Phase 1 with all of the above off until W9 / W10 / W11 land. `tests/integration/` parametrise every flag combination that's actually exercised in production paths; impossible combinations (e.g. `ENABLE_PVP` without `ENABLE_CHAOS_ZONE`) are statically rejected by a `forge_flags!` invariant block.

### 11.4 Determinism-breaking changes

Intentional changes that break the byte-identical replay-test gate follow this procedure:

1. PR is labeled `determinism-break`.
2. PR description includes a `BREAKING CHANGE:` footer with the rationale.
3. PR includes the regenerated `tests/replay/britain_60s_baseline.replay` as a separate commit.
4. PR includes an ADR (`adr/`) documenting the decision.
5. Reviewer is the systems-architecture lead.

This is the only valid path through the determinism gate. The gate is otherwise non-overridable.

### 11.5 Preview environments

Every PR triggers `preview-env.yml`:

1. Build server + client artifacts.
2. Spin up an ephemeral shard at `pr-{n}.preview.britanniareborn.dev` (Phase 2 — Phase 1 the workflow is wired but only deploys to a local kind cluster on the build runner for smoke testing).
3. Post a comment on the PR with the URL.
4. Tear down on PR close.

### 11.6 Release tags

Releases follow `v{major}.{minor}.{patch}`. Phase 1 prototype releases as `v0.x.y`. The `release.yml` workflow produces:

- Linux x86_64 + macOS arm64 binaries for `forge-shard`, `forge-auth`, `forge-tools-cli`.
- Static client bundle (`forge-client.tar.gz`).
- Generated CHANGELOG from conventional commits.
- A GitHub Release with all attached.

---

## 12. Coding Standards

### 12.1 Rust

- **Formatter:** `rustfmt` with the workspace's `rustfmt.toml` (edition 2021, max width 100, comment width 100, trailing commas).
- **Linter:** `clippy` with `-D warnings`. Custom `clippy.toml` denies `unwrap_used`, `expect_used`, `panic` outside test code.
- **Error handling:**
  - **Public API** uses domain error enums via `thiserror`. Every error variant has a stable error code that maps onto the Doc #14 §5 standard error codes.
  - **Application** layer uses `anyhow::Result` only inside `apps/`, never inside `crates/`.
  - **No `unwrap()`** in non-test code. Replace with `?` plus a typed error or with `expect("invariant: ...")` (the explicit invariant message satisfies the clippy lint).
- **`unsafe` budget:** zero. Any `unsafe` block requires a `// SAFETY:` comment + ADR + lead review.
- **Async:** prefer `tokio::spawn` over manual futures; never `block_on` inside an async fn.
- **Naming:** `snake_case` modules and fns, `UpperCamelCase` types, `SCREAMING_SNAKE` consts. Verb names in `verb-dispatcher` match Doc #13 §2 verb registry verbatim.
- **Doc comments:** every `pub` item has `///`. CI's `cargo doc -- -D missing_docs` enforces.
- **Type strictness:** crates that touch persistence or replication use newtype wrappers for `EntityId`, `AvatarId`, `RegionId`, `ServerTick`, `ShardId`. No raw `u64` `id` fields.

### 12.2 TypeScript

- **Formatter / linter:** [`biome`](https://biomejs.dev) — single tool replacing ESLint + Prettier. Faster, no plugin sprawl.
- **`tsconfig.json`:** `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`. No `any` survives review.
- **Imports:** absolute paths via `@forge/*` aliases; no `../../../`.
- **Errors:** `Result<T, E>` shape via `neverthrow` for known-failure paths; `throw` only for programmer errors.
- **Components:** Solid components, not React. PascalCase file names match component name.
- **No default exports** outside Vite entry points.

### 12.3 SQL

- All migrations live in `crates/persistence/migrations/` as numbered `.sql` files (`0001_init.sql`, `0002_player_avatars.sql`, …). Migrations are append-only — never edit a merged migration; write a new one.
- `sqlx::query!` macros require `DATABASE_URL` at compile time → catches DDL drift early.
- DDL identifiers are `snake_case`; FK columns named `{table}_id`.

### 12.4 TOML data files

- 2-space indent.
- Top-level tables grouped by domain; comments document Doc-cross-references.
- A schema-validation test in `crates/content-loader` parses every `content/**/*.toml` on CI; any unknown field fails the build.

---

## 13. Documentation

### 13.1 Design docs

This `_docs/` directory. Numbered, cross-referenced, normative for the design contract. Engineers consult these before changing schemas; PRs touching schemas must update the affected doc(s) in the same commit.

### 13.2 ADRs

`adr/` holds [Architecture Decision Records](https://adr.github.io). Format: numbered MD files (`adr/0001-monorepo.md`, `adr/0002-rust-server.md`, `adr/0003-pixijs-client.md`, …). Template in `adr/TEMPLATE.md`. ADRs are append-only; superseded ADRs link forward to the replacing ADR rather than being edited.

Phase 1 starts with these ADRs (this doc derives them):

| # | Title | Status |
|---|---|---|
| 0001 | Monorepo with pnpm + Cargo + Turborepo | Accepted |
| 0002 | Rust authoritative server (supersedes UE5 from Doc #9) | Accepted |
| 0003 | TypeScript + PixiJS + Solid.js client | Accepted |
| 0004 | Rust types as schema source of truth via ts-rs | Accepted |
| 0005 | MessagePack on the wire, protobuf for handshake | Superseded by 0006 (2026-05-04) |
| 0006 | Wire format: Protobuf supersedes MessagePack (2026-05-04) — Doc #41 ADR §2: Protobuf chosen as canonical wire format; codegen for Rust + C++ + TS; protocol freezes W5–W6 of prototype | Accepted (supersedes 0005) |
| 0007 | SOPS + age for repo secrets | Accepted |
| 0008 | Trunk-based development, squash merges | Accepted |
| 0009 | Determinism gate via byte-identical replay tests | Accepted |
| 0010 | SQLx compile-time-checked SQL | Accepted |
| 0011 | OpenTelemetry → Prometheus + Jaeger + Grafana | Accepted |

### 13.3 Code documentation generation

- Rust: `cargo doc --workspace --no-deps` produces `target/doc/`. Nightly job publishes to `https://docs.britanniareborn.internal/`.
- TS: `typedoc` for the `packages/*` APIs. Same publishing pipeline.

### 13.4 Runbooks

`infra/runbooks/` — operations playbooks. Phase 1 ships skeletons for: shard restart, Postgres failover (placeholder), Redis cache flush, replay-test failure triage, MCP rate-limit incident.

---

## 14. 12-Week Schedule

The 12 weeks break into four tracks landing in lockstep with Doc #11 §4:

| Doc #11 phase | Doc #40 weeks |
|---|---|
| Foundation (W0–W2) | W1, W2 |
| Interaction & Virtues (W3–W5) | W3, W4, W5 |
| Multiplayer & Persistence (W6–W8) | W6, W7, W8 |
| UGC Editor (W9–W10) | W9, W10 |
| Polish & Audio (W11) | W11 |
| Testing & Demo Prep (W12) | W12 |

### 14.1 Per-week deliverable matrix

> **Doc #41 phasing overlay (2026-05-04).** The 12-week schedule below is now phased per the engine/stack ADR:
>
> - **W1–W2:** **Rust server + protocol scaffolding only.** No client work proceeds until the Rust server boots and the `/shared/proto` wire schema has its first compilable revision (codegen for Rust + TS at minimum; C++ codegen wired but not yet consumed). The "Client deliverables" cells for W1–W2 below should be read as *Client B (TS web) skeleton* — the minimum needed to validate the protocol, not a production-quality client.
> - **W3–W6:** **Client B (TS / PixiJS / Solid.js) builds the vertical slice.** All visible client progress in this window is the web client. UE5 (Client A) is NOT being built yet.
> - **W5–W6:** **Wire protocol freezes v1.** `/shared/proto` is tagged `v1.0`; further changes require an ADR. C++ codegen must be verified to compile cleanly against the frozen schema by end of W6 (gating UE5 onboarding).
> - **W6–W12:** **Client A (UE5) onboarding starts in parallel** with the W6+ feature work. UE5 client is scaffolded against the frozen protobuf schema, native UE5 replication explicitly disabled, raw socket connection to `forge-shard`. The "Client deliverables" cells for W6–W12 below apply to **both** Client A and Client B; Client B remains the demo target through W11; W12 goal is **feature-equal between TS web and UE5 desktop**.
> - **Console cert (PS5 + Xbox) is Phase 2, NOT in the 12-week prototype.**

| Week | Theme | Server deliverables | Client deliverables | Content / Tooling | DoD |
|---|---|---|---|---|---|
| **W1** | Repo bootstrap, CI, dev env, schema scaffolding (**Rust server + protocol only — Doc #41**) | `crates/shared` with full Doc #13 entity types, `forge-shard` binary skeleton that boots and logs `Hello, Britannia`, `forge-auth` stub issuing `dev-token`, Cargo workspace healthy; **`/shared/proto` initial revision committed with Rust + TS codegen wired (C++ codegen scaffolded)** | *(deferred to W2/W3 per Doc #41 phasing — only the bare `@forge/shared-ts` package consuming codegen output exists this week)* | Repo, CI, lefthook hooks, docker-compose stack, devcontainer, ADRs 0001–0010, codegen pipeline (**incl. protobuf for Rust/TS/C++ per Doc #41**) | `pnpm bootstrap && pnpm dev` brings up server + dependencies on a fresh laptop in under 8 min; CI green; protobuf codegen reproducible |
| **W2** | Networking handshake, single-shard server skeleton (**still server + protocol; no client renderer**) | WebSocket server in `crates/network`; `Auth` ClientMessage validation against `forge-auth`; `MCPCaller` constructed at handshake (Doc #25 §T-13-13); `forge-shard` accepts a connection, echoes a `VerbResult` to a stub `examine` verb; **protobuf envelopes round-trip end-to-end** | Minimal TS test harness (Client B skeleton only) that authenticates and round-trips an `examine` verb — no rendered scene yet; used to validate the wire schema | Sample `dev-token` flow; structured logs landing in Jaeger / Grafana | Two-machine demo: run shard on machine A, TS test harness on B, see auth + verb round-trip in dashboards over the protobuf wire |
| **W3** | Spatial grid, tile streaming, basic client renderer (**Client B vertical slice begins — Doc #41**) | `crates/spatial` with `RegionGeometry` loader (Doc #23 §2); region tile-stream protocol (Doc #22); `crates/sim` empty world stepping at 20 Hz | **Client B (TS web)** renders a tile grid for Britain (256×256, ground floor only, no entities); pan + zoom; debug coordinate overlay | `tools/map-import` lifts Britain tile data from a TOML reference map into the spatial format | Client B shows recognisable Britain street grid, no entities yet; sim ticks at 20 Hz with stable budget metric |
| **W4** | Entity/verb dispatch, first interactable | `crates/verb-dispatcher` with full Doc #13 §4 dispatch contract; `examine`, `look`, `use`, `drop` verbs implemented end-to-end; `crates/sim` Physical + State + Container + Ownership components live; persistence write-contract enforced (sqlx + Postgres) | Client shows entities (sprites stubbed as colored rects), right-click contextual menu (Doc #25 §T-13-1); successful `examine` displays the entity's Doc #17 §14 LocalizedString | First 50 archetypes in `content/archetypes/` (Iolo, Lord British, doors, torches, barrels, food); placeholder PixiJS sprites | A player can right-click a barrel, pick "examine", see the description, and the verb hits Postgres `replication_log` |
| **W5** | NPC schedules, virtues, sprite pipeline live (**protocol freeze candidate — Doc #41**) | `crates/virtue` Virtue scoring on every dispatched verb; `crates/sim` Schedule system at 1 Hz (Doc #17 §6); 15 Britain NPC schedules wired up; `crates/animation` server-side AnimationStateId arbitration (Doc #31 §3); **`/shared/proto` v1 release-candidate cut; protocol-change ADR template established** | Client B renders sprites via the Doc #31 manifest; AnimationStateId drives sprite-frame selection; HUD shows the avatar's 8-Virtue tallies | `tools/atlas-pack` (Aseprite → atlas + manifest) live; first 15 NPCs ship with `walk_*` and `idle_*` states in 8 directions; gypsy questions (Doc #25 §T-15-1) drive character creation | An NPC walks from home to forge at 9 AM in-game time; player sees the sprite animate; stealing a torch raises Honesty -3 in the Virtue panel |
| **W6** | Multiplayer foundation, replication (**`/shared/proto` v1.0 frozen; UE5 onboarding starts in parallel — Doc #41**) | Region replication at 10 Hz (Doc #22 §5); `EntityDelta` packets working; up to 4 players in one region simultaneously; `crates/replication` snapshot/diff codec; **`/shared/proto` tagged `v1.0` — schema changes from W7 onward require an ADR** | Client B interpolates remote players; movement prediction for own avatar (Doc #22 §6); two browsers in two windows show each other moving. **Client A (UE5) onboarding begins this week**: UE5 project scaffolded, native replication disabled, C++ protobuf codegen consumed, raw-socket connection to `forge-shard`, "hello world" auth + examine round-trip | Determinism baseline replay recorded (`britain_60s_baseline.replay`); UE5 build pipeline added to CI (build-only, not yet gated) | Two engineers in two browsers see each other walk around Britain in real time; UE5 project compiles in CI and successfully authenticates to `forge-shard` |
| **W7** | Persistent state across sessions, region partitioning | Logout/login cycle preserves world + Avatar state (Doc #21); region-handoff protocol stub (Doc #22 §7) — single-region for now but the message exists; rollback protection at 30 s (Doc #21 §7) | Client login picker (shard + avatar select); session resume works | `forge-tools-cli replay` works against recorded sessions; integration tests for persistence round-trip green | Quit the client, restart, see the same dropped barrel where it was; replay-test gate green in CI |
| **W8** | Multiplayer scale to 8, simulation depth | Full Doc #4 simulation: physics (gravity, stacking), fire propagation, water, container nesting, item combination (Doc #4.1 cantrip-tier crafting); 8 simultaneous players load-tested | Client renders fire spread, water tiles, sparks; particle effects via PixiJS | `tests/perf/` baseline criterion bench at 8 players + 500 active entities; first Grafana dashboard "Shard Health" complete | 8-player playtest: a player lights a barrel on fire, fire spreads to neighbouring barrels, all 8 see it within one network tick |
| **W9** | UGC editor v0 — placement | In-game UGC mode: gated by capability (Doc #25 §T-13-13 — Phase 1 ships no `ugc.author` capability publicly; W9 ships an internal flag `ENABLE_UGC_PUBLISH=true` with the dev avatar only); `script_invoke` plumbing live but no Trusted scripts (Doc #25 §T-13-1) | Editor UI: grid snapping, archetype palette, place + delete + select; saves to `content/maps/<creator>/<slug>/placement.toml` | Editor → publish pipeline: writes a self-contained map bundle; the `forge-tools-cli ugc-validate` checks against the Doc #19 sandbox rules | A friend can join the dev's shard, walk into a player-built room, see placed objects |
| **W10** | UGC editor v1 — triggers, procedural dungeon | 3 trigger types (Doc #11 §3): `on_enter`, `on_use`, `on_timer` — all map to the existing verb dispatcher (no new dispatch path); the procedural Cave-of-Trials generator (Doc #25 §T-13-7 seed pinning) | Editor adds a triggers panel; client renders trigger-zone outlines in editor mode only | Cave-of-Trials seed-replay test in CI | Player triggers a fireball-trap on enter; player rolls Cave-of-Trials twice and sees two distinct layouts but identical contents |
| **W11** | Polish, audio, lighting, dialogue | Audio fan-out (Doc #27 §10.1) — every verb that emits a sound id sends it to the client; Dialogue system end-to-end (Doc #17): keyword → response, gypsy questions → class skew → starting kit (Doc #25 §T-15-6) | Howler.js audio playback; per-pixel lighting shader for torches/fires; full dialogue UI with keyword cloud; full paperdoll panel (Doc #15 §5) | Original soundtrack tracks ingested for Britain (Doc #27); 8 ambient SFX; full localization JSON for English (Doc #33) | A player meets Lord British, has a 5-keyword conversation, exits the throne room as a Mage class with the Mage starting kit. Music plays. Torches flicker. |
| **W12** | Testing, bug bash, demo prep (**feature-equal between TS web and UE5 desktop — Doc #41**) | All CI green; nightly perf bench shows stable p99 sim-tick < 15 ms; full integration-test pass; Doc #32 anti-cheat surface verified (capability + rate-limit gates); MCP `inspect.read` dashboards live | Final UI polish; loading screen; shard-select screen; pause-menu; settings (keybinds, audio, accessibility — Doc #34). **Goal: Client A (UE5 desktop) and Client B (TS web) are feature-equal against the W12 demo script.** Console cert (PS5 + Xbox) is Phase 2 and explicitly NOT in the 12-week prototype. | 15-minute curated demo build (UE5 desktop primary, TS web parity build); demo script; video walkthrough recording; DoD checklist (§16) walked through with all evidence linked | Garriott can sit down at a fresh laptop, click "Play", and within 60 seconds recognise the game on **either** client; in 15 minutes, hit the Doc #11 §5 success criteria |

### 14.2 Track-level cadence

| Track | Cadence | Owner | Output |
|---|---|---|---|
| Server / sim | continuous | systems lead | crates/, server binary |
| Client / UI | continuous | client lead | apps/forge-client |
| Content / art | continuous | art lead | content/sprites/, content/maps/ |
| Tooling | continuous | tooling lead | tools/, scripts/ |
| Audio | from W5 | audio lead | content/audio/ |
| QA | from W4 | QA lead | tests/integration/, tests/e2e/ |
| Live ops / infra | from W6 | infra lead | infra/, dashboards |

### 14.3 Weekly checkpoints

- **Mon 10:00** — Sprint planning (45 min). Review the previous week's DoD; commit to the current week's deliverables.
- **Wed 16:00** — Mid-week demo (30 min). Engineers screen-share progress; risks raised early.
- **Fri 16:00** — Demo + retro (60 min). Live demo of week's deliverables; what worked / what didn't / what changes next week.
- **Daily 10:30** — Async standup in chat. 3 lines per engineer. No meeting.

The Wed and Fri demos must run against the *real* client + server stack — not slides, not mocks. If something can't be demoed live, it isn't done.

---

## 15. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Trigger / signal | Owner |
|---|---|---|---|---|---|---|
| R1 | **Determinism regression slips into main** | Med | High | Replay-test gate in CI on every PR; `determinism-break` label workflow (§11.4) | `determinism` job red on `main` | systems |
| R2 | **Sim tick budget blown at 8 CCU** | Med | High | Nightly perf bench from W3; criterion benches per system; budget watchdog metric | `forge_sim_tick_duration_ms` p99 > 30 ms | systems |
| R3 | **Schema drift between Rust and TS** | Med | Med | `codegen-check` CI job that fails on diff; generated artifacts committed | `codegen-check` red | shared schema lead |
| R4 | **LFS pointers landing in Postgres or in built binaries** | Low | High | `lfs-check` CI job; bootstrap script verifies `git lfs install` | `lfs-check` red, or a build artifact > 200 MB | infra |
| R5 | **Persistence write-contract violation (Doc #13 §4 step 5)** | Low | Critical | Persistence crate's only public API is the dispatcher path; integration tests assert no out-of-band writes; `audit_log().writes_count()` assertions | Mismatch between dispatcher count and DB write count | persistence lead |
| R6 | **MCP capability bypass** | Low | Critical | Doc #25 §T-13-13 invariants encoded as type-level constraints; integration tests for every error code; security suite in CI | Capability denial counter spikes; OR new verb added without registry update | systems |
| R7 | **Pixel-art style drift** | High | Med | `tools/style-validator` (Doc #10 §6) gates content PRs; art-lead-only review on `content/sprites/` | Validator failures on PR; Garriott-recognisability test fails | art lead |
| R8 | **Aseprite license / pipeline regression** | Med | Med | Pipeline scripts are pinned to a specific Aseprite version in CI; legacy pipeline (1992 reference assets) is gated behind license-holder access | Aseprite version bump breaks atlas-pack output | art lead |
| R9 | **Browser audio/WebSocket flakiness on macOS Safari** | Med | Med | Playwright e2e runs on Chromium + Firefox + WebKit; manual Safari smoke each Friday | e2e WebKit lane red | client lead |
| R10 | **Postgres GIN index bloat at 500+ entities** | Low | Med | Nightly vacuum job; index-size metric panel; `tests/perf/` includes a 5,000-entity bench | Replication tail latency > 200 ms | persistence lead |
| R11 | **Single-Region scope creep** | High | High | Strict "Britain-only" rule (Doc #11 §6); any expansion proposal = Phase 2 | Backlog accumulates non-Britain tasks | EM |
| R12 | **Unreal-shaped solutions creep into the Rust server** | Med | Low | ADR-0002 explicitly cites Doc #9 supersession; review checklist includes "is this a UE5-ism?" | Code mentions `UWorld`, `UObject`, replication graph metaphors | systems |
| R13 | **Replay format breaking changes mid-prototype** | Med | Med | `crates/replay/FORMAT.md` versioned; format version embedded in replay file; CI loads old replays through a migration shim | Determinism job fails for "old format" reason | systems |
| R14 | **Network protocol drift between client and server** | Med | High | `SCHEMA_VERSION` enforcement at handshake; ts-rs / prost shared types; `tests/integration/networking/` covers every message | `ERR_SCHEMA_VERSION` rate spikes | networking |
| R15 | **Demo-day stack flake** | Med | Critical | Pre-baked demo stack with a known-good replay seed; offline-capable demo build (no live cloud); two laptops with the same build, hot-spare on standby | Pre-demo smoke test fails in any way | EM |

---

## 16. Definition of Done — Phase 1 Prototype

All of the following must be true before the W12 demo to Garriott is considered green-lit. Each item is owned by the named lead and evidenced by a CI artifact, a PR link, or a runnable demo.

### 16.1 Functional

- [ ] Britain (256×256, ground + 1 floor for the Castle interior) loads in the client and renders correctly. *Evidence: e2e `britain_smoke.spec.ts` green.*
- [ ] All 50 Phase-1 archetypes are interactive end-to-end (examine, use, drop, optionally combine). *Evidence: integration tests, content lint.*
- [ ] All 15 Britain NPCs run their full daily schedules (Doc #17 §6). *Evidence: 24-in-game-hour replay test with no schedule-step warnings.*
- [ ] The 8-Virtue scoring (Doc #5) updates on every dispatcher verb that carries a `VirtueWeights` mapping. *Evidence: integration tests; HUD demo.*
- [ ] Gypsy character-creation (Doc #25 §T-15-1) → starting-kit (Doc #25 §T-15-6) flow runs end-to-end with all 8 class outcomes reachable from the UI. *Evidence: e2e `character_creation.spec.ts` green for all 8 classes.*
- [ ] 8 simultaneous players in Britain, real-time replication, no desync drift after 15 minutes. *Evidence: load test + recorded session.*
- [ ] Persistence: log out, log in, see the same world. *Evidence: integration test + manual demo.*
- [ ] Procedural Cave-of-Trials regenerates with a different layout per seed. *Evidence: 10-seed sweep test.*
- [ ] UGC editor: place 3 archetypes + 1 trigger, publish, friend joins and triggers it. *Evidence: e2e `ugc_publish.spec.ts` green.*
- [ ] Audio + lighting: torches flicker; fire crackles; original soundtrack plays during exploration. *Evidence: video walkthrough.*

### 16.2 Engineering quality

- [ ] CI green on `main` for 5 consecutive business days before demo day.
- [ ] All CI jobs (lint, codegen-check, typecheck, unit-rust, unit-ts, integration, determinism, e2e) running on every PR.
- [ ] Coverage thresholds hit (§8.2).
- [ ] Determinism replay-test gate green; baseline replay re-recorded within the last 7 days.
- [ ] Sim-tick p99 < 15 ms at 8 CCU + 500 active entities. *Evidence: nightly perf job.*
- [ ] No `unwrap()` outside test code, no `unsafe` blocks, no `panic!` in non-test code. *Evidence: clippy clean.*
- [ ] All `pub` items in `crates/shared` documented (cargo-doc clean).
- [ ] Zero `[OPEN]` items in Doc #13, Doc #14, Doc #21, Doc #22, Doc #23. *Evidence: ripgrep check in CI.*

### 16.3 Operability

- [ ] Grafana dashboards (§9.4) live and showing real shard data.
- [ ] Auth-stub introspection contract conforms to Doc #25 §T-13-13.
- [ ] Runbook skeletons (§13.4) reviewed by infra lead.
- [ ] One-laptop demo: the entire stack runs locally with `pnpm dev` plus `docker compose up -d`.

### 16.4 Documentation

- [ ] All ADRs 0001–0010 merged with status `Accepted`.
- [ ] `_docs/` cross-doc consistency audit (Doc #30) refreshed; no stale `[OPEN]` cross-references.
- [ ] Demo script written, reviewed, and rehearsed twice.
- [ ] Video walkthrough recorded.
- [ ] README has the 60-second elevator pitch, the 5-step bootstrap, and the demo-build instructions.

### 16.5 Demo gates (Doc #11 §5 mapped)

- [ ] **Fidelity Test:** Garriott recognises the game as Ultima VII within 60 seconds.
- [ ] **Simulation Test:** Garriott spends 5+ minutes experimenting and says it feels like the original.
- [ ] **Virtue Test:** Garriott sees clear moral consequences and approves.
- [ ] **Community Test:** Garriott builds and shares a tiny creation with the team and smiles.
- [ ] **Future Vision Test:** Garriott says, "I can see how this becomes the living Britannia I always wanted."

The five demo gates are the *outcome* metric. The 16.1–16.4 lists are the *input* gates that maximise the chance of hitting the outcomes.

---

## 17. Open Questions

These are items deliberately deferred from this doc. Each should be answered before its referenced trigger; any not answered by the trigger date is escalated to engineering leadership.

| ID | Question | Owner | Trigger | Notes |
|---|---|---|---|---|
| #40-OQ-1 | Do we self-host Turborepo cache (S3-backed) or use Turbo Cloud? | infra lead | W2 (before CI hits cold-cache pain) | Self-host is cheap; Turbo Cloud is convenient. ADR pending. |
| #40-OQ-2 | Browser support matrix — Chrome only at Phase 1, or all evergreen? | client lead | W3 | Demo-day target is Chromium. e2e WebKit lane stays green for "no surprises in Phase 2". |
| #40-OQ-3 | Codespace prebuild cadence (hourly / per-merge) | infra lead | W2 | Affects $ but not correctness. |
| #40-OQ-4 | Whether the Phase-1 client should include a pixel-art-locked rendering shader vs naive nearest-neighbour upscale | art lead | W11 | Doc #10 §2 mandates pixel-art locked; impl-decision is which exact shader. Plain nearest-neighbour likely sufficient for the demo. |
| #40-OQ-5 | Does the determinism gate cover only the simulation, or also the persistence write order? | systems lead | W6 (when persistence enters the gated path) | Currently scoped to sim. Persistence ordering is separately covered by integration tests. ADR pending. |
| #40-OQ-6 | Phase-2 cloud-deploy target (AWS/GCP/Fly/Hetzner) | infra lead | W12 (post-demo) | Out of Phase 1. Placeholder in `infra/terraform/`. |
| #40-OQ-7 | UGC `script_invoke` Phase-2 sandbox runtime (Wasmtime / Deno-style isolate / Lua) | systems lead | post-demo | Doc #19 deferred decision; Phase 1 ships no Trusted sandbox. |
| #40-OQ-8 | Audio-mixer position — server-authoritative event fan-out only vs client-side mix-down with positional dead-reckoning | audio lead | W11 | Doc #27 §10.1 indicates verb-keyed SFX hooks; full spatialisation deferred. |
| #40-OQ-9 | Whether `forge-mcp-bridge` ships in the prototype or is Phase 2 | tooling lead | W10 | Doc #14 §2 stdio path is needed for QA; the bridge binary may or may not be packaged. |
| #40-OQ-10 | Data-residency and player-account jurisdiction split (Doc #21 §2.2) | live ops | post-demo | Phase 2 concern; mentioned here only so it doesn't get lost. |

---

## 18. Cross-Doc Update Log

This doc cross-references many existing docs. The following cross-doc edits are required as a follow-up PR:

- **Doc #9 §4 (Final Recommendation):** prepend a SUPERSEDED-BY box pointing to Doc #40 §3.6.
- **Doc #11 §4 (Milestone Roadmap):** append a forward-link to Doc #40 §14 for the per-week engineering deliverables.
- **Doc #14 §2 (Architecture):** reword "UE Subsystem" to "the `mcp-server` Rust crate co-resident with `forge-shard`" with a footnote referencing Doc #40 §3.6.
- **Doc #21 §2.1 (Local Save):** strike "embedded in UE5 via the established `SQLiteCore` plugin"; replace with "embedded in `forge-shard` via the `rusqlite` crate".
- **Doc #22 §2 (Topology) table:** strike "UE5 dedicated-server binary" rows; replace with "Rust `forge-shard` binary"; preserve the rest of the table.
- **Doc #22 §4.1 (Wire Format):** strike "native UE5 plugin available"; replace with "native `rmp-serde` Rust support; `@msgpack/msgpack` TS support".
- **Doc #28 (Telemetry):** confirm OTel + Prometheus + Grafana picks against §9 here; align metric names if they drift.
- **Doc #30 (Cross-Doc Consistency Audit):** rerun after the above edits; expect the engine-name-grep to be clean.
- **Doc #31 §1 (Animation Philosophy):** replace "rendering integration with UE5" with "rendering integration via PixiJS in the Doc #40 client".
- All five docs above should re-cite Doc #40 in their `Depends on:` line.
- **2026-05-04 — OQ-2 resolved — web client permanent.** Per Doc #41 OQ-2 resolution, the TS/PixiJS web client is a permanent product surface (not a Phase-1 throwaway). This doc updated to reflect: TS engineer role is permanent (§3.5); web-client CI is on the same tier as UE5-client CI (§6.1); QA matrix, security review, accessibility (Doc #34), and localization parity (Doc #33) cover both clients. The "feature-flagged subset" policy (web may omit features, never adds them) is unchanged.

The cross-doc PR is owned by the engineering lead and lands in the same week as W1.

---

End of document.
