Document \#14: MCP Server Tool Surface
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: \[Tooling & Integration Lead\]
Status: Living Technical Contract – Defines the externally-callable surface for AI clients, tools, and scripted automation against a running shard

> **Updated 2026-05-04 per Doc #41.** The MCP server is implemented in Rust; both UE5 and TS clients consume MCP-driven world updates via the wire protocol (Protobuf), not by direct MCP calls. UE5 and TS clients are presentation-only consumers; they do not host MCP transports, MCP sessions, or the dispatcher.

Depends on: \#4 Simulation, \#5 Virtues, \#6 Persistent World, \#7 UGC, \#9 Tooling, \#13 Core Schema (Entity/Verb/Scope spec — drafted in parallel; this document treats its model as canonical), \#41 Engine & Stack ADR.

---

## 1. Purpose & Non-Goals

The Model Context Protocol (MCP) server exposes Britannia's simulation to external clients (LLM agents, devtools, QA harnesses, accessibility shims, future Avatar AI companions) via a finite, contract-bound tool and resource surface.

Purpose:

* Allow non-engine clients to inspect world state and submit player-equivalent actions.
* Drive QA, content authoring, and AI agent experiments without bypassing simulation rules.
* Provide a stable surface for the modding community parallel to the in-engine UGC editor (\#7).

Non-goals:

* Direct ECS mutation, direct Virtue writes, direct persistence writes, or direct replication injection. None of these are reachable from MCP.
* Cross-shard reads or writes within a single session.
* Admin / GM / moderation tooling — that surface is a separate, privileged channel and is out of scope for this document.

Design rule: An MCP-driven action must be indistinguishable, downstream of the dispatcher, from a mouse click by a seated player.

---

## 2. Architecture

The MCP server is implemented as a Rust process co-located with the authoritative Rust shard server (per Doc #41: bevy_ecs + Tokio). It is **not** a UE5 Subsystem and **not** an in-engine plugin. UE5 and TS clients never originate MCP calls; they receive resulting world deltas over the wire protocol (Protobuf in `/shared/proto`). MCP runs on the server; clients are consumers, not callers. It binds two transports:

* `stdio` — local development, single-process, used by editor tools and CI harnesses.
* `SSE / HTTP` — remote clients (LLM agents, web devtools), terminated at the shard's edge gateway, authenticated per session.

```
+----------------+   stdio / SSE    +-------------------+
|   MCP Client   | <--------------> |   MCP Server      |
| (LLM, devtool) |                  |  (Rust process,   |
+----------------+                  |  per Doc #41)     |
                                    +---------+---------+
                                              |
                                              v
                                    +-------------------+
                                    | PlayerInputDispatch|
                                    |  (single ingress) |
                                    +---------+---------+
                                              |
                                              v
                                    +-------------------+
                                    |   VerbDispatcher  |
                                    +---------+---------+
                                              |
                +-----------------+-----------+-----------+-----------------+
                v                 v                       v                 v
         +-------------+   +-------------+        +-------------+   +-------------+
         |  Virtue     |   | Persistence |        | Replication |   |  Simulation |
         |  Engine     |   | (scoped)    |        |  (region)   |   |  (ECS)      |
         +-------------+   +-------------+        +-------------+   +-------------+
```

Critical property: MCP has no edge into Simulation/ECS that does not first pass through `PlayerInputDispatcher` and then `VerbDispatcher`. The same dispatchers serve mouse, keyboard, gamepad, and MCP. Virtue scoring, persistence writes, and replication fan-out are downstream of the dispatcher, not of the input source.

| Layer | Process | Reachable from MCP? |
| ----- | ----- | ----- |
| Transport (stdio / SSE) | Rust process (Doc #41) | yes (tool/resource RPC) |
| Session & capability gate | Rust process (Doc #41) | yes (handshake only) |
| PlayerInputDispatcher | Game thread | indirect (one-way submit) |
| VerbDispatcher | Game thread | indirect |
| Virtue / Persistence / Replication | Game thread + DB | not reachable |
| ECS / Simulation | Game thread | not reachable |

---

## 3. Session Model

Every MCP session, at handshake, binds three immutable values:

```
SessionBinding {
  shard_id:     ShardId,        // e.g. "virtue-01"
  avatar_id:    AvatarId,       // the identity all verbs are submitted as
  capabilities: CapabilitySet   // see below
}
```

Bindings are immutable for the life of the session. A client wishing to act as a different Avatar, or on a different shard, must open a new session.

Capability sets (initial; extensible):

| Capability | Tools enabled | Resources enabled | Typical client |
| ----- | ----- | ----- | ----- |
| `inspect.read` | none | all `forge://` resources scoped to bound shard | dashboards, devtools |
| `avatar.minimal` | `examine`, `list_actions` | `inspect.read` set + `avatar/{a}/virtues` for own avatar only | LLM observer [amended from #25 §T-13-13] |
| `avatar.basic` | `avatar.minimal` set + `move_to` | `inspect.read` set | accessibility, tutorial agent |
| `avatar.full` | all verb tools | `inspect.read` set | LLM Avatar agent, QA harness |
| `ugc.author` | `avatar.full` + UGC authoring tools (out of scope here, see \#7) | `inspect.read` set | in-game editor bridge |

Capabilities gate which tools the server registers in the session's tool list; tools outside the bound capability set are not advertised and not callable.

Cross-shard access: forbidden. A resource URI for any shard other than `session.shard_id` returns `ERR_SHARD_BINDING`.

Rate limits and verb budgets are applied per-session at the dispatcher, identical to the per-player input rate limits used for mouse/keyboard.

---

## 4. The Five Non-Bypassable Invariants

These are enforcement contracts in the server, not guidelines.

1. **Single ingress.** Every verb tool resolves to exactly one `PlayerInputDispatcher.Submit(...)` call. There is no other code path from the MCP server into the simulation. Reviewers reject any PR that adds one.
2. **Pre-commit Virtue evaluation.** Virtue side-effects (\#5) are evaluated by the Virtue Engine *before* the verb commits. A verb that would violate an absolute rule (e.g., murder of a protected NPC on a Virtue Shard) is rejected at commit time, and the tool returns `ERR_VIRTUE_REJECTED` with the offending Virtue deltas. Clients cannot opt out.
3. **Declared persistence scope per call.** Every mutating tool call carries a `persistence_scope` enum (`world | player | housing | virtue | economy | story`) consistent with \#13. The dispatcher refuses calls whose declared scope does not match the verb's authoritative scope; this prevents clients from writing housing state under a `world` scope etc.
4. **Immutable shard binding.** `session.shard_id` cannot be mutated mid-session. Any tool input naming a different shard returns `ERR_SHARD_BINDING`. Cross-shard travel uses in-world moongate verbs, which terminate the current session.
5. **Per-entity right-click enumeration.** The right-click contextual menu is computed per entity from its components and the caller's capabilities. Clients call `list_actions(entity_id)` to obtain the current menu, then `right_click(entity_id, action_id)`. There is no global enumeration of all right-click actions, and `action_id` values from one entity are not portable to another.

---

## 5. Tool Definitions (Verbs)

All verbs share a common envelope:

```ts
type VerbEnvelope = {
  shard_id: ShardId;             // must equal session.shard_id
  avatar_id: AvatarId;           // must equal session.avatar_id
  persistence_scope: "world" | "player" | "housing" | "virtue" | "economy" | "story";
  client_op_id: string;          // idempotency key, UUIDv4
};
```

All verbs share a common return:

```ts
type VerbResult = {
  ok: boolean;
  op_id: string;                 // server-assigned
  applied_at: ServerTick;
  virtue_deltas?: { [virtue: string]: number };  // signed, per \#5
  state_diff?: EntityDiff[];     // components mutated, see \#13
  error?: { code: ErrorCode; message: string; entity_id?: EntityId };
};
```

Standard error codes: `ERR_SHARD_BINDING`, `ERR_CAPABILITY`, `ERR_VIRTUE_REJECTED`, `ERR_INVALID_TARGET`, `ERR_OUT_OF_RANGE`, `ERR_OWNERSHIP`, `ERR_BUSY`, `ERR_PHYSICS`, `ERR_SCOPE_MISMATCH`, `ERR_RATE_LIMIT`, `ERR_UNKNOWN_ACTION`.

### 5.1 examine

```json
{
  "name": "examine",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId"
  }
}
```

* Returns: examine text, visible state flags, public ownership tag, weight/volume if container, current schedule slot label if NPC.
* Mutates: nothing (pure read through dispatcher to capture observation events for AI memory and quest hooks).
* Virtues movable: none (observation only).
* Errors: `ERR_INVALID_TARGET`, `ERR_OUT_OF_RANGE` (line-of-sight rules per \#4 sound/visibility).

### 5.2 list\_actions

```json
{
  "name": "list_actions",
  "input": { "envelope": "VerbEnvelope", "entity_id": "EntityId" },
  "returns": {
    "entity_id": "EntityId",
    "menu_token": "string",     // expires; binds menu to current entity state
    "actions": [
      { "action_id": "string", "label": "string", "requires_capability": "string?" }
    ]
  }
}
```

* Mutates: nothing.
* Virtues movable: none.
* Errors: `ERR_INVALID_TARGET`, `ERR_CAPABILITY`. `menu_token` is required by `right_click` and is invalidated if the entity's component set changes.

### 5.3 use

```json
{
  "name": "use",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId",
    "with_entity_id": "EntityId | null"   // optional: "use X with Y"
  }
}
```

* Mutates: target's `State`, possibly `Container`, possibly `Lit`, possibly `Open`, possibly inventory of the Avatar; may spawn child entities (e.g., bread from oven).
* Virtues movable: Compassion (heal), Honesty (read sealed letter), Spirituality (meditate), Honor (touch shrine), Sacrifice (donate at altar). Sign and magnitude are determined by the Virtue Engine, not by the tool.
* Errors: `ERR_INVALID_TARGET`, `ERR_OUT_OF_RANGE`, `ERR_OWNERSHIP`, `ERR_VIRTUE_REJECTED`, `ERR_PHYSICS`.

### 5.4 drag

```json
{
  "name": "drag",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId",
    "to": { "kind": "world", "region_id": "RegionId", "x": "number", "y": "number", "z": "number" }
       | { "kind": "container", "container_entity_id": "EntityId" }
       | { "kind": "avatar_inventory" }
  }
}
```

* Mutates: target's `Transform` and/or parent `Container`; affected container weights/volumes; ownership transfer if moving from an NPC's container into Avatar inventory.
* Virtues movable: Honesty, Justice (taking owned property), Compassion (returning lost item to owner).
* Errors: `ERR_OWNERSHIP`, `ERR_PHYSICS` (overweight, blocked), `ERR_OUT_OF_RANGE`, `ERR_VIRTUE_REJECTED`.

### 5.5 drop

```json
{
  "name": "drop",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId",
    "at": { "region_id": "RegionId", "x": "number", "y": "number", "z": "number" }
  }
}
```

* Mutates: target's `Transform`, parent `Container` (removed from Avatar inventory), gravity/physics state.
* Virtues movable: Humility (discarding hoarded items has weak positive movement under specific contexts; computed by engine).
* Errors: `ERR_OUT_OF_RANGE`, `ERR_PHYSICS`.

### 5.6 combine

```json
{
  "name": "combine",
  "input": {
    "envelope": "VerbEnvelope",
    "primary_entity_id": "EntityId",
    "secondary_entity_id": "EntityId"
  }
}
```

* Mutates: consumes one or both inputs; spawns one or more output entities per recipe (\#4.1 crafting addendum). May fail benignly (humorous feedback per \#4) — `ok: true` with no `state_diff` is a valid outcome and is not an error.
* Virtues movable: Sacrifice (donating a successful craft afterwards is a separate verb), Honor (forging cursed item against an oath could move Honor negatively if the player has sworn one).
* Errors: `ERR_INVALID_TARGET`, `ERR_OWNERSHIP`, `ERR_PHYSICS`.

### 5.7 right\_click

```json
{
  "name": "right_click",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId",
    "menu_token": "string",        // from list_actions
    "action_id": "string",         // from list_actions
    "params": "object?"            // action-specific; schema served by list_actions
  }
}
```

* Mutates: action-dependent; the action's component-mutation set is declared by the entity's script hook and validated by the dispatcher.
* Virtues movable: any, depending on action (Lockpick → Honesty/Justice; Pour onto altar → Spirituality/Sacrifice; Ignite owned barn → Compassion/Justice large negative).
* Errors: `ERR_UNKNOWN_ACTION` (stale `menu_token` or wrong entity), `ERR_CAPABILITY`, `ERR_VIRTUE_REJECTED`.

### 5.8 attack

```json
{
  "name": "attack",
  "input": {
    "envelope": "VerbEnvelope",
    "target_entity_id": "EntityId",
    "weapon_entity_id": "EntityId | null"   // null = unarmed / equipped default
  }
}
```

* Mutates: target's `Health`/`Damage`, possibly `State` (on-fire weapon ignites target), Avatar's `Stamina`, weapon `Durability`.
* Virtues movable: Valor (engaging stronger foes), Compassion (attacking helpless / fleeing target moves negatively), Justice (attacking sanctioned criminal moves positively, attacking innocent moves strongly negatively), Honor (attacking unarmed or sleeping target moves negatively).
* Errors: `ERR_INVALID_TARGET`, `ERR_OUT_OF_RANGE`, `ERR_VIRTUE_REJECTED` (e.g., attempting murder on Virtue Shard against protected NPC).

### 5.9 cast\_spell

```json
{
  "name": "cast_spell",
  "input": {
    "envelope": "VerbEnvelope",
    "spell_id": "SpellId",
    "target": { "kind": "entity", "entity_id": "EntityId" }
            | { "kind": "point", "region_id": "RegionId", "x": "number", "y": "number", "z": "number" }
            | { "kind": "self" }
  }
}
```

* Mutates: consumes reagents from Avatar inventory (real items per \#4.6), Avatar `Mana`, target state (damage, fire, levitation, etc.); environmental effects propagate via simulation, not via this tool.
* Virtues movable: Spirituality (use of sanctioned magic), Compassion (heal/restore), Justice (binding criminals), Honor (oath-bound spells); negative on hostile/forbidden castings.
* Errors: `ERR_INVALID_TARGET`, `ERR_OUT_OF_RANGE`, `ERR_PHYSICS` (no reagents, no mana — returns `ok: false` with specific code).

### 5.10 throw

```json
{
  "name": "throw",
  "input": {
    "envelope": "VerbEnvelope",
    "entity_id": "EntityId",
    "to": { "region_id": "RegionId", "x": "number", "y": "number", "z": "number" }
  }
}
```

* Mutates: target's `Transform`, momentum, `Fragility` checks on impact (may break), may damage entities at impact point, may ignite flammable surfaces if entity is on fire.
* Virtues movable: Compassion / Justice if thrown at an entity (treated as `attack` with thrown weapon), Honor (throwing a gifted item).
* Errors: `ERR_OUT_OF_RANGE`, `ERR_PHYSICS`.

### 5.11 move\_to

```json
{
  "name": "move_to",
  "input": {
    "envelope": "VerbEnvelope",
    "to": { "region_id": "RegionId", "x": "number", "y": "number", "z": "number" },
    "mode": "walk" | "run"
  }
}
```

* Mutates: Avatar `Transform` over time (issues a path request through the same nav system used by mouse-click movement); does not teleport.
* Virtues movable: none directly. Trespass into private/owned regions during movement may emit Honesty/Justice events the same way mouse movement does.
* Errors: `ERR_OUT_OF_RANGE`, `ERR_PHYSICS` (unreachable), `ERR_BUSY` (already moving and `mode` mismatch).

### 5.12 discord.post\_to\_guild\_channel

```json
{
  "name": "discord.post_to_guild_channel",
  "input": {
    "envelope": "VerbEnvelope",
    "guild_id": "GuildId",
    "message": "string"
  }
}
```

* Description: Posts a message to a guild's linked Discord channel via the Britannia Discord bot. Used for in-game-originated announcements (raid calls, market events, guild-bulletin echoes).
* Authorization: guild-leader only, and only for guilds that have explicitly opted in to the Discord interop link. Calls from non-leader sessions or against non-linked guilds return `ERR_CAPABILITY`.
* Rate limits: outbound calls are rate-limited per Discord's API (per-channel + global bucket); excess returns `ERR_RATE_LIMIT`.
* OUTBOUND ONLY. Inbound Discord commands and Discord-side messages are NOT exposed via MCP. Discord is a community-augmentation surface only; it is never authoritative, never required, and never inside the in-game chat path (Doc #37 §Discord-interop is the canonical spec; see also Doc #41 Engine & Stack ADR for the Discord bot's process placement).
* Mutates: nothing in the simulation. The verb does not move Virtues, does not write to `replication_log`, and does not generate replication traffic.
* Errors: `ERR_CAPABILITY` (not guild leader, or guild not linked), `ERR_RATE_LIMIT`, `ERR_INVALID_TARGET` (unknown guild_id).

---

## 6. Resource Definitions (Read-Only)

URI scheme: `forge://shard/{shard_id}/...`. All resource reads are constrained to `session.shard_id`; mismatches return `ERR_SHARD_BINDING`.

| Resource URI | Returns | Notes |
| ----- | ----- | ----- |
| `forge://shard/{shard}/info` | `shard_info`: shard type, region list, concurrent player count, server tick rate | One per shard. |
| `forge://shard/{shard}/region/{region}` | `world_state(region_id)`: time of day, weather, fires, public events | Snapshot at current tick. |
| `forge://shard/{shard}/region/{region}/entities` | `entities_in_region`: list of `EntityId` + minimal component summary, paged | Spatially partitioned. Excludes private-instance entities. |
| `forge://shard/{shard}/entity/{entity_id}` | `entity_by_id`: full public components, owner, state flags | Private fields (NPC inner schedule notes, locked-chest contents) gated by capability. |
| `forge://shard/{shard}/npc/{entity_id}/schedule` | `npc_schedule`: 8 daily slots per \#4.5 | Public for non-quest NPCs; redacted for quest-critical NPCs. |
| `forge://shard/{shard}/avatar/{avatar_id}/virtues` | `virtue_readout(player_id)`: 8 Virtues, Avatar Score, public title | Reading another Avatar's full readout requires elevated capability; the public title is always visible. |

Resource reads do not move Virtues, do not write persistence, and do not generate replication traffic beyond their own subscription channel.

Subscriptions: clients may subscribe to any of the above URIs for tick-rate-throttled change events, delivered over SSE. Subscriptions terminate on session close.

---

## 7. Roblox Bridge Note

If a Roblox port is ever attempted (Doc \#9 keeps this as a non-primary alt), the MCP server does **not** run inside the Roblox VM. It runs as an external process and round-trips verbs over Roblox's `HttpService` (request/response) and `MessagingService` (cross-server fan-out).

Architectural shape:

```
MCP Client  <->  MCP Server (external)  <->  HttpService  <->  Roblox Game Server  <->  Roblox sim
                                          \-> MessagingService for cross-shard signals (read-only)
```

Caveats, all of which are accepted up front and not litigable later:

* **Latency.** Two extra network hops per verb (client→server→Roblox→sim). Expect 80–250ms added to every action; interactivity feels worse than UE5 stdio (\~5ms).
* **Parity drift.** Roblox simulation depth is materially shallower than the UE5 Chaos-based sim (\#9). Verbs that depend on flammability spread, container-in-container weight propagation, or sound-propagation NPC alerting may degrade to no-ops or approximations. The tool surface stays identical; the *semantics* are best-effort.
* **Virtue authority.** Virtue evaluation must still happen on the authoritative server. In a Roblox port that is the Roblox game server, not the external MCP process. The MCP server is never the source of truth for Virtue.
* **Shard binding.** A Roblox `place` is the unit of shard. Cross-place reads are forbidden in MCP just as cross-shard reads are in UE5.
* **Capability set.** `ugc.author` is unsupported in a Roblox bridge initially; UGC authoring goes through Roblox Studio, not MCP.

The Roblox bridge is a viable proof-of-concept path. It is not a parity target.

---

## 8. Phase 1 Implementation Scope (12-Week "Britain Alive")

Per Doc \#11, the prototype is Britain-only, 8-player, 12 weeks. The MCP surface for that slice is deliberately minimal: enough to prove the dispatcher path end-to-end and to support an LLM-driven QA/inspection agent during the build, without expanding scope.

In-scope tools (Phase 1):

| Tool / Resource | Why |
| ----- | ----- |
| `examine` | Pure read through dispatcher; proves observation events and Virtue-neutral path. |
| `entity_by_id` | Foundational resource read; needed by every client. |
| `entities_in_region` | Lets agents enumerate Britain without polling `entity_by_id`. |
| `virtue_readout` (own Avatar only) | Required to validate Virtue movement during prototype QA. |
| **One mutating verb: `use`** | Chosen over `drag` because `use` exercises the broadest set of downstream systems (state mutation, Virtue scoring on shrines/altars/locks, persistence on door state, replication of `Open`/`Lit` flags) with the simplest input schema. `drag` adds physics-pathing complexity that is not needed to prove the dispatcher contract. |

Out of scope for Phase 1 (deferred to post-prototype):

* `drag`, `drop`, `combine`, `right_click` + `list_actions`, `attack`, `cast_spell`, `throw`, `move_to`.
* `npc_schedule`, `world_state`, `shard_info` resources beyond a minimal `shard/info` for handshake.
* `ugc.author` capability.
* Roblox bridge.
* SSE transport (Phase 1 is `stdio` only, single-process, dev-machine; SSE is added in the post-prototype hardening pass once auth and rate-limit policies are settled).

Phase 1 success metric: a non-engine client process can, via stdio MCP, enumerate entities in Britain, examine an NPC, read its own Virtue, `use` the Compassion shrine, and observe both the simulated state change and the Virtue delta — produced by the same code path that fires for a mouse click.

---

## 9. Cross-Document Integration

* **\#4 Simulation:** every verb's mutation set must be expressible against \#4's component model; new verbs require a \#4 amendment first.
* **\#5 Virtues:** the Virtue Engine is the only authority for Virtue deltas; MCP tools never propose deltas, they only report them.
* **\#6 Persistent World:** persistence scopes are declared on every mutating call and validated at the dispatcher; replication fan-out is automatic.
* **\#7 UGC:** the modding API surface (\#7) and this MCP surface are deliberately parallel — the UGC editor is in-engine, MCP is out-of-process — but they share `PlayerInputDispatcher` as their single ingress.
* **\#9 Tooling:** UE5 is primary; Roblox is alt only, with the caveats in section 7.
* **\#13 Core Schema:** Entity, Verb, and Scope definitions are canonical there. This document does not redefine them; it binds tools to them.
* **\#41 Engine & Stack ADR:** canonical engine/stack decision. The MCP server is Rust; UE5 and TS clients are dumb views consuming Protobuf wire messages and never host the dispatcher or MCP transport.
* **\#37 §Discord-interop:** canonical spec for the Discord community-augmentation layer (Rich Presence, OAuth link, guild bot). The `discord.post_to_guild_channel` verb in §5.12 is the only MCP egress into Discord; inbound Discord commands are not on the MCP surface. Discord is never authoritative, never required, and never replaces in-game chat.

---

## 10. Open Questions

* Capability extension for moderation / GM tooling — separate document, not this surface.
* Whether `move_to` should be folded into a future `act` meta-verb that takes a high-level intent and decomposes — deferred until post-prototype, after we see how LLM clients actually use the surface.
* Subscription back-pressure policy when an LLM client falls behind tick rate — current plan is drop-and-coalesce; revisit after first agent integration.

This document is the contract. New tools, new resources, and new capabilities require an amendment to this file before implementation.
