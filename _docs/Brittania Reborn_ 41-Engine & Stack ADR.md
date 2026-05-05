# 41 — Engine & Stack ADR (Architectural Decision Record)

Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0
Date: 2026-05-04
Author: [Engineering Lead]
Status: **Binding architectural decision.** Resolves the standing tension between Doc #9 (UE5-everywhere) and Doc #40 (Rust authoritative server + TypeScript browser client). Supersedes Doc #9 §4 client-engine recommendation in part and refines Doc #40 §3 client choice. This ADR is the single source of truth for engine, language, and ownership boundaries across all twelve major subsystems. New design docs and code reviews defer to this document; deviations require an ADR amendment per §9.

Depends on: #1 Vision, #2 GDD, #6 Persistent World, #9 Tooling, #12 Slide Deck, #14 MCP Server Surface, #16 Combat & Magic, #17 Dialogue & NPC Schedule, #19 Quest & UGC Scripting, #21 Save Format & Shard DB, #22 Network Protocol & Replication, #23 Pathfinding & Spatial Systems, #27 Audio System, #29 Moderation & Admin Tools, #31 Sprite Animation Pipeline, #32 Anti-cheat & Security Hardening, #34 Accessibility, #35 PvP Design, #36 Procedural Quest Skeletons, #37 Voice Chat, #38 Data Export & GDPR Portability, #39 Console Certification (PS5 & Xbox), #40 Implementation Scaffolding & 12-Week Engineering Plan.

---

## 1. Status & Context

### 1.1 The conflict this ADR resolves

The project carries two engineering documents written four months apart that recommend incompatible technology stacks:

- **Doc #9 (Tooling, May 2026, v1.1)** recommends **Unreal Engine 5 for both client and dedicated server.** It leans on UE5 native replication, the Gameplay Ability System (GAS), Behavior Trees, and OnlineSubsystem (EOS). The reasoning was sound at the time: UE5 ships a cohesive, end-to-end multiplayer pipeline and the team had no other production-grade option in hand.
- **Doc #40 (Implementation Scaffolding, May 2026, v1.0)** specifies a **Rust authoritative server (bevy_ecs + Tokio + sqlx) plus a TypeScript / PixiJS / Solid.js browser client.** The reasoning came from Docs #13, #21, #22, #23 crystallising the actual server workload as deterministic ECS, JSONB persistence, dispatcher arbitration, and tile-graph A* — none of which benefit from UE5's renderer, physics, or actor model.

Both documents are correct *for the parts they describe well.* Neither is correct as a complete stack:

- Doc #9 is wrong about the server. UE5 dedicated server is a poor fit for our workload, ties us to UE5's network model (which is wrong for tile-based persistent shards), and bottlenecks the simulation behind Blueprint/C++ iteration time.
- Doc #40 is wrong about the client. A TypeScript browser client cannot ship on PS5 or Xbox Series X|S, cannot meet the cert requirements in Doc #39, and cannot deliver the audio-visual fidelity Doc #10 demands at scale.

This ADR resolves the tension by **splitting the client into two production targets and locking the server to one.** It does so without compromise: the rule is one authoritative server, two client implementations, one wire protocol.

### 1.2 Date and binding scope

- **Decision date:** 2026-05-04.
- **Scope:** all engine, language, and platform-ownership decisions through Phase 1 (12-week prototype) and into Phase 2 (console cert + scale-out).
- **Override authority:** an ADR amendment, recorded in §11, signed by Engineering Lead and Technical Director.
- **Effective immediately:** every PR landing after the merge of this ADR is held to the boundary in §3 and the forbidden list in §4. PRs already in flight at merge time are grandfathered through their current review cycle but must be re-examined against this ADR before next iteration.

### 1.3 What this ADR is and is not

This ADR is a **boundary document.** It tells you which side of the wire each subsystem lives on, what is forbidden in each engine, and which third-party services we explicitly do not build in-house. It does **not** specify byte layouts (Doc #22 owns those), DDL (Doc #21), gameplay rules (Doc #16), or asset pipelines (Doc #31). When this ADR conflicts with another doc on questions of *ownership and engine*, this ADR wins; when another doc is more specific on questions of *behaviour and content*, that doc wins.

### 1.4 Why two clients is the right answer, not "pick one"

The instinct on reading the Doc #9 / Doc #40 conflict is to pick a winner. The instinct is wrong. The two documents describe two real production needs that no single client can satisfy:

- The **production need** (Doc #9): we must ship on PS5 and Xbox to be commercially viable as an Ultima successor; we must hit the audio-visual fidelity Doc #10 demands; we must hold cert.
- The **iteration need** (Doc #40): we must validate the simulation, the wire protocol, and the content pipeline in weeks, not months; we must give content authors and UGC playtesters a zero-install entry point; we must avoid the multi-minute UE5 build/cook loop during early protocol evolution.

A single client (UE5 only) defeats the iteration need. A single client (TS only) defeats the production need. The two-client architecture is the only configuration that satisfies both — and it works only because the **server is the single source of truth.** Without the Rust authoritative server, two clients would mean two implementations of the simulation, two desync surfaces, and a coordination tax that exceeds the iteration savings. With the server holding all authority, the two clients become render-and-input variants of one shared state, which is exactly what we need.

---

## 2. The Canonical Decision

### 2.1 Server — Rust, single implementation

The authoritative server is **one Rust binary** built on `bevy_ecs` for the simulation core and `tokio` for the async I/O perimeter, exactly as Doc #40 §3 specifies. There is one server. There is no UE5 dedicated server. There is no Node server. There is no shadow server.

- `bevy_ecs` carries the entity/component world; system scheduling is fixed-tick (Doc #22).
- `tokio` carries the WebSocket / TCP perimeter, the database connection pool (`sqlx` over Postgres), and the outbound calls to third-party services (§6).
- All authoritative game state — combat resolution, NPC pathfinding, dispatcher arbitration, save persistence, anti-cheat verification — runs here and only here.
- The server is **the only deterministic component** in the system. Doc #25's determinism requirements bind this binary; clients are explicitly non-deterministic.

The choice of Rust over alternatives (Go, C#, C++, Node) is justified in Doc #40 §3 and not relitigated here. The single-implementation rule, however, is critical and bears emphasis: **we will not build a "lightweight" Rust server for low-traffic shards and a "full" UE5 server for high-traffic shards.** That branching destroys the desync-detection story (the replay engine cannot validate two different simulators) and doubles the test surface. One binary, one configuration matrix, one story.

### 2.2 Client A — UE5 (production target)

Unreal Engine 5 is the **production client** for shipping platforms:

- **Desktop:** Windows, macOS, Linux.
- **Console:** PlayStation 5, Xbox Series X|S.

UE5 carries the platform-specific responsibilities that no browser can carry: console certification (Doc #39), platform identity (gamertag, PSN ID, friends graph, achievements), voice I/O (capture devices, push-to-talk, platform privacy gates), and console save APIs (XGameSave, PS5 SaveData). It also carries the high-fidelity render path Doc #10 envisions — pixel-art shaders, Niagara particles, MetaSounds dynamic music — that PixiJS cannot match.

UE5 ships the C++ client only. **No UE5 dedicated server.** **No UE5 listen server.** The UE5 client connects to the Rust authoritative server over raw sockets (TCP or WebSocket transport, framed Protobuf payloads per Doc #22).

### 2.3 Client B — TypeScript / PixiJS / Solid.js

The TypeScript browser client is **web-only and is a permanent product surface** (per OQ-2 resolution, 2026-05-04 — see §10, §11). It exists for two reasons:

1. **Phase 1 prototype velocity.** A browser client iterates faster than a UE5 client by an order of magnitude. Doc #40's 12-week plan delivers a vertical slice in the browser by W6, enabling the team to validate the wire protocol, the simulation, and the content pipeline before investing UE5 hours.
2. **Permanent web client (forever).** The browser client is a forever product target — not a Phase-1 throwaway. It carries press demos, livestream-mode spectator views, the UGC quest editor's preview pane (Doc #19), and a low-friction "try-it-now" entry point on the marketing site. Long-term staffing, CI, QA matrix coverage, security review, accessibility (Doc #34), and localization parity (Doc #33) are on the same tier as the UE5 client.

The TS client is bound by three permanent rules:

- **NEVER console.** It does not ship on PS5, Xbox, or Switch. It cannot. We do not pretend otherwise.
- **NEVER authoritative.** It runs no game logic the server does not also run. It predicts and reconciles; it never decides.
- **NEVER carries exclusive features.** Any feature the TS client implements must already exist in the UE5 client, or be on the UE5 client's roadmap. The TS client is a **subset** of the UE5 client, not a peer.

### 2.4 Wire protocol — single source of truth

The wire protocol lives at `/shared/proto/*.proto`. Protobuf is the chosen serialisation (FlatBuffers considered; see §10 #41-OQ-1 for the open question on final pick). Codegen produces:

- **Rust** types (`prost`-generated) for the server.
- **C++** types (`protoc` with the standard C++ plugin) for the UE5 client.
- **TypeScript** types (`protoc-gen-ts` or `buf` — see #41-OQ-4) for the web client.

Both clients consume the **same** generated types. There is no UE5-specific protocol extension. There is no TS-specific protocol extension. If a message exists, both clients can decode it; if neither client renders it, that is a render-side decision, not a protocol decision.

The wire is **versioned** — every message carries a schema version field, and the server-side handshake (per Doc #22) negotiates a compatible version on connect. Old clients connecting to new servers receive a graceful "please update" disconnect; new clients connecting to old servers (during a rolling deploy window) are routed to the older shard. This is the only legitimate reason for the wire to ever support more than one version simultaneously, and the support window is bounded by the deploy duration.

### 2.5 The "UE5 client is a dumb view" rule

This is the single most important rule in this ADR. The UE5 client is a **render and input layer.** It owns:

- Mesh, sprite, and shader rendering.
- Audio mixing and DSP.
- Particle and VFX simulation.
- Input capture and binding.
- Local-only animation FSMs (server emits state, UE5 picks blends).
- Client-side prediction for player movement, with server reconciliation.

It does **not** own:

- Authoritative position, health, inventory, or any persisted state.
- NPC AI, pathfinding, schedule, or behaviour decisions.
- Combat resolution, damage rolls, ability arbitration.
- Quest state, UGC script execution, or virtue calculation.
- Cheat detection, anti-cheat verdicts, or shard policy enforcement.

**UE5 native replication (UPROPERTY(Replicated), RepNotify, NetMulticast, RPCs) is forbidden.** See §4. The UE5 client speaks raw sockets to the Rust server over the protobuf wire. No exceptions.

### 2.6 Determinism is server-side only

Doc #25 BLOCK-P1 fixed determinism as a requirement of the simulation. This ADR clarifies the scope: **determinism binds the Rust server only.** Both clients are explicitly permitted to be non-deterministic (floating-point divergence in particle updates, audio jitter, frame-skip, prediction rollback) because no client decision is authoritative. The replay engine (Doc #22) replays the *server* trace; client divergence is invisible to replay.

This is the inverse of the classic FPS architecture (where the client must be deterministic enough to predict). Here, the server is the single deterministic actor and clients are dumb renderers of its trace.

The practical implication is that the Rust server must avoid every classic non-determinism source — floating-point in arithmetic that affects state, hashmap iteration order, system clock reads outside a single fixed-tick boundary, parallel system scheduling that does not topo-sort, RNG streams without explicit seeding. Doc #22 §determinism-harness defines the test that catches violations; this ADR mandates that the harness is gating in CI.

### 2.7 TS web client policy

The TS client is **web-feature-flagged.** It may **OMIT** any feature the UE5 client carries (voice chat, controller-rumble haptics, Niagara-quality particles, native console APIs). It may **NEVER ADD** a feature the UE5 client lacks. This is enforced at PR-review time via a `WEB_CLIENT_PARITY` check in the design-review template; see §9 for governance.

Concretely, omissions permitted in Phase 1:
- Voice chat (LiveKit Web SDK is supported, but it's optional).
- Console-only achievements and platform identity.
- High-end VFX (use simpler PixiJS particle approximations).
- Gamepad rumble.
- Platform-specific save flows.

Omissions **not** permitted:
- Any combat verb the UE5 client can issue.
- Any movement input the UE5 client can issue.
- Any chat or social verb.
- Any UGC editor verb.

The asymmetry is deliberate. Omitting *presentation fidelity* on the web is acceptable because the web's job is reach, not fidelity. Omitting *agency* on the web — taking away inputs the UE5 player has — would split the player base into two tiers, which is the opposite of what we want.

---

## 3. The 12-System Boundary Table

This is the centerpiece. Every major runtime system has exactly one owner; ambiguity here is the failure mode this ADR exists to prevent.

| # | System | Owner | Rule |
|---|---|---|---|
| 1 | Player movement | Rust authoritative + UE5/TS predict & reconcile | Prediction mirrors server line-for-line |
| 2 | NPC pathfinding | Rust only | UE5 NavMesh forbidden (Doc #23) |
| 3 | Animation FSM | Each client | Server emits state; client picks blends |
| 4 | VFX/particles | Each client, server-triggered | Server emits effect events |
| 5 | Dynamic music director | Rust state, client mixing | Server picks cue; UE5 MetaSounds / Web Audio mixes |
| 6 | Voice chat | Rust signaling + LiveKit SFU + client I/O | Don't build SFU |
| 7 | Spectator / replay | Rust replay engine; clients render stream | No separate UE5 replay |
| 8 | UGC quest editor | Web/TS tool; runtime in Rust | Not in UE5 |
| 9 | Cutscenes | UE5 Sequencer (cinematics); Rust scripted events (in-world) | Don't conflate |
| 10 | Login / shard select | Client UI + Rust service | Standard split |
| 11 | Save file I/O on console | Format: Rust; write call: UE5 platform API | Doc #39 cert |
| 12 | Combat resolution | Rust only | UE5 GAS forbidden (Doc #16) |

### 3.1 Player movement (Row 1)

The Rust server holds authoritative position. Both UE5 and TS clients run **client-side prediction** — when the player presses W, the avatar moves locally on tick *t* while the input is also dispatched to the server. The server processes the input on its tick *t+RTT/2*, returns the post-move position on tick *t+RTT*, and the client reconciles. This is the standard rollback/reconciliation pattern from Doc #22.

The constraint this ADR adds: **the prediction code must mirror the server's movement step line-for-line.** Two implementations of one algorithm is a known divergence risk. See open question #41-OQ-5 for the codegen-vs-double-write resolution.

Note that movement is the *only* §3 row where clients are permitted to run a parallel implementation of authoritative logic. Every other row keeps decisions purely on the server. We accept the duplication for movement specifically because input latency is the most user-visible metric in the game and prediction is the only way to mask sub-100ms RTT. The duplication risk is bounded by the fact that the movement step is a small, well-specified function (Doc #22 specifies it in pseudocode); other systems are too large to safely duplicate, which is why they don't.

### 3.2 NPC pathfinding (Row 2)

NPCs path on the Rust server using the tile-graph A* in Doc #23. **UE5 NavMesh is forbidden for NPC pathing** because (a) NPCs in this game schedule on a tile grid, not a continuous mesh, and (b) NavMesh state is per-client, which makes it unusable for authoritative decisions. Clients render the path the server emits.

The exception is **player avatar local pathing for click-to-move** — the UE5 client may run a local NavMesh or A* purely as a *prediction hint*, but the authoritative path is the server's.

### 3.3 Animation FSM (Row 3)

Animation state machines are **per-client.** The server emits semantic state — "Avatar #42 is in combat-stance, swinging-right, hit-frame-3" — and each client picks blend weights, transition curves, and IK solutions appropriate to its rendering pipeline. UE5 uses its AnimGraph; TS uses spritesheet frame indexing.

This means the same server trace can drive a high-fidelity UE5 skeletal mesh and a 2D PixiJS sprite-flip, and both are correct.

### 3.4 VFX and particles (Row 4)

Visual effects are **client-rendered, server-triggered.** The server emits an "effect event" — "fireball impact at (x,y,z), magnitude 0.7" — and each client decides how to render it. UE5 spawns a Niagara system; TS plays a spritesheet animation. Neither client owns the *decision* to spawn the effect; both own the *rendering* of it.

### 3.5 Dynamic music director (Row 5)

The music director's state machine — "we're in exploration → combat-imminent → combat → victory" — runs on the **Rust server**, per Doc #27. The server emits cue-change events; each client mixes the cue using its native audio stack (UE5 MetaSounds with full DSP, TS Web Audio with a simpler mixer). Music *layers* and *transitions* are client-side; *cue selection* is server-side.

### 3.6 Voice chat (Row 6)

Voice goes through **LiveKit SFU** (selective forwarding unit, third-party). The Rust server handles signalling — who can hear whom, mute/kick policy, proximity zoning per Doc #37 — and issues short-lived LiveKit access tokens. The actual audio media flows client ↔ LiveKit ↔ client; it does not transit our server.

We do **not build a voice SFU.** Building a production-grade SFU is a multi-year project; we lease one. See §6.

The split here is unusual enough to merit a note: the Rust server is the *policy* authority (who is in the room, who is muted, what proximity zone each player sits in) but never carries the *media.* Audio packets are encrypted client-to-SFU-to-client; we do not see them, which is intentional from a privacy and bandwidth standpoint. The price is that server-side moderation cannot inspect audio in real time; toxic-voice moderation relies on player reports plus an opt-in audio-recording feature the player consents to per Doc #29.

### 3.7 Spectator and replay (Row 7)

The replay engine is **Rust-side** — it records the authoritative tick stream and plays it back into a "headless server" instance, which then emits the same state-change events to spectator clients that a live server would emit. Clients render replays exactly as they render live games. **No separate UE5 replay system, no UE5 demo files.** This sidesteps the Doc #9 trap of building two replay paths.

The single-replay design pays off everywhere downstream: anti-cheat investigations replay the same trace; community highlight reels replay the same trace; QA repro of a player bug replays the same trace; tournament observer streams replay the same trace. UE5 ships its own replay system (`Demo Recording`) and we explicitly do not use it, because doing so would mean QA, anti-cheat, and tournaments use one path and players' clients use another — exactly the duplication this ADR is designed to prevent.

### 3.8 UGC quest editor (Row 8)

The quest editor is a **web tool** (TS, Solid.js) per Doc #19. UGC authors edit quests in the browser; the editor compiles to the Rust runtime's quest IR. **The editor is not embedded in the UE5 client.** UE5 may launch the editor as a webview-style overlay or via "open in browser," but the editor's code is web-only.

This is non-obvious — many MMOs embed their editor in the game client. The reasoning here: a browser editor is dramatically faster to iterate on, reaches more authors (no install, runs on iPad, runs on a Chromebook), and avoids the cert-time penalty of shipping editor code through the console certification process. Console players can still *play* UGC quests; they cannot *author* them on console, which is a Phase-2 question to revisit if author-on-console becomes commercially worth the cert overhead.

### 3.9 Cutscenes (Row 9)

This is the row most likely to be misread. There are **two kinds of cutscene** and they have different owners:

- **Cinematic cutscenes** (a fixed pre-rendered or scripted sequence with cameras, voiceover, baked timing — e.g. the intro movie, end-of-act stingers): **UE5 Sequencer.** These are linear, non-interactive, and run only on the UE5 client. The TS client either skips them or shows a still-frame fallback.
- **In-world scripted events** (Iolo waves at you when you walk past his shop; a wandering bard plays a tune at noon): **Rust scripted events.** These run in the simulation, drive the same NPC entities the rest of the game uses, and replicate to all clients identically.

Conflating these is the failure mode. A scripted event is **not** a cinematic; a cinematic is **not** an NPC behaviour.

### 3.10 Login and shard select (Row 10)

Standard client-server split. The client (UE5 or TS) renders the login UI, captures credentials, and calls the Rust auth service over the same wire protocol. The Rust service validates against the auth provider (Auth0/Clerk/Supabase, see §6), issues a session token, and returns the available shard list. The client picks a shard and the session continues. No surprises here; called out only because Doc #9 originally placed shard select inside UE5's OnlineSubsystem layer, which this ADR rejects.

### 3.11 Save file I/O on console (Row 11)

Console cert (Doc #39) requires saves to be written via **platform APIs** — XGameSave on Xbox, SaveData on PS5. These APIs are only callable from the native UE5 process; they cannot be called from a server.

The ADR boundary: **the save *format* is owned by Rust** (Doc #21's serialisation), but **the *write call* on console is owned by the UE5 platform layer.** The Rust server emits a serialized save blob; the UE5 client receives the blob and hands it to the platform save API. Neither side can do the other's job. This is the only place a client touches authoritative save data, and it is a pure pass-through.

The pass-through model is critical: the UE5 client must **not** parse, modify, or interpret the save blob. It receives an opaque byte sequence, hands it to the platform API, and on load receives an opaque byte sequence back, which it forwards to the server. Treating the blob as opaque is what keeps Doc #32 anti-cheat enforceable (a parsing client could mutate the blob; a forwarding client cannot meaningfully tamper with content it does not understand) and what keeps the Rust save format the single source of truth.

### 3.12 Combat resolution (Row 12)

All combat damage rolls, ability activation, status effects, ability cooldowns, and target validation run on the **Rust server.** The UE5 Gameplay Ability System (GAS) is **forbidden** for authoritative combat because GAS is non-deterministic, replicates state via the UE5 native replication path (forbidden, §4), and runs ability logic Blueprint-side, which cannot be desync-checked against a Rust server trace. See Doc #16.

The UE5 client may use a tiny local GAS-like cooldown predictor *for input gating only* (so the player sees the icon grey out the moment they press the key), but every actual ability activation is server-decided.

### 3.13 The principle the table encodes

The 12 rows are not arbitrary; they are an exhaustive partition of "things that happen during gameplay." The partition rule is the same one stated in §4.2: **anything that could change the outcome of the game runs on the server, and anything that is purely render-and-input runs on the client.** Edge cases — input prediction (§3.1), local cooldown indicators (§3.12), animation blends (§3.3) — are explicitly client-side because they affect only what the local player *sees* and the server's verdict is always final on what *happened*.

When a future feature does not obviously fit one of these 12 rows, the §9.2 governance rule applies: an ADR amendment adds a row before the code is written.

---

## 4. UE5 Features Forbidden

This section is the most important guardrail in the ADR. UE5 is a magnificent engine, and the gravitational pull of its built-in multiplayer features is enormous. Every feature in the list below is forbidden because it presupposes a UE5 dedicated server, which we are not running. Using any of them silently re-introduces the Doc #9 architecture and fights the Rust server.

### 4.1 The forbidden list

- **UE5 native replication** — `UPROPERTY(Replicated)`, `RepNotify`, `NetMulticast`, server/client RPCs. **Why:** these primitives assume a UE5 server is the source of truth. Our source of truth is Rust. Using replication anywhere causes a second replication path to spring up alongside the Protobuf wire, splitting state across two sources, and that is the exact failure mode that destroys multiplayer codebases. **Use instead:** the Protobuf wire and a hand-rolled UE5 subsystem that decodes incoming messages and applies them to local actors.
- **Gameplay Ability System (GAS)** — `UAbilitySystemComponent`, `GameplayEffect`, `GameplayCue`, `Attribute Set`. **Why:** GAS is non-deterministic, deeply tied to UE5 replication, and incompatible with Doc #16's authoritative combat model. It also presumes server-side ability execution in UE5. **Use instead:** a dumb client-side predictor that mirrors the Rust ability dispatcher (cooldown timer, icon state, predicted-hit indicator). All real damage runs in Rust.
- **OnlineSubsystem / EOS for game sessions** — `IOnlineSession`, EOS Sessions, EOS Lobbies. **Why:** game-session management belongs to the Rust matchmaker and shard router. Using EOS Sessions creates a parallel matchmaking surface that is not aware of shard policy, anti-cheat verdicts (Doc #32), or moderation bans (Doc #29). **Limited use permitted:** OnlineSubsystem is OK for *platform identity only* — gamertag, PSN display name, friends list, achievements, presence — because these are platform-mandated by Doc #39 cert and have no in-world authority.
- **NavMesh for NPCs** — `UNavMeshBoundsVolume`, `URecastNavMesh`. **Why:** NPCs path on a tile grid (Doc #23), not a continuous mesh. NavMesh state is also per-client, which makes it unusable for any authoritative decision. **Use instead:** the Rust tile-graph A* for all NPC paths; UE5 receives a serialized path and tweens the actor along it.
- **Behavior Trees / Blackboard for NPC AI** — `UBehaviorTree`, `UBlackboardData`. **Why:** NPC decision logic is authoritative server logic. It runs in Rust because (a) NPC schedules persist across server restarts (Doc #17), (b) NPCs are simulated when no player is nearby, and (c) the dispatcher arbitrates NPC verbs against player verbs in a single Rust loop. Behavior Trees in UE5 cannot satisfy any of those constraints. **Use instead:** Rust ECS systems for NPC logic; UE5 receives the resulting NPC state stream and renders it.
- **Blueprints for authoritative gameplay logic** — any Blueprint that decides damage, inventory mutation, quest state, virtue calculation, persistence, or spawn logic. **Why:** Blueprints cannot be desync-checked against a Rust trace; they are not deterministic; they cannot be moderated, replayed, or anti-cheat-verified. **Limited use permitted:** Blueprints are *fine* for UI animations, menu transitions, button hover effects, cosmetic-only behaviours, and any logic that exists only on one client and affects no one else.

### 4.2 The principle behind the list

If a UE5 feature presupposes that UE5 is authoritative, that feature is forbidden. If it is purely a render-and-input feature, it is fine. The simplest test: **"Could this feature change the outcome of the game if the network dropped?"** If yes, it's forbidden in UE5; it lives in Rust. If no, it's permitted.

### 4.3 The single test

If you can't decide whether a UE5 feature is allowed, ask:

1. Does the feature need a server-side counterpart that UE5 normally provides (replication, dedicated-server actor, GAS server hooks)? If yes — **forbidden**, because we don't run a UE5 server.
2. Does the feature mutate state that any other player can observe? If yes — **forbidden**, because that state lives in Rust.
3. Is the feature purely visual, audial, or input-side, with no consequence to other players or to persisted state? If yes — **allowed.**

The test produces the right answer in every case the team has surfaced so far. When it doesn't, that's an ADR-amendment trigger.

### 4.4 Common request patterns and the right answer

The team will, sooner or later, ask for one of the following. The answers are pre-baked here.

- *"Can I just `UPROPERTY(Replicated)` this one variable for a quick prototype?"* — No. Once the second replication path opens, it never closes. Add the field to the Protobuf message and pipe it through the existing wire decoder.
- *"I need a complex AI for this boss; can I use Behavior Trees because the UE5 visual editor is faster?"* — No. The boss AI runs in Rust because every player on the shard must see the same boss decision. Build the Rust ECS system; render-side, the boss is just another NPC.
- *"GAS has a beautiful tag system for status effects. Can I use it just for the visual icons?"* — Yes for the visual icon system *only* (icon, tooltip, render flag), no for any rule that GAS would normally enforce (does this stack? does it suppress that? does it tick down?). The rules live in Rust; UE5 reads `effect_id` and renders the icon.
- *"Can I use UE5's session browser for matchmaking?"* — No. Shard selection is Doc #6 Rust service. EOS Sessions creates a parallel matchmaking surface.
- *"My designer wants to script an in-world event in Blueprints because they don't write Rust."* — No. Designers script in the UGC quest DSL (Doc #19), which compiles to Rust IR. Blueprints are for UI animations.

---

## 5. Rust Over-reach Traps

The opposite mistake is also possible. Rust is a fine systems language and `bevy_ecs` is a competent engine framework, but **we are not building Bevy.** The following must remain client-side, in either UE5 or PixiJS:

- **Renderer.** UE5's renderer (Lumen, Nanite, MetalRT, HLSL/MSL shader compilation) and PixiJS's WebGL/WebGPU renderer. We do not write a Rust renderer.
- **Audio mixer / DSP.** UE5 MetaSounds and the Web Audio API. Mixing graphs, convolution reverbs, EQ, compression, spatialisation — client-side. The Rust server emits cue events (§3.5), not audio samples.
- **Physics engine.** UE5 Chaos. Client-side ragdoll, cloth, destructibles. Rust has no physics; the simulation is grid-discrete (Doc #4).
- **Tone mapper.** UE5's PostProcessVolume and HDR tone-mapping. Client-side.
- **Particle engine.** UE5 Niagara and PixiJS particle emitters. The server emits effect events; the client owns the particle simulation.
- **Shader compiler.** UE5's shader pipeline and the browser's shader pipeline. We do not write shaders in Rust.

The principle: Rust owns **simulation, persistence, network, and policy.** Clients own **render, audio, input, and prediction.** Crossing this boundary in either direction is over-reach. We have caught ourselves once already (an early draft of Doc #27 implied a Rust-side audio mixer); this section is the warning.

### 5.1 The "we already have it" trap

A common over-reach pattern is "we're already running Rust on the server, so let's also do *X* in Rust." The fact that we *can* is not a reason; the question is always whether Rust is the *right tool for X*. For a renderer, audio mixer, or physics engine, the answer is no — UE5 and the browser have decades of investment in those domains and we cannot beat them with a side project.

A symmetrical trap exists for UE5: "we're already running UE5 on the client, so let's also run it on the server." Same answer for the same reason — Rust, bevy_ecs, and tokio fit this server's workload (deterministic ECS, JSONB persistence, async I/O) far better than UE5's actor model and replication-bound lifecycle.

Picking the *wrong* tool because you already own a license to it is a category error. The ADR exists to call this error out by name.

### 5.2 Borderline cases and their resolutions

Some workloads sit on the edge between "Rust system thing" and "client engine thing." The resolutions:

- **Procedural world generation (Doc #8).** Rust. The world graph is persistent state; the generator's output is the authoritative tile data. UE5 streams it for rendering; it does not generate.
- **Audio cue selection (Doc #27).** Rust (selection) + client (mixing). Already covered in §3.5; called out again because the temptation to put cue selection in MetaSounds is real.
- **Input rebinding UI.** Each client. The bound *verbs* are server-defined (a finite enum), but the per-platform input-to-verb mapping is purely client-side and platform-specific.
- **Localised text (Doc #33).** Both. Source strings live in `/shared/locale/`; both clients pull the same bundle. Server emits string IDs, never localised strings.
- **Server-side anti-cheat heuristics (Doc #32).** Rust. No exception; client-side anti-cheat is theatre.

---

## 6. Third-Party Services

These services are explicitly **neither Rust nor UE5.** They are leased capacity. The decision to lease rather than build is a deliberate scope-control measure; each item below is something we *could* build, would do badly, and would burn months of runway on.

| Service | Provider | Why not in-house |
|---|---|---|
| Voice SFU | LiveKit | Multi-year project to build well |
| Auth | Auth0 / Clerk / Supabase | OAuth, MFA, social login |
| Payments | Stripe | Already integrated via MCP |
| Object storage | S3-compatible | UGC, screenshots, GDPR exports |
| CDN | CloudFront / Bunny | Asset and patch distribution |
| Observability | Grafana / Prometheus / OTel | Doc #40 §9 |
| Email/SMS | Postmark / Twilio | Account flows, breach notifications |
| Push | Firebase / OneSignal | Mobile companion app |
| **Discord** | **Discord SDK + Bot API** | **Community augmentation only — Rich Presence, OAuth link, guild bot. NEVER required, NEVER authoritative, NEVER part of GDPR perimeter (Doc #38). See Doc #37 §Discord-interop for the integration spec.** |

### 6.1 Notes per service

**Voice SFU — LiveKit.** Picked for selective forwarding architecture, WebRTC-compatible, supported in UE5 via native plugin and in browser via the LiveKit Web SDK. Self-hosted vs managed deployment is open question #41-OQ-3. Doc #37 is the integration spec.

**Auth.** Three candidates remain: Auth0 (mature, expensive at scale), Clerk (modern UX, less console-friendly), Supabase Auth (cheap, integrates with our Postgres). Final pick deferred to Phase 1 W2; the Rust auth service has a provider-abstraction layer so the choice is reversible. The console TRC/XR rules around password requirements, MFA disclosure, and account-recovery flows constrain the pick — Auth0 has documented PS5/Xbox compatibility, Clerk is unclear, Supabase is workable but requires custom flow work. The fallback if all three present friction is a thin in-house auth layer over Postgres with `argon2id` hashing — explicitly *only* a fallback because it adds the very long tail of edge cases §6.2 warns about.

**Payments — Stripe.** Already integrated via the project MCP toolchain. Subscription, one-time, and Connect flows all available; we will likely use one-time for cosmetic purchases and subscriptions for the GM-hosted-session product (Doc #26).

**Object storage — S3-compatible.** AWS S3 in production, MinIO in dev. Stores UGC blobs (Doc #19), player screenshots, GDPR export bundles (Doc #38), and patch deltas. Must be S3-compatible so we can swap providers (Cloudflare R2, Backblaze B2) without code changes.

**CDN.** CloudFront for AWS-native simplicity, Bunny for cost-per-GB at scale. Decision deferred until traffic profile is known. Used for asset distribution to clients and patch deltas.

**Observability — Grafana / Prometheus / OpenTelemetry.** Doc #40 §9 specifies the stack. Rust server emits OTel traces and Prometheus metrics; clients emit OTel browser traces (TS) or stat-update RPCs (UE5).

**Email/SMS.** Postmark for transactional email (account verification, password reset, breach notification). Twilio for SMS-based 2FA when MFA is required. Both reachable through the Rust server; clients never call them directly.

**Push notifications.** Firebase Cloud Messaging (Android), APNs (iOS), or OneSignal as a multi-platform abstraction. Used by the mobile companion app (open question #41-OQ-6).

**Discord.** Discord is a **community-augmentation layer.** It is not part of the game's authority graph, not part of the GDPR perimeter (Doc #38), and never required to play.
- **Rich Presence:** the UE5 and TS clients publish "Playing on Cove Shard, Level 12 Mage, In Combat" via the Discord SDK. Read-only, optional, opt-in.
- **OAuth link:** players can link their Discord account to their Britannia Reborn account for in-game perks (a cosmetic ribbon, access to a community channel). Linking is optional and severable.
- **Guild bot:** a Britannia Reborn Discord bot exposes guild-level commands (`/who`, `/raidcall`, `/uptime`) for community management. The bot is a *client* of the Rust server's public API; it has no privileged access.

Critical constraint: **Discord is never on the cert path** for console and never in the data-export path for GDPR (Doc #38) because we never store Discord-side data outside what the player explicitly links. Doc #37 §Discord-interop holds the integration spec.

### 6.2 The principle behind the table

Each row in §6 is a service whose absence would not change the *game*, but whose presence would consume a substantial engineering quarter to build. Authentication is a solved problem with a known long tail of edge cases (account recovery, account takeover, MFA enrolment, social-login provider deprecation); paying Auth0 or Supabase to handle it costs less than one engineer-month of build cost across the project lifetime. Voice SFU is the same calculation at a much larger scale. The decision rule for "should we lease vs build" is: **if a competent third-party offering exists, the build cost exceeds two engineer-months, and the feature is not in our differentiating moat (Docs #4, #5, #7), we lease.**

---

## 7. Phasing for the 12-Week Prototype

This section binds the Doc #40 12-week schedule to the boundary in §3.

### 7.1 W1–W2: Rust server + protocol scaffolding

The Rust authoritative server, the `/shared/proto` Protobuf schema, the codegen pipeline (Rust + TS first; C++ added in W6), the bevy_ecs world, the tokio I/O perimeter, and the deterministic-tick harness all land in these two weeks. No client work yet. **Deliverable:** a Rust server that accepts a WebSocket connection, simulates a 100×100 tile world with N moving NPCs, persists state to Postgres via sqlx, and survives a 24-hour soak run.

The "no client work yet" rule is deliberate. Starting client work before the server is loadable produces clients written against an imagined protocol; the inevitable rewrite when the server arrives is more expensive than the two weeks of waiting. We pay for one queue.

### 7.2 W3–W6: TS web client, vertical slice in browser

The TS client (PixiJS for rendering, Solid.js for UI shell, generated TS Protobuf types) is built first because the iteration loop is fastest. The vertical slice — log in, walk around a town, talk to one NPC, fight one combat, save and reload — must be **playable in the browser by W6.** This proves the wire protocol, the simulation core, and the content pipeline before any UE5 hours are invested.

### 7.3 W5–W6: Protocol freezes (v1)

Concurrent with the W6 TS slice, the Protobuf schema is frozen at **v1.** Post-v1 changes require a versioned message and a migration path (Doc #22 specifies the wire-version handshake). This is the single most important commitment of the 12-week plan: once v1 ships, both clients must implement against it without further breaking changes for the duration of Phase 1.

"Freeze" here is precise: the field-numbering, message names, and required-vs-optional designations are immutable. *Adding* a new optional field to an existing message is allowed (Protobuf back-compat). *Adding* a new message is allowed. *Renaming, renumbering, or removing* anything is not. The freeze is what enables UE5 and TS to develop in parallel; without it, the two clients would chase a moving target.

### 7.4 W6–W12: UE5 client onboarding in parallel

Starting W6, the UE5 client team begins work — the Protobuf C++ types are generated, a UE5 NetworkSubsystem is written that decodes incoming messages and applies them to local actors, and the UE5 client implements the same vertical slice the TS client already plays. **W12 deliverable: feature-equal between TS web and UE5 desktop.** Same login, same walk, same NPC, same combat, same save. Two clients, one server, one wire.

The UE5 client begins late on purpose. By the time UE5 work starts, the protocol is frozen, the server is stable, and the TS client has shaken out the obvious wire-level bugs. UE5 then implements against a known-good target rather than a moving one. This sequencing is the single biggest lever we have on UE5 onboarding cost.

### 7.5 Console cert is Phase 2

PS5 and Xbox cert work (Doc #39) is **Phase 2**, post-W12. The 12-week prototype ships UE5 desktop and TS web only. Console cert needs cert kits, dev accounts, TRC/XR review, and platform-API integration that cannot be parallelised inside 12 weeks.

### 7.6 What "feature-equal" at W12 means precisely

Feature-equal does not mean visually identical or audio-identical. UE5 will have richer particles, real-time lighting, MetaSounds-driven dynamic music, and gamepad rumble; the TS client will not. Feature-equal means **every input the UE5 client can submit and every state the UE5 client can observe, the TS client can also submit and observe.** The set of *verbs* is identical; the *fidelity of presentation* is intentionally not.

The W12 acceptance test is the same scripted playthrough run twice, once in each client, and producing the same trace on the Rust server. The graphical capture is allowed to differ; the wire trace is not.

### 7.7 Risks to the 12-week schedule that this ADR mitigates

The two-client architecture introduces specific schedule risks; this ADR's structure mitigates each:

- **Risk: UE5 onboarding takes longer than 6 weeks.** Mitigated by W1–W6 building on TS first, so the protocol is already validated when UE5 starts and UE5 has fewer protocol bugs to chase.
- **Risk: Protobuf codegen toolchain (#41-OQ-4) churns mid-prototype.** Mitigated by the W5–W6 freeze; toolchain churn after that window is forbidden.
- **Risk: UE5 team builds the wrong things while TS team is producing the canonical implementation.** Mitigated by §3's table: the boundary table makes "what the UE5 team is supposed to build" explicit and unambiguous.
- **Risk: TS team builds web-exclusive features under schedule pressure.** Mitigated by §9.3's release-blocker rule and the CI parity check.
- **Risk: Anyone reaches for UE5 native replication for "speed."** Mitigated by §4's explicit forbidden list and §9.6's escalation path.

---

## 8. Doc Cross-Reference Map

This ADR touches the following docs. One-line note per doc indicates the binding between this ADR and that doc.

| Doc | Title | What this ADR changes or affirms |
|---|---|---|
| #1 | Vision Statement | Affirms: vision is engine-agnostic; ADR is a delivery decision, not a vision change. |
| #2 | GDD | Affirms: gameplay rules unchanged; ADR partitions implementation only. |
| #6 | Persistent World | Affirms: persistent shards are Rust-server resident; UE5 instances are render clients. |
| #9 | Tooling | **Supersedes in part:** UE5 is the client engine, not the server engine. Doc #9 §4 amended by reference. |
| #12 | Slide Deck | Update slide on "tech stack" to show two clients + one Rust server + Protobuf wire. |
| #14 | MCP Server Surface | Affirms: MCP is Rust-resident (`mcp-server` crate); UE5 clients call it via the same wire protocol. |
| #16 | Combat & Magic | **Affirms strongly:** combat is Rust-only; UE5 GAS is forbidden (§4). |
| #17 | Dialogue & NPC Schedule | Affirms: NPC schedule and dialogue tree state run in Rust; UE5 renders dialogue UI. |
| #19 | Quest & UGC Scripting | Affirms: UGC editor is web/TS; UGC runtime is Rust. UE5 does not host the editor. |
| #21 | Save Format & Shard DB | Affirms: save format is Rust; console save *write* call is UE5 (§3.11). |
| #22 | Network Protocol & Replication | **Binding:** Protobuf at `/shared/proto` is the only wire; UE5 native replication forbidden. |
| #23 | Pathfinding & Spatial Systems | **Affirms strongly:** tile-graph A* is Rust; UE5 NavMesh forbidden for NPCs. |
| #27 | Audio System | Affirms: music director state is Rust; mixing is per-client (MetaSounds / Web Audio). |
| #29 | Moderation & Admin Tools | Affirms: moderation tools live in Rust services + web admin; no UE5 admin client. |
| #31 | Sprite Animation Pipeline | Affirms: sprite assets fed to UE5 paper2d-style pipeline and PixiJS; pipeline is engine-agnostic. |
| #32 | Anti-cheat & Security Hardening | Affirms: cheat verdict is Rust-only; UE5 client cannot vouch for itself. |
| #34 | Accessibility Standards | Affirms: accessibility is per-client; both clients must meet baseline; TS may exceed UE5 (uniquely permitted exception to §2.7). |
| #35 | PvP Design & Chaos Shard Rules | Affirms: PvP arbitration is Rust-side; UE5 GAS again forbidden. |
| #36 | Procedural Quest Skeletons | Affirms: quest gen runs in Rust; both clients render the same quest log. |
| #37 | Voice Chat | **Binding:** LiveKit SFU; Rust signals; both clients consume LiveKit SDK; Doc #37 also holds Discord-interop spec referenced from §6. |
| #38 | Data Export & GDPR Portability | Affirms: export is Rust-resident; Discord data is **not** in the GDPR perimeter (§6). |
| #39 | Console Certification | **Binding:** UE5 carries cert; TS never console; save-write is UE5 platform API. |
| #40 | Implementation Scaffolding & 12-Week Plan | **Refines:** client section split into Client A (UE5) + Client B (TS web); server unchanged. Phasing in §7 binds to Doc #40 weekly schedule. |

§34 (accessibility) carries the only inversion of the §2.7 "TS subset" rule: where a screen-reader or motor-accessibility feature is genuinely easier to ship in browser first (because the web platform exposes ARIA and reduced-motion APIs natively), the TS client may pioneer the feature *provided* the UE5 client commits to the same feature within one minor release. This is the only such carve-out and is documented here so it is not invented later.

### 8.1 Reading order for new contributors

A new engineer joining the project should read these documents in roughly the following order to internalise the architecture:

1. Doc #1 (Vision) — what we are building and why.
2. Doc #2 (GDD) — the gameplay shape.
3. **Doc #41 (this ADR)** — the engineering boundary.
4. Doc #40 (Implementation Scaffolding) — the 12-week schedule and repo layout.
5. Doc #22 (Network Protocol) — the wire.
6. Doc #21 (Save Format) — persistence.
7. Doc #13 (Core Schema) — the entity / verb / scope model.
8. Sub-system docs (#16 Combat, #17 Dialogue, #19 Quest, #23 Pathfinding, etc.) on demand.

Reading this ADR before Doc #40 means the engineer sees the boundary first and the schedule second; that ordering reduces the chance of missing the boundary while internalising the schedule.

---

## 9. Decision Governance

This ADR is enforceable only if its enforcement mechanism is concrete. Three mechanisms apply.

### 9.1 Boundary declaration before code

Every new feature, before any code is written, must declare in its design doc (or PR description, if it has no design doc) **which side of the §3 boundary it lives on.** The declaration takes the form:

> **Owner:** Rust authoritative / UE5 client / TS client / Third-party service: [name].
> **§3 row this maps to:** [number, or "new — see §9.2"].
> **Cross-client behaviour:** [per-client / shared via wire / N/A].

PRs without this declaration fail design review.

### 9.2 New rows require ADR amendment

The §3 table is closed. Adding a new row, splitting an existing row, or moving a row to a different owner all require an **ADR amendment** logged in §11. Amendments are PRs against this document, reviewed by Engineering Lead and Technical Director, and merged before the implementing code can land.

### 9.3 The "TS web client never adds features" rule is non-negotiable

§2.7 is the most common violation surface, because TS iteration is fast and adding "just one quick thing" to the web client feels harmless. It is not. A TS-exclusive feature creates a permanent feature-disparity between the canonical client and the prototype client, and the prototype's job is to be a *subset*, not a *peer*.

Violations of §2.7 are **release-blockers.** A web client that ships a feature absent from the UE5 client cannot ship until either (a) the UE5 client implements the feature, or (b) the feature is removed from the web client. CI carries a `WEB_CLIENT_PARITY` check that scans for verbs unique to the TS bundle; the check is gating, not advisory.

The §8 accessibility carve-out is the only exception, and it carries a UE5-side commitment per §8.

### 9.4 Periodic ADR review

This ADR is reviewed at the end of each phase (Phase 1 = post-W12, Phase 2 = post-cert, Phase 3 = post-launch). Review outputs are either (a) "no change," logged in §11 with a reaffirmation entry, or (b) an amendment PR. The review's job is to test whether the boundary still matches the workload — for example, if Phase 2 reveals that a piece of state the §3 table assigns to Rust would be radically simpler if owned by UE5, that is a legitimate amendment. The review's job is **not** to relitigate §2's core decisions; those are settled.

### 9.5 Anti-pattern catalogue

The following anti-patterns are explicit ADR violations and must be flagged in code review:

- A second wire path (e.g., a UE5 RPC for "just this one feature").
- Game state held only on a client (e.g., a UE5 actor whose health is not also in the Rust server's ECS).
- A TS-only verb (e.g., a debug command that exists in the TS client but not in UE5).
- An in-house implementation of a §6 service (e.g., writing a Rust SFU because LiveKit "isn't quite right").
- Mixing cinematic and in-world cutscene primitives (§3.9).
- Adding a Discord-required path (e.g., "you must link Discord to use the guild feature"). Discord is augmentation, never gating.
- A UE5 Blueprint that mutates game state outside its own UI scope.
- A Rust crate that takes on a render, mix, or physics responsibility (§5).

### 9.6 Escalation path

When a design or PR review surfaces a possible ADR violation, the path is:

1. The reviewer flags the specific section number violated.
2. The PR author either (a) reworks the change to comply, or (b) opens an ADR-amendment PR per §11.2 and pauses the original PR until the amendment is decided.
3. If the author and reviewer disagree on whether a violation exists, escalate to Engineering Lead. If they remain in disagreement, escalate to Technical Director. The escalation chain stops there; the Technical Director's call is final and is logged in §11.

### 9.7 What this ADR does not govern

To prevent the ADR from being mis-cited as authority over things it does not actually decide:

- **Specific Rust crate boundaries.** Doc #40 §2 owns the workspace layout.
- **Specific Protobuf message shapes.** Doc #22 owns the wire schema.
- **Specific UE5 plugin choices** (which voice plugin, which networking plugin). Engineering can pick freely as long as the §4 forbidden list is respected.
- **Asset format choices** (Doc #31 sprite pipeline, Doc #10 audio formats).
- **Database schema** (Doc #21 owns DDL).
- **Gameplay tuning, balance, and rules.** Design owns these via Docs #2, #4, #16, #18.

Where ambiguity exists between this ADR and another doc on a question this ADR explicitly disclaims, the other doc wins.

---

## 10. Open Questions

Numbered for cross-document reference.

**#41-OQ-1: Protobuf vs FlatBuffers final pick.** Default: Protobuf (mature ecosystem, three-target codegen, well-supported in Rust via `prost` and TS via `protoc-gen-ts`). FlatBuffers offers zero-copy decoding which matters for high-frequency tick streams; we have not yet measured whether decode cost is a real bottleneck. Resolve before W5 protocol freeze. Resolution deliverable: a decode-cost benchmark in the W3 perf-harness measuring `proto3` decode at 60 Hz on a representative tick payload, on both UE5 (release build) and TS (Chrome/Safari). If decode exceeds 0.5 ms in either client, FlatBuffers is reconsidered.

**#41-OQ-2: TS web client lifetime — Phase 1 throwaway, or permanent product surface?** Doc #40 originally treated the TS client as the production web target. This ADR treats it as a permanent web-thin-client. The question is whether "permanent" means *forever supported at parity-minus* or *eventually deprecated once UE5 ships browser/WASM builds.* Pick by Phase 2 entry.

> **RESOLVED 2026-05-04**: Web client is a permanent product surface. Hiring, CI, QA, security, accessibility, and localization investment is on the same tier as the UE5 client. The "feature-flagged subset" policy stands — web may omit features but never adds them.

**#41-OQ-3: LiveKit self-hosted vs managed.** Self-hosted gives us full data control (matters for EU deployment per Doc #38) but adds infra burden; managed gives us turnkey scaling at higher per-minute cost. Resolve before voice-chat feature work in Phase 2.

**#41-OQ-4: Codegen toolchain — `prost` + `protoc-gen-ts`, or `buf` for everything?** `buf` offers a unified BSR-style schema registry and a single CLI for all three targets; `prost` + `protoc-gen-ts` is more conventional but means three CLIs and three configs. Resolve in W1.

**#41-OQ-5: Player-movement prediction — write twice (Rust + UE5/TS) or codegen from a single source?** Mirroring the server's movement step in two clients is a known divergence risk (§3.1). Options: (a) hand-write in all three languages and gate via golden tests; (b) write once in a `.rs` file and transpile via `wasm-bindgen` to TS and `cxx` to C++; (c) write the rule in a small DSL and codegen all three. Resolve before player-movement landing in W4. The leading approach at the time of this ADR is (b) — compile the Rust movement step to WASM for the web client and to a static library callable from UE5 via FFI — because it satisfies the line-for-line invariant with one source of truth, and WASM execution overhead in browser is negligible for this hot path. Approach (a) is the fallback if FFI integration on consoles becomes problematic during cert.

**#41-OQ-6: Mobile companion app — third client?** A mobile companion (iOS/Android) for guild chat, marketplace browsing, character viewing without combat would not contradict this ADR (it would be a fourth surface, with the same subset rule as the TS client). The question is whether to commit before Phase 2. Default: *no*; revisit post-cert. If the answer becomes yes, the implementation candidate is React Native or Capacitor wrapping the existing TS client codebase, which keeps the protocol path identical and adds only platform shells. Native iOS/Android clients are explicitly rejected because the cost-to-reach ratio does not justify a third native codebase.

**#41-OQ-7: Discord interop scope — Rich Presence only, or full guild-bot suite?** §6 lists Rich Presence + OAuth link + guild bot as the target scope. Full guild-bot features (in-Discord trading, in-Discord chat-bridge to in-game zones) carry more moderation surface and may bleed into the Doc #38 GDPR perimeter. Default: Rich Presence + OAuth + read-only guild commands; full bridge is post-Phase-2.

### 10.1 How open questions are tracked

Each `#41-OQ-N` is referenced in the `OPEN_QUESTIONS.md` rollup at the repo root and carries a target resolution date. When resolved, the question is moved into §11 as a decision-log entry citing the resolution PR. Questions that remain open at the end of a phase trigger an explicit go/no-go review — a question that has been open for two consecutive phase boundaries is escalated to the Technical Director with a "decide or descope" prompt.

---

## 11. Decision Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-04 | Initial ADR. Resolves Doc #9 vs Doc #40 tension. Discord added to §6 third-party services as community-only layer. |
| 1.1 | 2026-05-04 | OQ-2 resolved: web client is permanent. TS/PixiJS surface receives long-term hiring, CI, QA, security, accessibility, and localization investment on the same tier as the UE5 client; "feature-flagged subset" policy unchanged. |

### 11.1 Reaffirmation rules

A "reaffirmation" entry is logged at each phase boundary even when no change is made. The absence of a phase-boundary entry is itself a flag — if a phase ends and this ADR has no new line, it means the periodic review (§9.4) was skipped, which is itself an issue.

### 11.2 What forces an amendment, vs. what fits within v1.0

An amendment is required when:

- A new §3 row is needed (a system not yet in the table).
- A row's owner changes.
- An item moves between the §4 forbidden list and the permitted set, in either direction.
- A §6 service is added, removed, or has its scope materially changed.
- A §10 open question's resolution contradicts a v1.0 statement.

An amendment is **not** required when:

- A toolchain pick within an open question is finalised consistently with the default (e.g., choosing `prost` over `buf` per #41-OQ-4).
- A §3 row's *implementation details* change while the owner and rule stay the same.
- A new third-party service is added in a category the §6 table already covers (e.g., switching CDN provider from CloudFront to Bunny).

This distinction matters because amendments are a meaningful coordination cost; we don't want to discourage normal engineering iteration by treating every micro-decision as an ADR change.

### 11.3 Amendment template

Amendment PRs against this document follow a fixed template:

> **Version:** [increment from previous]
> **Date:** [ISO date]
> **Section(s) affected:** [§ numbers]
> **Change summary:** [one paragraph, max five sentences]
> **Justification:** [the workload or constraint that forced the change]
> **Migration impact:** [what existing code must change]
> **Reviewers:** Engineering Lead, Technical Director (mandatory).

This format is enforced by the PR-template in `.github/PULL_REQUEST_TEMPLATE/adr-amendment.md`.

---

*End of Doc #41.*
