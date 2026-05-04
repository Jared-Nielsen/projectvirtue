Document #22: Network Protocol & Replication
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Network & Live Ops Engineering Lead]
Status: Living Technical Reference — Normative spec for the wire protocol, entity replication, region partitioning, region handoff, lag compensation, and anti-cheat surface for persistent-shard play

Depends on: #6 Persistent World §2 §3 §4 §5, #9 Tooling (UE5 chosen), #11 Phase 1 Vertical Slice, #13 Core Schema (Entity, Verb, Scope) §1 `[I*]` markers, §4 dispatch invariant, #14 MCP Server Surface §2 §3 §4, #15 Character, Party & Inventory, #16 Combat & Magic §10 multiplayer-pause resolution, §4 AI tick rate, #17 Dialogue & NPC Schedule §5 per-player session instancing, §7 schedule cadence, #18 Economy, Crafting & Trade §9 trade-session two-phase commit, #21 Save Format & Shard DB Schema (Postgres + Redis target; SQLite Phase 1).

---

## 1. Networking Philosophy

Britannia Reborn runs an **authoritative server model** (Doc #6 §2). Clients send `VerbInvocation` messages; the server runs all simulation, scoring, persistence, and replication; clients render replicated `[I*]` state and perform local prediction only on Avatar movement. This matches UE5's built-in dedicated-server replication model and preserves the single-ingress invariant from Doc #13 §4 and the five non-bypassable invariants from Doc #14 §4 across the wire — every wire-side `VerbInvocation` lands on the same `VerbDispatcher` as a mouse click. Pause-on-inventory and pause-on-spellbook are single-player and private-instance only (Doc #16 §10); on persistent shards the shared simulation never pauses for any one client.

---

## 2. Topology

```
                                +-------------------------+
                                |  Edge Load Balancer     |   (per geographic region; TLS termination)
                                |  + Auth/Session gateway |
                                +-----------+-------------+
                                            |
              +-----------------+-----------+-----------+-----------------+
              v                 v                       v                 v
       +-------------+   +-------------+         +-------------+   +-------------+
       | Region GS   |   | Region GS   |   ...   | Region GS   |   | Region GS   |
       |  britain.0  |   |  britain.1  |         |   trinsic   |   |  yew, etc.  |
       |  (UE5 ded.) |   |  (UE5 ded.) |         |  (UE5 ded.) |   |  (UE5 ded.) |
       |  + MCP Sub  |   |  + MCP Sub  |         |  + MCP Sub  |   |  + MCP Sub  |
       +------+------+   +------+------+         +------+------+   +------+------+
              \                 |                       |                 /
               \                v                       v                /
                \         +---------------------------------------+     /
                 +------> |  Cross-region Message Bus             | <--+
                          |  (NATS or Redis pub/sub)              |
                          |  - region handoff packets             |
                          |  - global chat / Virtue Watch events  |
                          |  - shard-wide story events (Doc #6 §6)|
                          +-------------------+-------------------+
                                              |
                                              v
                          +---------------------------------------+
                          |  Persistence Tier (Doc #21)           |
                          |  - PostgreSQL primary + read replicas |
                          |  - Redis cluster (hot state, sessions)|
                          +---------------------------------------+
```

| Layer | Tech | Process Model | Notes |
|---|---|---|---|
| Edge gateway | NGINX or Envoy + auth service | One per geo region | TLS terminate, route by `shard_id`/`region_id`, rate-limit pre-shard |
| Game server (region) | UE5 dedicated-server binary | One process per shard region; horizontally scaled with parallel instances per popular region | Owns simulation, dispatcher, MCP Subsystem (Doc #14 §2) |
| Cross-region bus | NATS preferred; Redis pub/sub fallback | Cluster | Region handoff, global chat, Virtue Watch alerts |
| Persistence | PostgreSQL + Redis (Doc #21) | DB cluster | Phase 1: SQLite, no Redis (Doc #21 Phase 1 scope) |
| MCP transport | stdio (in-proc) or SSE/HTTP via edge | Same UE5 process as game server (Doc #14 §2) | Verbs flow through same dispatcher as in-engine input |

The MCP server is a UE Subsystem co-resident with the game server (Doc #14 §2). It does **not** run on a separate process; remote MCP clients reach it through the same edge gateway by SSE/HTTP, then the Subsystem submits to `PlayerInputDispatcher` exactly as a local `stdio` client would.

---

## 3. Tick Rates

| Loop | Rate | Source | Notes |
|---|---|---|---|
| Server simulation | 20 Hz (50 ms) | [BR] | Real-time combat fidelity floor; `attack` resolution lands on a sim tick |
| Client render | 60+ Hz | UE5 default | Client interpolates between received state snapshots |
| Network state broadcast | 10 Hz | [BR] | Delta updates per region; aggregates 2 sim ticks |
| Schedule system tick | 1 Hz | Doc #17 §7 | NPC schedule slot transitions, status-effect timers (Doc #16 §7) |
| Combat AI tick | 2 Hz (500 ms) | Doc #16 §4 | `CompanionAI.tick`, `HostileAI` state machine (Doc #16 §9) |
| Heartbeat | 0.2 Hz (5 s) | [BR] | Client → server keepalive; 3 missed → soft disconnect (§11) |

`ServerTick` is a monotonic `u64` counter incremented at 20 Hz and embedded in every `VerbResult.applied_at` (Doc #14 §5 envelope) and every `EntityDelta`. Clients use it to order out-of-order packets and reconcile prediction.

---

## 4. Message Protocol

### 4.1 Wire Format & Transport

- **Encoding:** MessagePack at Phase 1 prototype (cheap, schema-evolvable, native UE5 plugin available). FlatBuffers and Cap'n Proto are alternatives pending a perf bake-off (§16 [OPEN]).
- **Transport:** UE5 Networking layer over a single TCP connection per client at Phase 1 (reliable). Phase 2 promotes to UDP for unreliable game-state channel + reliable channel for verb invocations and trade/dialogue.
- **Channels:**
  - `verb` (reliable, ordered) — every `ClientMessage::VerbInvocation` and every `ServerMessage::VerbResult`.
  - `state` (unreliable, sequenced) — `EntityDelta`, `ServerTick`. Loss tolerated; sequencing drops stale snapshots.
  - `event` (reliable, unordered) — `EntitySpawn`, `EntityDespawn`, `RegionHandoff`, `DialogueUpdate`, `Error`, trade and dialogue lifecycle.
  - `chat` (reliable, ordered, separate per channel) — local/global chat traffic; not in this doc's schema, see Doc #6 §4.

### 4.2 ClientMessage

```ts
type ClientMessage =
  | { kind: "VerbInvocation",  invocation_id: UUID, caller: Caller, verb: VerbId, params: Record<string, any> }
  | { kind: "Subscribe",       region_id: RegionId }
  | { kind: "Unsubscribe",     region_id: RegionId }
  | { kind: "Heartbeat",       client_tick: u64 }
  | { kind: "DialogueInput",   dialogue_session_id: string, keyword: Keyword }       // routed to per-player session, Doc #17 §5
  | { kind: "TradeAction",     trade_session_id: string, action: "accept" | "reject" | "update_offer", offer?: TradeOffer }   // Doc #18 §9
  | { kind: "MovementInput",   region_id: RegionId, target: Vec3, mode: "walk" | "run", client_tick: u64 }   // path request; client predicts locally
  | { kind: "Auth",            token: string, shard_id: ShardId, avatar_id: AvatarId }
```

Notes:
- `caller` is always derived server-side from the authenticated session (`{kind: "Player", id}`) — the field on the wire is for symmetry with Doc #13 §4 and is overwritten by the server before dispatch. A client claiming `caller={kind: "MCP", ...}` is rejected with `ERR_CAPABILITY` (Doc #14 §4).
- `invocation_id` is a UUIDv4 idempotency key; matches Doc #14 §5 `client_op_id`.
- `Subscribe` / `Unsubscribe` adjust the client's region interest set; only `region == session.shard_id`'s regions accepted (Doc #14 §4 invariant 4).

### 4.3 ServerMessage

```ts
type ServerMessage =
  | { kind: "VerbResult",      invocation_id: UUID, result: VerbResult, side_effects: SideEffectSummary }
  | { kind: "EntityDelta",     region_id: RegionId, server_tick: u64, entities: EntityPatch[] }
  | { kind: "EntitySpawn",     region_id: RegionId, entity: EntitySnapshot }
  | { kind: "EntityDespawn",   region_id: RegionId, entity_id: EntityId, reason: "destroyed" | "out_of_relevance" | "region_change" }
  | { kind: "DialogueUpdate",  session_id: string, response: Response, current_keywords: Keyword[], session_state: "open" | "closed" }
  | { kind: "TradeUpdate",     session_id: string, trade: TradeSession, phase: "opened" | "offer_changed" | "confirmed" | "committed" | "cancelled" }
  | { kind: "RegionHandoff",   from_region: RegionId, to_region: RegionId, transition: HandoffTicket }
  | { kind: "ServerTick",      tick: u64, time_of_day: TimeOfDay }
  | { kind: "Error",           code: ErrorCode, message: string, invocation_id?: UUID }

type EntityPatch = {
  entity_id: EntityId
  components: Partial<{
    Physical: Partial<PhysicalComponent>     // only [I*] fields, only changed
    State:    Partial<StateComponent>
    Ownership: Partial<OwnershipComponent>
    Container: Partial<ContainerComponent>
    Combat:   Partial<CombatComponent>       // stance, hp, faction, hostile_to per Doc #13 §1.8 + Doc #16 §3.2
    Schedule: { current_slot_idx?: int }     // only the [I*] field
  }>
}

type SideEffectSummary = {
  virtue_deltas?:   Partial<Record<Virtue, int>>      // only echoed to the acting Avatar
  spawned_ids?:     EntityId[]
  despawned_ids?:   EntityId[]
  scope_writes?:    PersistenceScope[]                // for telemetry / debug builds
}
```

### 4.4 Dispatch Path Across the Wire

```
client                          edge                       region GS                        dispatcher
  |  ClientMessage::Verb        |                             |                                 |
  | --------------------------> | TLS, auth, shard route      |                                 |
  |                             | --------------------------> | rebuild caller from session     |
  |                             |                             | --------- VerbInvocation -----> | (Doc #13 §4)
  |                             |                             |                                 | validate / preconditions
  |                             |                             |                                 | resolve_effects
  |                             |                             |                                 | score_virtues (Doc #5)
  |                             |                             |                                 | apply_writes (scoped, Doc #21)
  |                             |                             | <-------- VerbResult ---------- | replicate to region peers
  |                             | <-------------------------- | (broadcast EntityDelta to subs) |
  |  ServerMessage::VerbResult  |                             |                                 |
  | <-------------------------- |                             |                                 |
```

The dispatcher is the single ingress (Doc #14 §4 invariant 1). MCP, mouse click, gamepad, and remote network client are all indistinguishable downstream of `PlayerInputDispatcher.Submit`.

---

## 5. Entity Replication

### 5.1 Relevance Model

Each `Entity` carries a replication-relevance tag derived from its components and instance:

```ts
type ReplicationRelevance =
  | "Always"      // shard-wide; e.g. global story event entities
  | "Region"      // visible to all clients subscribed to entity.Physical.region (default for world entities)
  | "OwnerOnly"   // only the owning player's client; e.g. private letter contents, journal pages
  | "Friends"     // owner + entries on friends-list (used for instanced housing, §15)
  | "Never"       // server-only; e.g. NPC inner schedule notes (Doc #14 §6 redacted resources)
```

Default by archetype: world items → `Region`; player journal / virtue readout pages → `OwnerOnly`; instanced housing entities → `Friends` (resolution of Doc #13 §5 [OPEN] item 11, see §15); shard-global story entities → `Always`.

### 5.2 Field Selection (Doc #13 §1 `[I*]` Markers)

Only fields tagged `[I*]` in Doc #13 are replicated. `[A]` archetype fields are loaded by archetype id at client startup and never traverse the per-tick state channel. `[I]` (per-instance, non-replicated) fields stay server-side and are read only via dispatcher tools (e.g. `examine` returns a derived view).

| Component | Replicated `[I*]` fields | Source |
|---|---|---|
| Physical | `position`, `velocity`, `region`, `containedBy` | Doc #13 §1.1 |
| State | `on_fire`, `poisoned`, `wet`, `locked`, `open`, `lit`, `broken`, `hp`, `durability`, `decay_timer` plus `paralyzed`, `invisible`, `charmed`, `sleeping`, `bleeding` (Doc #16 §7 extension) | Doc #13 §1.2 + Doc #16 §7 |
| Ownership | `owner` | Doc #13 §1.3 |
| Container | `contents` | Doc #13 §1.4 |
| Combat | `faction`, `hostile_to`, `stance` | Doc #13 §1.8 + Doc #16 §3.2 |
| Schedule | `current_slot_idx` | Doc #13 §1.5 |
| Magic | `enchantments` (visible only) — `[OPEN]` whether enchantment specifics are owner-redacted | Doc #13 §1.9 |

### 5.3 Delta Compression

- Per replication tick (10 Hz), each region GS computes the diff for every entity in the region's interest set against the last snapshot acked by each client.
- Only changed `[I*]` fields are emitted as `EntityPatch.components`. Unchanged fields are absent from the patch (sparse map).
- Entities that did not change in the tick contribute zero bytes.
- New entities entering relevance emit a single `EntitySpawn` (full `[I*]` snapshot) followed by deltas thereafter.
- Entities leaving relevance emit `EntityDespawn { reason: "out_of_relevance" }`.

### 5.4 Position-Update Rate Limit

For moving entities (`Physical.velocity` non-zero), position broadcasts are rate-limited to **5 Hz per moving entity per client**. Between position broadcasts the client interpolates linearly using `velocity`. A position-snap (teleport, knockback > 4 tiles) bypasses rate-limit and is force-broadcast on the next 10 Hz tick.

### 5.5 Bandwidth Budget

| Direction | Steady-state target | Burst ceiling | Phase |
|---|---|---|---|
| Server → client (per client per region) | **10 KB/s** | 50 KB/s during combat or Britain market square crowd | All phases |
| Client → server (per client) | 1 KB/s | 5 KB/s during rapid verb fire | All phases |
| Region GS aggregate egress (200 players) | ~2 MB/s | 10 MB/s | Per region process |

Exceeding 50 KB/s sustained for 10 s triggers server-side LOD: position broadcasts drop to 2 Hz for distant entities (>20 tiles from the client's Avatar), and `EntityDelta` switches to coarser aggregation (group ticks of 5 Hz instead of 10 Hz). Server-side LOD policy for >50-player tile crowds is `[OPEN]` (§16).

---

## 6. Region Partitioning

- Each region (`britain`, `trinsic`, `yew`, `minoc`, `moonglow`, `skara_brae`, `jhelom`, `magincia`, `serpent_hold`, `cove`, plus wilderness tiles) is a **separate game-server process**.
- A client subscribes only to its current region; clients in region X receive `EntityDelta`/`EntitySpawn`/`EntityDespawn` only for region X (Doc #6 §2 spatial partitioning, Doc #14 §6 spatial constraint).
- **Cross-region traffic** (global chat, Virtue Watch events per Doc #6 §5, shard-wide story events per Doc #6 §6) flows through the message bus, not via direct region-to-region sockets.
- **Region capacity:** soft cap 200 concurrent players per region process. Britain (and any other heavily-trafficked region) may run multiple parallel instances (`britain.0`, `britain.1`, ...) behind a regional load balancer; players are placed by least-loaded with friend-group affinity.
- **Sharding key for the bus:** `shard_id + region_id` for region-scoped events; `shard_id` for shard-global events.

---

## 7. Region Handoff

A player walks across a region boundary. The handoff is server-initiated, two-phase committed, atomic from the player's perspective.

```
step 1   source GS detects Avatar.Physical.position crosses region boundary tile
step 2   source GS issues HandoffTicket on the bus, addressed to target GS
step 3   target GS pre-allocates Avatar slot, returns HandoffAck with conn_info
step 4   source GS sends ServerMessage::RegionHandoff { from, to, transition: HandoffTicket } to client
step 5   client opens TLS connection to target GS using HandoffTicket.conn_info
         (target conn pre-warmed at edge: no full TLS handshake required)
step 6   client sends ClientMessage::Auth { token = HandoffTicket.bearer, ... } on new conn
step 7   target GS materializes Avatar Entity from HandoffPacket payload
step 8   target GS sends initial EntitySpawn for Avatar + party + inventory to client
step 9   source GS receives "materialize_ok" on the bus, despawns Avatar locally,
         issues EntityDespawn { reason: "region_change" } to remaining source-region peers
step 10  client switches subscription; old conn closed by source GS after a 2s grace
```

```ts
type HandoffTicket = {
  ticket_id:     UUID
  shard_id:      ShardId
  avatar_id:     AvatarId
  from_region:   RegionId
  to_region:     RegionId
  conn_info:     { host: string, port: int, sni: string }
  bearer:        string                    // short-lived signed token, 30 s TTL
  packet_ref:    string                    // bus key for the HandoffPacket payload
}

type HandoffPacket = {
  ticket_id:     UUID
  avatar_state:  EntitySnapshot            // full Avatar Entity, all components
  party:         EntitySnapshot[]          // companions accompanying the player
  inventory:     EntitySnapshot[]          // contents (recursive nested containers)
  active_states: { dialogue?: DialogueSession[], trade?: TradeSession[] }
                                           // dialogue/trade in progress are normally cancelled before handoff;
                                           // active_states is a backstop for edge cases
  spawn_at:      Vec3                      // position in target region
  facing:        Vec3
}
```

### 7.1 Atomicity (2-Phase Commit)

- **Phase 1 (prepare):** source GS marks the Avatar `Migrating`, freezes its dispatcher writes (only `move`/`despawn` allowed), pushes `HandoffPacket` to bus, awaits `HandoffAck` from target GS.
- **Phase 2 (commit):** on receipt of target's `materialize_ok`, source despawns and persists Avatar departure under `WorldState` scope. If target reports `materialize_fail` or the bus times out (5 s), source rolls back: Avatar `Migrating` lifted, client receives `Error { code: ERR_HANDOFF_FAILED }`, Avatar resumes in source region.
- Persistence write is single-transactional: either the avatar exists in the target region's authoritative state, or it remains in the source. Never both (`[I*]` `Physical.region` is the source of truth).

### 7.2 Latency Budget

- End-to-end perceived delay (player input freeze → controllable in target): **< 500 ms**.
- Phase-1 round-trip on bus: target ≤ 100 ms.
- Connection warm-up (target conn pre-opened by edge): ≤ 50 ms.
- Initial snapshot to client: ≤ 100 ms (Avatar + party + inventory only; remaining region entities streamed in over next 1–2 s).

---

## 8. Lag Compensation

| Verb class | Strategy | Rationale |
|---|---|---|
| Avatar movement | Client-side prediction. Client extrapolates from local input; server reconciles every `MovementInput` vs. authoritative path. Mismatch > 0.5 tiles → server forces snap; client visibly corrects. | Standard UE5 character-movement-component pattern |
| All other verbs | Server-authoritative; client shows "pending" state until `VerbResult` arrives | Preserves Doc #13 §4 invariant |
| Combat (`attack`, `cast_spell`, `throw`) | Server-authoritative on hit detection. **No client-side hit prediction.** | Anti-cheat; matches BG/SI engine-deterministic outcome model `[BG]` |
| Dialogue (`talk`, `say_keyword`) | Pure server-authoritative; latency is acceptable for keyword UI | Doc #17 §5 |
| Trade (`accept_trade`, etc.) | Pure server-authoritative; two-phase commit unaffected | Doc #18 §9 |

**Pending-state rendering:** when a client emits a `VerbInvocation`, the client UI shows the verb as in-flight (greyed cursor, queued action indicator). On `VerbResult { ok: true }` the result animates. On `VerbResult { ok: false }` or `Error`, the UI rolls back any local optimistic visual and surfaces the error code per Doc #14 §5 (`ERR_VIRTUE_REJECTED`, `ERR_OUT_OF_RANGE`, etc.).

**Dispatcher rate budget:** verb invocations are rate-limited at the dispatcher per Doc #14 §3 ("identical to per-player input rate limits used for mouse/keyboard"). Network arrival does not bypass that limit; bursts beyond budget return `ERR_RATE_LIMIT`.

---

## 9. Anti-Cheat Surface

The dispatcher is the only enforcement point. Every `VerbInvocation` is validated server-side:

| Check | Verb classes | Source |
|---|---|---|
| Range check (Euclidean distance actor → target) | All verbs with LOS req in Doc #13 §2 | Doc #13 §2, Doc #16 §2 |
| LOS raycast | `attack`, `cast_spell`, `throw`, ranged `examine` | Doc #16 §2 |
| Capability set match | All MCP-originated verbs | Doc #14 §3 |
| Ownership precondition | `drag`, `steal`, `combine`, `donate` | Doc #13 §2 |
| Mana / reagent presence | `cast_spell` | Doc #16 §2.2 |
| Persistence-scope match | All mutating verbs | Doc #14 §4 invariant 3 |
| Shard binding | All verbs | Doc #14 §4 invariant 4 |

**Forbidden client behaviors and their server response:**

- Client fabricates a `VerbResult` → impossible: the wire schema is one-way. `ServerMessage::VerbResult` is server-emitted only.
- Client claims a different `caller` (e.g. `MCP` privileged tool) → server rebuilds `caller` from the authenticated session; the wire field is overwritten before dispatch.
- Client subscribes to a region not in its shard → `ERR_SHARD_BINDING`.
- Client subscribes to a region in its shard but where its Avatar is not present → permitted only with `inspect.read` capability MCP session; ordinary player sessions reject as `ERR_CAPABILITY`.
- Client requests `EntityDelta` for entities outside its current region → silently filtered; the broadcast channel only fans out region-relevant entities. There is no client-pull mechanism for arbitrary entity reads outside the MCP `entity_by_id` resource (Doc #14 §6), which itself enforces shard binding.

**MCP-driven Avatars are subject to the same rate limits as human-driven Avatars** (Doc #14 §3) — no advantage. An LLM agent firing `attack` at 100 Hz is throttled to the same per-tick verb budget as a player mashing the mouse.

**Suspicious-pattern flags (forwarded to Virtue Watch queue, Doc #6 §5):**

| Pattern | Detector |
|---|---|
| Verb invocation rate > N per second sustained | Per-session token bucket; threshold tunable, default 10/s |
| Teleport-without-spell (position delta > 5 tiles in one tick without `cast_spell` of teleport class) | Position delta sentinel on movement reconciliation |
| Infinite reagents / gold (consumption + spawn ratio anomaly) | Economy ledger (Doc #18 §8) cross-check |
| `ERR_VIRTUE_REJECTED` rate > N over 60 s | Indicates probing for shard-rule edges |
| Repeated `ERR_OUT_OF_RANGE` from impossible coordinates | Movement integrity check |

Phase 1 does not implement anti-cheat hardening (§14); Phase 2 is the priority pass.

---

## 10. Per-Player-Instanced Flows

These flows run on the server but emit messages only to the relevant clients. They are **not** broadcast on the region channel.

| Flow | Channels | Recipients | Source |
|---|---|---|---|
| Dialogue session (`DialogueOpened`, `DialogueUpdate`, `DialogueClosed`) | `event` reliable | Talking player only | Doc #17 §5: per-player session instancing; two Avatars may simultaneously dialogue with the same NPC and neither sees the other's surface |
| Trade session (`TradeUpdate`) | `event` reliable | The two trading players only | Doc #18 §9 |
| Player journal updates | `event` reliable | Owner only | `OwnerOnly` relevance |
| Personal Virtue readout (Avatar Score, current 8 virtues) | `event` reliable | Owner only (public title is `Region`-replicated separately) | Doc #14 §6, Doc #15 §7.3 |
| Cutscenes (`TriggerCutscene` from Doc #17 §2) | `event` reliable | The triggering player only on persistent shards; full simulation pause only in single-player or private instance | Doc #17 §5 |
| Quest objective updates | `event` reliable | Player(s) on the quest | `OwnerOnly` or party-restricted |

These messages share `region_id` with the player but bypass the region's broadcast channel.

---

## 11. Connection Lifecycle

### 11.1 Connect

```
1. Client opens TLS to edge gateway
2. Client sends ClientMessage::Auth { token, shard_id, avatar_id }
3. Edge validates token (auth service), routes to the region GS hosting avatar's last known region
4. Region GS materializes Avatar (loads from Postgres if cold, Redis if warm — Doc #21)
5. GS sends initial region snapshot:
     a. ServerTick (current tick, time of day)
     b. EntitySpawn for Avatar
     c. Bulk EntitySpawn batch for all Region-relevance entities currently in interest set
     d. EntitySpawn for any OwnerOnly entities (journal, virtue readout)
6. GS sends "ready" sentinel; client transitions to active play
```

### 11.2 Disconnect (Soft)

- On TCP/TLS drop, GS holds the Avatar Entity in-region for **30 s** (the "soft disconnect" window).
- During that window:
  - Companions hold position (do not despawn or wander; AI ticks freeze for the absent player's party).
  - Avatar remains attackable on persistent shards (Doc #16 §10) — disconnect is not invulnerability.
  - Other players still see the Avatar entity as `disconnected` overlay (rendered translucent or with an indicator).
- Reconnect within 30 s on the same shard/avatar: client sends `ClientMessage::Auth`; GS re-binds the connection to the existing Avatar with no respawn or load delay.
- After 30 s: Avatar despawned, persisted to Postgres (Doc #21), companions despawned to a "follow on next login" state. Subsequent reconnect is a fresh connect (§11.1).

### 11.3 Heartbeat

- Client sends `ClientMessage::Heartbeat { client_tick }` every 5 s.
- Server tracks last heartbeat per session; **3 missed heartbeats (15 s)** trigger soft-disconnect path (§11.2) without a TCP close — handles silent network failures.
- Server piggybacks `ServerMessage::ServerTick` at the same cadence (every 5 s on the wire to all clients, separately from per-tick state broadcasts).

### 11.4 Disconnect (Hard)

- Explicit logout (player command) or auth revocation: skip the 30-s soft window; persist and despawn immediately.
- Companions despawn to "follow on next login."

---

## 12. MCP Transport Over Network

- The MCP server is a UE Subsystem on the same game-server process as the dispatcher (Doc #14 §2). It does not run as a separate network service.
- **Local transport (Phase 1 + ongoing):** `stdio` for editor tools, CI harnesses, single-machine devloop. Unaffected by anything in this document.
- **Remote transport (Phase 2+):** SSE/HTTP terminated at the edge gateway, authenticated per session (Doc #14 §3). The gateway routes by `shard_id` to the appropriate region GS and forwards to the MCP Subsystem on that process.
- **Verb path:** an MCP `cast_spell` tool call becomes, internally, a `PlayerInputDispatcher.Submit` call with `caller={kind: "MCP", tool, session}` (Doc #13 §4 `Caller` enum). It is then a `VerbInvocation` to `VerbDispatcher` — the same path as a network-arriving `ClientMessage::VerbInvocation` from a player. Both flow through the same dispatcher. Both pay the same rate-limit toll.
- **MCP rate-limit interaction with bursting tooling clients** is `[OPEN]` (§16). A QA harness firing 1000 `examine` calls in 1 s for inventory-state scraping should not be throttled to player-rate; a separate `qa.harness` capability tier with elevated read budget may be required.

---

## 13. Server Scaling Targets

Matches Doc #6 §2 launch numbers.

| Target | Value | Notes |
|---|---|---|
| Concurrent players per shard at launch | 2,000 | Across all regions |
| Concurrent players per region process | 200 | Soft cap; spawn parallel instances above |
| Region processes per shard typical | ~10 | Britain with 5 instances; smaller towns 1; wilderness 1–2 |
| Scale-out trigger | Region instance utilization > 80% for 10 min | Spawn additional instance behind regional LB |
| Live-service ceiling (Doc #6 §2) | 10,000+ | Requires DB sharding and cross-shard moongates (Doc #6 §2) |

Database scaling: PostgreSQL primary + ≥2 read replicas for cold-load reads at login; Redis cluster for hot session state and short-rollback buffer (Doc #6 §3 30-s rollback).

---

## 14. Phase 1 Prototype Scope

Per Doc #11 vertical slice and Doc #14 §8, Doc #16 §12.

| Item | Phase 1 |
|---|---|
| Player count | 8 simultaneous in Britain |
| Regions | One: `britain` only |
| Server | UE5 dedicated server binary on a single machine, in-process; no real cluster |
| Region handoff | Not implemented (only one region exists) |
| Persistence | SQLite per Doc #21 Phase 1; no Redis |
| Replication | `Physical.position`, `Container.contents`, public `Ownership.owner`, public Virtue title (`Region` relevance) |
| Combat sync | **Deferred** — multiplayer combat disabled in Phase 1 (Doc #16 §12), so combat-state replication unwired |
| MCP | `stdio` only (Doc #14 §8); SSE deferred |
| Wire format | MessagePack |
| Transport | Reliable TCP (UE5 default); UDP split deferred to Phase 2 |
| Anti-cheat hardening | Deferred to Phase 2 priority |
| Bandwidth instrumentation | Yes — measure 10 KB/s steady-state per client claim |
| Heartbeat / soft disconnect | Yes |
| Region handoff plumbing | Stubbed (codepath present, never invoked) |

Phase 1 success metric (network-side): two players in Britain see each other's `Physical.position` updates at 5 Hz with smooth 60 fps client interpolation, observe a third player picking up a barrel and the `Container.contents` mutation replicates in < 200 ms, and reading a Virtue title on another player returns the correct value with `OwnerOnly` private fields invisible. Combat replication is out of scope.

---

## 15. Resolved Doc #13 [OPEN] Item 11 — Instanced Housing Replication

> Doc #13 §5 item 11: "Replication interest set for instanced housing. Private instances (Doc #6 §2) need an explicit rule for which dispatcher writes replicate to visiting friends vs. owner-only."

**Resolution:**

- An instanced housing region is its own private region with `region_id = "house.<owner_player_id>.<instance_idx>"`.
- All entities inside the instance default to replication relevance `Friends` (§5.1).
- The owner's `friends_list` (`PlayerId[]`, persisted under `PlayerInventory` scope or a sibling per `[OPEN]` for exact scope) is the authoritative visibility allow-list for the instance.
- Visiting friend → standard region subscription, full `Region`-equivalent state stream for entities inside the instance.
- Non-friend (any other player) → `ERR_CAPABILITY` on `Subscribe`; never receives any state for the instance, including spawn/despawn events.
- Owner can promote a guest mid-visit (adds to friends-list) — no immediate replication impact since the guest is already subscribed.
- Owner can revoke a friend's access — friend is forcibly unsubscribed at the next 10 Hz tick, receives `EntityDespawn` for all instance entities with reason `out_of_relevance`, and is teleported to the region the instance was entered from (handoff path §7).
- Instance entities that the owner explicitly marks "public" (e.g., a museum room display) flip to `Region` relevance scoped to the instance's region — visible to all subscribers, but the instance itself is still gated by friends-list. Public marking does NOT make non-friends able to enter; it only changes the relevance for those already inside.
- Ghost / out-of-body / dream-state visitors (Doc #5 cosmetic mechanics, `[OPEN]`) are not addressed here and remain `[OPEN]`.

This makes housing instances `Friends`-default with explicit per-entity overrides, which preserves the Doc #6 §2 "visited by friends or made public" model.

---

## 16. Open Questions

1. `[OPEN]` **NAT traversal for client peer-to-peer audio chat.** Voice chat between party members may be cheaper as P2P than relayed through the server. NAT traversal (STUN/TURN) and codec choice deferred. Server-relayed at Phase 1 if voice is in scope at all.
2. `[OPEN]` **Wire format choice: MessagePack vs FlatBuffers vs Cap'n Proto.** Phase 1 uses MessagePack for ergonomics; a perf bake-off (encode/decode CPU, payload size, schema-evolution friction) gates the Phase 2 pick.
3. `[OPEN]` **Soft-disconnect window per-shard configurable.** Default 30 s. Chaos shard may want shorter (no logoff-cheese in PvP); private instance may want longer (10-min tea-break tolerance for solo runs that brushed multiplayer). Authority for the override and its interaction with Avatar attackability `[OPEN]`.
4. `[OPEN]` **MCP rate limits vs. tooling-client bursts.** A QA harness scraping 1000 `examine` reads over a region for state diff is legitimate but exceeds player budget. Likely solution: a `qa.harness` or `inspect.bulk` capability tier with elevated read budget but zero mutation budget. Out of scope for Phase 1 since MCP is `stdio`-only.
5. `[OPEN]` **Server-side LOD policy for crowds.** When >50 players occupy a single tile (Britain market square at festival), what's the position-broadcast cadence floor for distant entities, and is it dynamic per region density? Suggested: drop to 1 Hz position broadcast for entities >30 tiles from the receiving client when region density exceeds threshold; needs measurement.
6. `[OPEN]` **`enchantments` field replication semantics.** §5.2 marks `MagicComponent.enchantments` replicated, but specific enchantments (a curse on an item) may be intended to remain hidden until the item is identified (Doc #4.1 alchemy/identify path). May need to split `enchantments_visible` vs. `enchantments_hidden` `[I*]`/`[I]`.
7. `[OPEN]` **Friends-list persistence scope for housing access.** §15 needs a definitive scope: `PlayerInventory` (per-owner) vs. a new `Social` scope. The friends-list also feeds Doc #6 §4 party invites and may be globally shared — affects cross-shard reachability.
8. `[OPEN]` **Ghost / observer mode** (whether an Avatar can be invisibly present in a region for spectator/streamer purposes) and its replication relevance treatment.

---

## 17. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #6 §2, Doc #9 (UE5 chosen), Doc #13 §4, Doc #14 §4, Doc #16 §10 |
| §2 Topology | Doc #6 §2, Doc #14 §2, Doc #21 (Postgres + Redis target) |
| §3 Tick Rates | Doc #16 §4 (combat AI 2 Hz), Doc #17 §7 (schedule 1 Hz) |
| §4 Message Protocol | Doc #13 §4 (dispatch contract), Doc #14 §5 (verb envelope), Doc #17 §11 (dialogue tools), Doc #18 §9 (trade) |
| §5 Replication | Doc #13 §1 (`[I*]` markers), Doc #16 §3.2 / §7 (Combat / State extensions) |
| §6 Region Partitioning | Doc #6 §2, Doc #14 §6 |
| §7 Region Handoff | Doc #6 §2 (cross-shard moongates analogue), Doc #21 (avatar persistence) |
| §8 Lag Compensation | Doc #16 §1 (engine-deterministic combat), Doc #14 §4 invariants |
| §9 Anti-Cheat | Doc #14 §3 §4 invariants, Doc #6 §5 Virtue Watch, Doc #18 §8 economy ledger |
| §10 Per-Player Flows | Doc #17 §5, Doc #18 §9 |
| §11 Connection Lifecycle | Doc #6 §3 (30-s rollback), Doc #21 (cold-load) |
| §12 MCP Transport | Doc #14 §2 §8 |
| §13 Scaling | Doc #6 §2 |
| §14 Phase 1 | Doc #11, Doc #14 §8, Doc #16 §12, Doc #21 Phase 1 |
| §15 Housing Replication | Doc #6 §2, Doc #13 §5 item 11 (resolved) |

### Resolved Doc #13 [OPEN] Items

- **§5 item 11 (replication interest set for instanced housing)** — fully resolved in §15: `Friends` default, owner-managed allow-list, non-friends never receive instance state, public entities scoped to instance only.

### MCP Surface Additions

None. This document does not add MCP tools or resources. It defines the **transport** by which existing MCP tools (Doc #14 §5) and Doc #16 §11 / Doc #17 §11 / Doc #18 §10 amendments traverse the network for remote MCP clients. Specifically:

- All existing MCP tool calls flow over SSE/HTTP at the edge gateway (Phase 2+) without changing the tool envelope (Doc #14 §5).
- The dispatcher path (`PlayerInputDispatcher.Submit` → `VerbDispatcher.dispatch`) is identical for in-process `stdio` MCP clients and remote SSE/HTTP MCP clients.
- The `qa.harness` / elevated bulk-read capability tier alluded to in §16 [OPEN] is a future MCP amendment and is **not** introduced by this document.

### New [OPEN] Items

Eight, listed in §16: P2P voice NAT traversal, wire-format bake-off, soft-disconnect-window per-shard authority, MCP bulk-read rate-limit tier, server-side crowd LOD policy, enchantment replication visibility split, friends-list persistence scope, and ghost/observer mode.

### Network Bandwidth Budget per Client

- **Server → client steady-state: 10 KB/s** (per client, in a populated region).
- Burst ceiling: 50 KB/s (combat or crowded market square).
- Client → server steady-state: 1 KB/s; burst 5 KB/s.
- Region GS aggregate egress at 200-player cap: ~2 MB/s steady; 10 MB/s burst.

---

End of Document #22.
