Document #19: Quest & Trigger Scripting (UGC)
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [UGC & Modding Lead / Systems Architecture]
Status: Living Technical Reference — Normative spec for visual + Lua UGC scripting, sandbox tiers, virtue validation, and verb-dispatcher integration

> **Updated 2026-05-04 per Doc #41.** The UGC scripting RUNTIME is server-side (Rust, sandboxed Lua/Wasm). The UGC EDITOR is a web/TS authoring tool — NOT in UE5. UE5 is the runtime renderer only. UE5 never compiles, validates, or executes UGC scripts.

Depends on: #5 Virtues, #6 Persistent World, #7 UGC, #8 Procedural Generation, #11 Prototype Scope, #13 Core Schema (Entity/Verb/Scope), #14 MCP Server Surface, #17 Dialogue & NPC Schedule, #41 Engine & Stack ADR.

Resolves: Doc #13 §5 [OPEN] #12 (Sandbox levels for ScriptHook).

Provenance tags: `[BG]` Black Gate (Ultima VII original), `[SI]` Serpent Isle, `[U4]` Ultima IV (Virtues canon), `[BR]` Britannia Reborn (new layer).

---

## 1. UGC Scripting Philosophy

`[BR]` defines two creator tiers atop the `[BG]` simulation: a visual node-based editor for newcomers (Doc #7 §2 "Trigger & Dialogue Editor") and a Lua-style API for veterans (Doc #7 §2 "Advanced Mode"). Both compile to the same intermediate representation and execute inside a sandbox. **No UGC code can mutate Entity components directly.** All world-affecting work is expressed as verb invocations, which are dispatched through `VerbDispatcher.dispatch(...)` exactly as defined in Doc #13 §4 — the same path used by player input (`[BG]` mouse/keyboard) and MCP tools (Doc #14). Virtue scoring (Doc #5 §4), persistence routing (Doc #6 §3), and replication therefore apply uniformly. This is the load-bearing invariant of the entire UGC layer: **UGC cannot bypass Virtue.** Creators get expressivity; the world keeps its moral physics.

---

## 2. Visual Scripting Model

### 2.1 Graph schema

```ts
type ScriptGraphId = string

type ScriptGraph = {
  id:               ScriptGraphId
  name:             string
  owner_player_id:  PlayerId
  sandbox_level:    ScriptSandboxLevel       // see §5
  nodes:            Node[]
  edges:            Edge[]
  metadata: {
    created_at:     Timestamp
    updated_at:     Timestamp
    virtue_score:   int | null               // populated by validator §8
    publish_state:  enum { Draft, Compiled, Submitted, Approved, Rejected, Live }
  }
}

type NodeId = string
type Node =
  | TriggerNode
  | ConditionNode
  | ActionNode
  | DialogueNode
  | TimerNode
  | RandomNode
  | CompositeNode

type Edge = {
  from:   NodeId
  to:     NodeId
  label?: string                              // e.g. "true", "false", "on_complete"
}
```

### 2.2 Node taxonomy

```ts
type TriggerNode = {
  id:           NodeId
  kind:         "Trigger"
  trigger_type: TriggerType
  filters:      Filter[]                      // ANDed
}

type TriggerType =
  | { t: "OnEnter",        region_or_volume: EntityId | RegionId }
  | { t: "OnExit",         region_or_volume: EntityId | RegionId }
  | { t: "OnUse",          target: EntityId }
  | { t: "OnTalk",         npc:    EntityId }
  | { t: "OnTimer",        period_seconds: float, jitter_seconds: float }
  | { t: "OnVerb",         verb:   VerbId }                    // any verb in Doc #13 §2
  | { t: "OnVirtueChange", virtue: Virtue, threshold: int, direction: "rises_above" | "falls_below" }
  | { t: "OnGameStart" }                                       // fires once per session

type Filter =
  | { f: "actor_has_virtue_at_least",  virtue: Virtue, value: int }
  | { f: "actor_has_virtue_at_most",   virtue: Virtue, value: int }
  | { f: "actor_holds_archetype",      archetype: ArchetypeId }
  | { f: "actor_is_in_party_with",     player_id: PlayerId }
  | { f: "time_of_day_between",        start: TimeOfDay, end: TimeOfDay }
  | { f: "flag_equals",                scope: PersistenceScope, key: string, value: Value }

type ConditionNode = {
  id:         NodeId
  kind:       "Condition"
  predicate:  Predicate
  true_edge:  NodeId
  false_edge: NodeId
}

type Predicate =
  | { p: "HasItem",        actor: ActorRef, archetype: ArchetypeId, count?: int }
  | { p: "VirtueAtLeast",  actor: ActorRef, virtue: Virtue, value: int }
  | { p: "FlagSet",        scope: PersistenceScope, key: string }
  | { p: "EntityAlive",    entity: EntityId }
  | { p: "RandomChance",   p: float }                          // 0.0–1.0
  | { p: "QuestStageIs",   quest: QuestId, stage: StageId }

type ActionNode = {
  id:          NodeId
  kind:        "Action"
  action_type: ActionType
  params:      Record<string, Value>
  next:        NodeId | null                                   // single-out
}

type ActionType =
  | "SpawnEntity"      // params: { archetype, location, ownership? }
  | "DespawnEntity"    // params: { entity }
  | "InvokeVerb"       // params: { verb: VerbId, actor, target?, args }
  | "GiveItem"         // params: { actor, archetype, count }
  | "TakeItem"         // params: { actor, archetype, count }
  | "SetFlag"          // params: { scope, key, value }
  | "ChangeVirtue"     // params: { actor, virtue, delta } — gated; see §8
  | "OpenDialogue"     // params: { npc, player, tree_id }    — see Doc #17
  | "PlayCutscene"     // params: { cutscene_id }
  | "TeleportActor"    // params: { actor, region, position } — gated by sandbox
  | "StartQuest"       // params: { quest, player }
  | "UpdateQuest"      // params: { quest, player, stage }
  | "CompleteQuest"    // params: { quest, player, outcome: "success" | "fail" }

type DialogueNode = {
  id:        NodeId
  kind:      "Dialogue"
  tree_ref:  DialogueTreeId                                    // owned tree, schema in Doc #17
  on_each_branch: Record<BranchId, NodeId>                     // continuation
}

type TimerNode = {
  id:           NodeId
  kind:         "Timer"
  delay_seconds: float
  next:         NodeId
}

type RandomNode = {
  id:        NodeId
  kind:      "Random"
  branches:  { weight: float, next: NodeId }[]                 // weights normalized
}

type CompositeNode = {
  id:        NodeId
  kind:      "Composite"
  subgraph:  ScriptGraphId                                     // reusable sub-graph
  bindings:  Record<string, Value>                             // parameter bind
  next:      NodeId
}

type ActorRef =
  | { ref: "trigger_actor" }                                   // who fired the trigger
  | { ref: "owner" }                                           // creation owner
  | { ref: "entity", id: EntityId }
```

### 2.3 Editor surface

> **Editor host (per Doc #41).** The UGC editor lives on the **web** as a TS-based authoring tool, in the same repo as the web thin client (PixiJS web prototype + permanent web-thin-client). It is **not** an in-engine UE5 editor module. Authors compose graphs in the browser; the editor publishes scripts to the Rust server, which validates them (§8), compiles them (§2.4), and is the sole executor at runtime. UE5 never executes UGC code directly — the UE5 client receives only the resulting world deltas (verb resolutions, entity diffs) over the wire protocol. References below to "in-game editor" describe the in-shard authoring overlay surfaced in the web client; the prior phrase predates Doc #41 and refers to the same TS-hosted editor.

- Renders as a drag-and-drop directed graph in the in-game "Trigger & Dialogue Editor" (Doc #7 §2).
- Type checking on edge creation: outputs typed (`flow`, `actor`, `entity`, `value`); incompatible connections rejected at edit time.
- Live virtue overlay: each `ChangeVirtue` action shows a colored badge so creators see moral weight while building.
- Subgraphs (`CompositeNode`) are shareable across creations via the Hall of Wonders (Doc #7 §3).

### 2.4 Compilation

The visual graph compiles to a deterministic interpreter program that runs at the simulation tick rate (Doc #14 §2). Compilation is total — every node has a defined effect or compile error — and produces an immutable bytecode blob plus a static analysis report consumed by the validator (§8).

---

## 3. Quest Data Model

### 3.1 Schema

```ts
type QuestId  = string
type StageId  = string

type Quest = {
  id:                  QuestId
  name:                string
  description:         string                 // visible in journal
  stages:              QuestStage[]
  start_stage_id:      StageId
  virtue_requirement:  VirtueGate | null      // optional gate to start
  reward:              RewardEffect[]         // applied on success terminal
  metadata: {
    author_player_id:  PlayerId
    sandbox_level:     ScriptSandboxLevel
    is_skeleton:       bool                   // §10 procedural binding
  }
}

type QuestStage = {
  id:                    StageId
  name:                  string
  description:           string               // journal text shown to player
  entry_effects:         ActionNode[]         // run on stage enter
  completion_predicate:  ConditionNode        // success transition
  fail_predicate:        ConditionNode | null // optional failure transition
  next_stage:            StageRef             // on success
  fail_stage:            StageRef | null      // on failure
}

type StageRef =
  | { ref: "stage", id: StageId }
  | { ref: "end",   outcome: "success" | "fail" | "abandoned" }

type VirtueGate = {
  predicates: { virtue: Virtue, op: ">=" | "<=", value: int }[]   // ANDed
}

type RewardEffect =
  | { r: "GiveItem",     archetype: ArchetypeId, count: int }
  | { r: "ChangeVirtue", virtue: Virtue, delta: int }             // validator-gated §8
  | { r: "GrantFlag",    scope: PersistenceScope, key: string, value: Value }
```

### 3.2 Journal entity

- Tracked **per-player** in a journal `Entity` carried in player inventory — matches the `[BG]` "Journal" item that auto-records quest progress.
- Journal is a special `Container` whose contents are immutable journal-page sub-entities; quest stage transitions emit a new page through `VerbDispatcher` (no direct write).
- Quest progress storage: `PersistenceScope = PlayerInventory`, owner_key = `PlayerId` (Doc #6 §3, Doc #13 §3).
- Public quest definitions (the `Quest` template itself, not progress): `PersistenceScope = WorldState` if published, `HousingAndCreations` if private/friends-only (§11).

### 3.3 Multi-player quest semantics

- Each player has independent stage progress in the journal.
- Shared-instance triggers (`OnEnter` in a UGC region) fire per-actor; `completion_predicate` evaluates in the actor's player context.
- Party-wide quests: a Quest may declare `share_progress: true` (deferred — `[OPEN]` in §14) so any party member's progress advances the stage for all members.

---

## 4. Lua API Surface

### 4.1 Availability

Lua is unlocked at sandbox level `Standard` and above (§5). At `Restricted`, only visual nodes compile. At `Standard+`, creators may write Lua snippets that the engine wraps in the same dispatcher contract as visual `InvokeVerb` actions.

### 4.2 Module surface

```lua
-- Read-only world queries (always available; no mutation)
forge.query.entity(id)                        -- -> EntityProxy (read-only view)
forge.query.entities_in_region(region_id, filter_table) -- -> List<EntityProxy>
forge.query.actor_virtues(actor_id)           -- -> VirtueTable (own creation's actors only)
forge.query.npc_schedule(npc_id)              -- -> Schedule (public NPCs; redacted for quest-critical, per Doc #14 §6)
forge.query.flag(scope, key)                  -- -> Value | nil  (own scope only at Standard; world scope at Trusted)

-- Verb invocations — every call goes through VerbDispatcher with Caller = UGC(creator_id, sandbox_level)
forge.verb.examine(actor_id, target_id)
forge.verb.use(actor_id, target_id, with_id_or_nil)
forge.verb.drag(entity_id, destination)
forge.verb.drop(entity_id, position)
forge.verb.combine(primary_id, secondary_id)
forge.verb.attack(actor_id, target_id, weapon_id_or_nil)
forge.verb.cast_spell(actor_id, spell_id, target)
forge.verb.throw(actor_id, entity_id, position)
forge.verb.talk(actor_id, npc_id)
forge.verb.trade(actor_id, npc_id, offer)
forge.verb.donate(actor_id, npc_id, item_id)
forge.verb.meditate(actor_id, shrine_id)
forge.verb.spawn(template_id, location, ownership_or_nil)     -- Trusted+ only
forge.verb.place(template_id, location)                        -- UGC editor; Standard+

-- UGC-specific helpers (still dispatcher-routed under the hood)
forge.quest.start(quest_id, player_id)
forge.quest.update(quest_id, player_id, stage_id)
forge.quest.complete(quest_id, player_id, outcome)             -- "success" | "fail"
forge.dialogue.open(npc_id, player_id, tree_id)
forge.flag.set(scope, key, value)                              -- scope <= sandbox cap (§5)
forge.flag.get(scope, key)
forge.log.debug(message)                                       -- writes to creator's debug log only

-- Forbidden (raises sandbox violation at compile time, runtime as defensive backstop):
--   direct ECS / component mutation  (no forge.entity.set_*)
--   network calls                    (no socket, http, requests)
--   filesystem access                (no io, no os.execute)
--   coroutines that yield indefinitely (yields outside engine-managed iterator hooks)
--   table.setmetatable on engine-vended objects (EntityProxy, VirtueTable, Schedule)
--   debug.* introspection that leaks engine internals
--   package, require, loadstring, load, dofile, loadfile
--   reading flags from another player's PlayerInventory scope
```

### 4.3 Standard library policy

The Lua VM ships a minimal stdlib whitelist:

| Module | Status |
|---|---|
| `math`         | full |
| `string`       | full, except `string.dump` |
| `table`        | full, but vended engine objects have frozen metatables |
| `os`           | only `os.time`, `os.date` (read-only, server-tick-aligned); all else stripped |
| `io`           | removed |
| `package`      | removed |
| `coroutine`    | available only inside engine-managed iterators (`forge.query.entities_in_region` returns one) |
| `debug`        | removed |
| `loadstring` / `load` / `dofile` / `loadfile` | removed |

`require` is replaced by `forge.require(creator_module_id)` which loads only modules from the same creator's namespace, also sandboxed.

### 4.4 EntityProxy

A read-only handle. Field reads return value copies; writes raise `sandbox_violation`. The only way to change an entity is to call a `forge.verb.*` function and let the dispatcher run.

---

## 5. Sandbox Levels — Resolves Doc #13 §5 [OPEN] #12

```ts
enum ScriptSandboxLevel {
  None        = 0,   // engine-internal scripts only; never UGC
  Restricted  = 1,   // visual nodes + Lua read-only queries; no mutating verbs
  Standard    = 2,   // visual nodes + Lua + most verbs (no spawn, no flag.set on world scope)
  Trusted     = 3,   // Standard + spawn + flag.set on world scope; requires creator verification
  Official    = 4,   // Trusted + access to scheduled live-events APIs; only Origin team scripts
}
```

### 5.1 Per-level capability matrix

| Capability | None | Restricted | Standard | Trusted | Official |
|---|---|---|---|---|---|
| Visual node graph compile/run | n/a | yes | yes | yes | yes |
| Lua source compile/run | n/a | no | yes | yes | yes |
| `forge.query.*` (read) | yes | yes | yes | yes | yes |
| Read-only verbs (`examine`, `meditate`) | yes | yes | yes | yes | yes |
| Mutating verbs on creator-owned entities (`use`, `drag`, `drop`, `combine`, `talk`, `donate`, `trade`) | yes | no | yes | yes | yes |
| Combat verbs (`attack`, `cast_spell` with damage, `throw` at actor) inside creation region | yes | no | yes | yes | yes |
| `forge.verb.spawn` (instantiates new entities at runtime) | yes | no | no | yes | yes |
| `forge.verb.place` (UGC editor object placement) | n/a | yes | yes | yes | yes |
| `forge.flag.set` on `PlayerInventory` (own creation's player) | yes | no | yes | yes | yes |
| `forge.flag.set` on `HousingAndCreations` (own scope) | yes | yes | yes | yes | yes |
| `forge.flag.set` on `WorldState` | yes | no | no | yes | yes |
| `forge.flag.set` on `VirtueReputation` direct | no | no | no | no | yes (Origin live-ops only) |
| `ChangeVirtue` action node / `forge.verb.donate` etc. (indirect Virtue movement via verbs) | yes | no | yes | yes | yes |
| Live-event APIs (`forge.event.schedule`, `forge.event.broadcast`) | n/a | no | no | no | yes |
| Cross-region `TeleportActor` action | yes | no | no | yes | yes |
| Override NPC `Schedule` (reschedule canonical `[BG]` NPCs) | n/a | no | no | no | yes |

### 5.2 Promotion ladder

| From → To | Trigger |
|---|---|
| (new) → Restricted | Default on first creation |
| Restricted → Standard | 5 approved creations, or any creation with virtue score ≥ 50 |
| Standard → Trusted | Real-name verification + community vouching (Doc #7 §3 moderation pipeline) |
| Trusted → Official | Internal Origin appointment; not creator-requestable |

Demotion is automatic on a moderation strike (TOS violation, Virtue red flag override) and resets the promotion clock.

### 5.3 Enforcement

- **Compile-time:** the compiler walks the AST / graph and fails any call to a verb or scope above the declared `sandbox_level`. Compile diagnostics list each rejected node with its required level (e.g., "node_id=42 calls `forge.verb.spawn`, requires `Trusted`, current `Standard`").
- **Runtime:** the dispatcher re-checks `Caller.sandbox_level` against the verb's per-level capability bit; mismatch returns `ERR_SANDBOX_VIOLATION` and is logged to the creator's debug log + moderation telemetry. Defense in depth: even if a creator finds a compiler bypass, the dispatcher rejects.

---

## 6. Verb Dispatch from UGC

> **Invariant (restated from Doc #13 §4 / Doc #14 §5):** Every UGC verb call — whether emitted by a visual `InvokeVerb` action node or by a Lua `forge.verb.*` call — MUST flow through `VerbDispatcher.dispatch(invocation)` with `Caller = { kind: "UGC", script_id, owner: creator_id, sandbox_level }`. There is no other path from UGC code into Entity state.

```ts
type Caller =
  | { kind: "Player",  id: PlayerId }
  | { kind: "UGC",     script_id: string, owner: PlayerId, sandbox_level: ScriptSandboxLevel }   // <-- this doc
  | { kind: "MCP",     tool: string, session: string }
  | { kind: "AI",      npc: EntityId }
  | { kind: "Sim",     reason: string }
```

Dispatcher behavior for UGC callers:

1. **`validate(inv)`** — checks `sandbox_level` against the verb's per-level capability bit (§5.1). Rejects with `ERR_SANDBOX_VIOLATION`.
2. **`preconditions(inv)`** — same as player input (LOS, distance, ownership, state flags).
3. **`resolve_effects(inv)`** — pure diff computation, identical to player path.
4. **`score_virtues(inv, effects)`** — **fires identically**. UGC cannot bypass Virtue scoring. A UGC script that calls `forge.verb.attack` against an innocent NPC produces the same Compassion/Justice loss as a player swinging a sword.
5. **`apply_writes`** — same single-transaction commit.
6. **Side-effect channels** — Virtue Engine, Persistence, Replication, Sound, Schedule Interruption, UGC hooks, MCP telemetry — all fire as in Doc #13 §4. UGC-originated invocations additionally emit a structured event to the creator's debug log.

The dispatcher's view of a UGC verb call is **structurally identical** to a player's mouse click. Same rate limits per session/region (§7), same Virtue rules, same persistence scopes.

---

## 7. Resource & Rate Limits

```ts
type ScriptBudget = {
  max_instructions_per_tick:        int       // default 10_000  Lua VM step cap
  max_entities_spawned_per_minute:  int       // default 20
  max_verbs_invoked_per_tick:       int       // default 50
  max_memory_bytes:                 int       // default 1_048_576  (1 MB Lua heap per script)
  max_concurrent_scripts:           int       // default 10  per UGC region
  max_subgraph_recursion_depth:     int       // default 16
  max_timer_node_jitter_seconds:    float     // default 60.0
}
```

### 7.1 Defaults by sandbox level

| Field | Restricted | Standard | Trusted | Official |
|---|---|---|---|---|
| `max_instructions_per_tick` | 2,000 | 10,000 | 25,000 | 100,000 |
| `max_entities_spawned_per_minute` | 0 | 0 | 20 | 200 |
| `max_verbs_invoked_per_tick` | 10 | 50 | 100 | 500 |
| `max_memory_bytes` | 256 KB | 1 MB | 4 MB | 16 MB |
| `max_concurrent_scripts` | 4 | 10 | 32 | 256 |

### 7.2 Enforcement & violations

- Lua VM step counter pre-empts runaway loops; on overflow → script paused, `ERR_BUDGET_INSTRUCTIONS` written to creator's debug log.
- `max_verbs_invoked_per_tick` is checked at the dispatcher; the (n+1)th call returns `ERR_BUDGET_VERBS` and the script is rate-throttled for the next tick.
- Sustained budget overflow (3 consecutive ticks) → script paused, region flagged for moderation review (Doc #7 §3).
- Memory overflow → script terminated, state rolled back to last verb-commit boundary (matches the 30-second rollback protection in Doc #6 §3).

---

## 8. Virtue Validator Pass

Referenced in Doc #7 §2 as "Virtue Validator." Static + dynamic analysis, run at publish time and re-run on any edit.

### 8.1 Inputs

- The compiled visual graph (node-and-edge form).
- The Lua AST (parsed, sandboxed).
- The declared `sandbox_level`.

### 8.2 Computation

```
VirtueAlignmentScore =
    Σ over ChangeVirtue actions A in graph:
        weight(A.virtue) * sign(A.delta) * |A.delta| * trigger_probability(A)
  + Σ over verb invocations V whose archetype virtue_weights are known (Doc #13 §1.7):
        signed_score(V) * trigger_probability(V)
```

`trigger_probability(N)` is a static estimate: 1.0 for nodes reachable from `OnGameStart`/unconditional triggers, attenuated by `RandomNode` weights and `ConditionNode` heuristics (Predicates default to 0.5 unless flag-frequency data is known).

`weight(virtue)` is uniform = 1.0 for v1; tuning hook reserved.

### 8.3 Red flags (block publish)

- Script uniformly drives any Virtue negative across all reachable paths (anti-Virtue content) — score on that virtue ≤ −50 with no positive branch.
- Script bypasses Virtue scoring by `flag.set` patterns that mimic verbs the dispatcher would have scored (e.g., setting an "owned_by_player" flag in a way that semantically equals a `steal` without invoking `steal`). Detected by a pattern matcher against known scoring-evasion idioms; matcher rules versioned alongside this doc.
- Script targets `[BG]` canonical NPCs (Lord British, Iolo, Shamino, Spark, Dupre, Jaana, Geoffrey, Julia, Katrina, Sentri, Mariah, Tseramed) with `attack`, `TeleportActor`, or `DespawnEntity` outside an Alternate Britannia opt-in (Doc #3 §7).
- Script invokes verbs above its sandbox level (already a compile error; flagged here for moderation transparency).
- Script causes runaway state (e.g., infinite spawn loops not captured by §7 budgets) detected by graph cycle analysis.

### 8.4 Approval rule

```
publish_allowed = (no red flags) AND (VirtueAlignmentScore >= 0 OR alternate_britannia_opt_in)
```

### 8.5 Player-facing badge

| Score | Badge |
|---|---|
| ≥ 50  | "Virtuous Content" |
| 0..49 | "Neutral" |
| < 0 (Alternate Britannia only) | "Challenges Virtues" |

Badges render in the Hall of Wonders browser (Doc #7 §3).

---

## 9. Publishing Pipeline

Formalizes Doc #7 §3.

| Step | Actor | Action | Failure mode |
|---|---|---|---|
| 1. Save | Creator | Saves graph + Lua to draft slot in `HousingAndCreations` scope | n/a |
| 2. Compile | Server | Graph validation, Lua sandbox check, type check, sandbox-capability check | `ERR_COMPILE` with diagnostics; creator fixes and retries |
| 3. Validator | Server | Virtue validator (§8) | Red flag → publish blocked, diagnostics returned; creator revises |
| 4. Auto-test | Server | Spawn private instance (Doc #6 §2 instanced housing), run scripted smoke test that fires every `TriggerNode` once, record state diffs and Virtue deltas | Crash / unhandled exception → publish blocked |
| 5. Submit | Creator | One-click submit to moderation queue | n/a |
| 6. Moderation | AI pre-filter + community vote + Origin team | Per Doc #7 §3 | Rejection → creator notified with reason |
| 7. Publish | Server | Promote draft → `Public` (`WorldState` scope) or `Personal/Friends` (`HousingAndCreations`); list in Hall of Wonders if Public; eligible for "Featured" curation | n/a |

Re-publish: any post-approval edit re-enters the pipeline at step 2. Approved live content remains available until the new version replaces it (no downtime gap).

---

## 10. UGC × Procedural (Cross-Link to Doc #8)

- Doc #8 §3.3 procedural quest skeletons use the **same `Quest` schema** defined in §3 of this document.
- UGC creators at sandbox level `Trusted` may author quest **skeletons** that procedural generation instantiates into frontier regions and pocket realms (Doc #8 §2 generation types).
- Skeletons declare typed parameter slots:

```ts
type SkeletonParam = {
  name:      string                            // e.g. "{npc_name}", "{item_to_find}", "{moral_dilemma}"
  type:      "ArchetypeId" | "EntityRef" | "VirtueDilemma" | "string" | "int"
  bind_at:   "instantiate" | "first_trigger"
  default?:  Value
}

type QuestSkeleton = Quest & {
  is_skeleton: true                            // §3 metadata bit
  params:      SkeletonParam[]
}
```

- At instantiation time, the procedural generator (Doc #8 §3.3) binds each `{...}` slot per the region's seed and "moral climate" (Doc #8 §4).
- Bound skeletons are persisted as ordinary `Quest` instances in `WorldState` scope, owner_key = `RegionId`.
- A creator-authored skeleton credits the creator on every instantiated quest's journal page and in Hall of Wonders metrics.
- Phase 1 does not include skeleton authoring (§13).

---

## 11. Persistence of UGC

References Doc #6 §3 / Doc #13 §3.

| UGC artifact | `PersistenceScope` | `owner_key` | Visibility |
|---|---|---|---|
| Public approved creation (graph + Lua + entities placed) | `WorldState` | `RegionId` | All players on shard |
| Private/friends-only creation | `HousingAndCreations` | `PlayerId` (or `GuildId`) | Owner + invited |
| Quest definition (template) | follows the creation it ships with | inherited | as above |
| Per-player quest progress (journal pages, stage ID, flags) | `PlayerInventory` | `PlayerId` | Player only |
| Creator's draft creations | `HousingAndCreations` | `PlayerId` | Owner only |
| Creator's debug log | `HousingAndCreations` | `PlayerId` | Owner only |
| Live-event scheduled scripts | `StoryEvents` | `ShardId` | Phased server-wide |

Cross-scope writes from a single UGC verb call are forbidden unless the verb's authoritative scope explicitly declares them (Doc #14 §4 invariant 3).

---

## 12. MCP Additions to Doc #14 §7 (Capability Tier `ugc.author`)

The `ugc.author` capability set (already declared in Doc #14 §3) adds the following tools and resources. All tools reuse the standard `VerbEnvelope` and `VerbResult` shapes from Doc #14 §5.

### 12.1 New tools

```json
{
  "name": "compile_script",
  "input": {
    "envelope": "VerbEnvelope",
    "source": { "kind": "graph_json", "json": "object" }
            | { "kind": "lua_source", "code": "string" },
    "sandbox_level": "Restricted | Standard | Trusted"
  },
  "returns": {
    "ok": "boolean",
    "diagnostics": [
      { "severity": "error | warning | info", "node_id?": "string", "line?": "int", "message": "string" }
    ],
    "virtue_score": "int | null",
    "validator_red_flags": "string[]"
  }
}
```

```json
{
  "name": "publish_creation",
  "input": {
    "envelope": "VerbEnvelope",
    "creation_id": "CreationId",
    "name": "string",
    "description": "string",
    "scope": "public | friends | personal"
  },
  "returns": {
    "ok": "boolean",
    "moderation_ticket": "string | null",
    "error?": { "code": "ErrorCode", "message": "string" }
  }
}
```

```json
{
  "name": "playtest_creation",
  "input": {
    "envelope": "VerbEnvelope",
    "creation_id": "CreationId"
  },
  "returns": {
    "ok": "boolean",
    "instance_uri": "string | null",
    "expires_at": "Timestamp | null"
  }
}
```

### 12.2 New resources

| Resource URI | Returns |
|---|---|
| `forge://shard/{s}/creations/mine` | `creation_list`: own creations across all states (Draft → Live), with virtue scores |
| `forge://shard/{s}/creations/featured` | `creation_list`: Hall of Wonders featured set, paged |
| `forge://shard/{s}/creations/{creation_id}` | `creation_detail`: name, description, sandbox level, virtue score, badge, author |
| `forge://shard/{s}/recipes/templates` | `quest_skeleton_list`: quest skeleton templates available for procedural binding (§10) |
| `forge://shard/{s}/creator/{player_id}/debug_log` | `debug_log`: own debug log only; capability check enforces |

Standard error codes apply, plus `ERR_SANDBOX_VIOLATION`, `ERR_COMPILE`, `ERR_VALIDATOR_RED_FLAG`, `ERR_BUDGET_INSTRUCTIONS`, `ERR_BUDGET_VERBS`.

All `ugc.author` tools resolve to verbs that flow through `PlayerInputDispatcher` → `VerbDispatcher` per Doc #14 §4 invariant 1. No new ingress.

---

## 13. Phase 1 Prototype Scope (Doc #11 Vertical Slice)

| Feature | Phase 1 status |
|---|---|
| Visual node editor | yes (only path; no Lua in Phase 1) |
| Lua API | deferred to Phase 2 |
| `TriggerType` available | `OnEnter`, `OnUse` only |
| `ActionType` available | `SpawnEntity`, `OpenDialogue`, `GiveItem` only |
| `ConditionNode` | yes, all predicates |
| `DialogueNode` | yes, integrates with Doc #17 minimal dialogue tree |
| `TimerNode`, `RandomNode`, `CompositeNode` | deferred |
| Quest model | yes, single-stage quests only |
| Multi-stage `Quest.next_stage` | deferred |
| Sandbox levels | `Restricted` only |
| Sandbox enforcement | compile-time + runtime, both on |
| Virtue validator | runs; **only blocks red-flagged scripts in Phase 1**; scoring badge deferred |
| Publishing pipeline | save + compile + validate + auto-test + manual approval; full moderation queue deferred |
| `playtest_creation` MCP tool | yes |
| `compile_script`, `publish_creation` MCP tools | yes (subset; `publish_creation` writes to a "Phase 1 review" queue not Hall of Wonders) |
| Procedural skeleton authoring (§10) | deferred |
| Cross-shard concerns | not applicable in Phase 1 (single shard) |

Success criterion (matches Doc #7 §6): a Phase 1 creator builds a 1-room dungeon with 3 triggers (OnEnter spawns a chest, OnUse opens a dialogue with a custom NPC, OnUse on the chest gives a quest item), playtests it in a private instance, and a friend joins to play it through.

---

## 14. Open Questions

- `[OPEN]` **Lua VM choice — LuaJIT vs vanilla Lua 5.4.** LuaJIT gives ~10× perf but its FFI is a sandbox hazard requiring extensive surgery; vanilla 5.4 is easier to sandbox but slower under heavy creator load. Decision needed before Phase 2.
- `[OPEN]` **Script versioning under verb signature drift.** When a verb in Doc #13 §2 gains a parameter or changes default behavior, how do existing approved UGC scripts migrate? Options: (a) freeze old scripts at their compile-time verb registry version (multi-version dispatcher), (b) auto-rewrite where possible, fall back to creator notification, (c) hard re-compile on next publish. Affects backwards compatibility guarantees.
- `[OPEN]` **Per-script raised resource budgets.** Should `Trusted` creators be able to request budget increases per creation (e.g., a large-scale dungeon with 30 NPCs needs `max_concurrent_scripts > 10`)? If yes, what's the approval mechanism — automatic for `Trusted`, moderator review, or capped above some hard ceiling?
- `[OPEN]` **Anti-cheat for `forge.flag.get` cross-player reads.** Sandbox already forbids reading another player's `PlayerInventory` flags (§4.2). Need a verifier that detects indirect read paths (e.g., reading a `WorldState` flag whose value was written by a different creator's script that mirrored a player flag). Likely needs taint analysis at compile time.
- `[OPEN]` **UGC migration between shards.** If a creator authored a creation on shard `virtue-01` and wants to deploy on `chaos-02`, what carries over? `WorldState` is per-shard by definition (Doc #6 §3); Virtue scores are global; the creation graph itself is portable. Need an "export creation" verb and an "import creation" verb with shard-specific re-validation.
- `[OPEN]` **Party-wide quest progress sharing.** §3.3 mentioned `share_progress: true`; semantics for late-joining party members and dropouts undefined.
- `[OPEN]` **`CompositeNode` permission inheritance.** When a `Restricted` creator embeds a `Trusted`-authored subgraph (`CompositeNode.subgraph`), does the subgraph execute at its author's level or the calling graph's level? Default plan: lowest-of-the-two, but this restricts useful sharing.
- `[OPEN]` **Virtue weight tuning.** §8.2 uses uniform `weight(virtue) = 1.0`; whether some Virtues (Honor, Spirituality) deserve higher validator weights for skeleton/featured curation is undecided.

---

**See also: Doc #41 Engine & Stack ADR** — canonical decision that the UGC runtime is the Rust server (sandboxed Lua/Wasm) and the UGC editor is the web/TS authoring tool. UE5 is renderer-only and never executes UGC code directly.

---

End of Document #19.
