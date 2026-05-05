Document #13: Core Schema — Entity, Verb, Scope
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Systems Architecture Lead]
Status: Living Technical Reference — Normative schema for all simulation, virtue, persistence, UGC, and MCP code paths

---

0. Purpose & Thesis

Every system described in Documents #4, #4.1, #5, #6, #7, and #8 is a *consumer* of verb-driven state changes on one shared Entity schema. There is one model, not seven. The verb dispatcher is the single choke point where Virtue scoring, persistence writes, and multiplayer replication hang off. Player input, UGC scripts, and MCP tool calls MUST all flow through that dispatcher. This document defines the contract.

Source documents: #4 §2 (entity fields), #4 §5 (schedule), #4.1 §2–4 (crafting verbs), #5 §2 (virtues), #6 §3 (persistence table), #7 §2 (UGC API surface).

---

1. Entity Schema

All world objects (items, NPCs, players, containers, environmental fixtures, projectiles) are instances of `Entity`. Components are attached per-archetype; instance overrides are scoped to specific fields. `[A]` = per-archetype default. `[I]` = per-instance, mutable. `[I*]` = per-instance, replicated to all clients in region.

```ts
type EntityId = u64
type ArchetypeId = string  // e.g. "item.torch", "npc.blacksmith.erevan"
type RegionId = string     // e.g. "highmere", "stonereach"

type Entity = {
  id: EntityId                         // [I]
  archetype: ArchetypeId               // [A]
  components: {
    Physical?:        PhysicalComponent
    State?:           StateComponent
    Ownership?:       OwnershipComponent
    Container?:       ContainerComponent
    Schedule?:        ScheduleComponent      // NPCs only
    ScriptHook?:      ScriptHookComponent
    VirtueWeights?:   VirtueWeightsComponent // archetype-level moral tags
    PersistenceScope: PersistenceScopeTag    // required on every entity
    Combat?:          CombatComponent
    Magic?:           MagicComponent
    Perception?:      PerceptionComponent    // NPC awareness (sight/hearing) [amended from #25 §T-13-4]
  }
}
```

### 1.1 PhysicalComponent (Doc #4 §2, §3)

```ts
type PhysicalComponent = {
  weight:        float    // [A] kg
  volume:        float    // [A] container-units
  solidity:      enum { Solid, Soft, Liquid, Gas }   // [A]
  flammability:  float    // [A] 0.0–1.0
  buoyancy:      float    // [A] 0.0–1.0
  fragility:     float    // [A] 0.0–1.0
  position:      Vec3     // [I*] sub-tile precision
  velocity:      Vec3     // [I*]
  region:        RegionId // [I*]
  containedBy:   EntityId | null  // [I*] null = loose in world
  volume_tile_footprint: TileFootprint  // [A] default {1,1} [amended from #23 §3]
  blocks_los:    bool                   // [A] default true if solidity == Solid AND footprint area >= 1 [amended from #23 §7]
}
```

### 1.2 StateComponent (Doc #4 §2)

Bool flags are sparse; only set flags are stored.

```ts
type StateComponent = {
  on_fire:   bool    // [I*]
  poisoned:  bool    // [I*]
  wet:       bool    // [I*]
  locked:    bool    // [I*]
  open:      bool    // [I*]
  lit:       bool    // [I*]
  broken:    bool    // [I*]
  hp:        int     // [I*] for damageable items / NPCs
  durability: int    // [I*] tools, weapons, armor
  decay_timer: float | null  // [I*] corpses, raw food (Doc #4.1 §3.1)
  // Status effect flags [amended from #16 §7]; sparse, presence = active.
  // Each may carry an optional `expires_at_tick` for timed states (see #16 §7 table for onset/removal rules).
  paralyzed:    bool   // [I*]
  invisible:    bool   // [I*]
  charmed:      bool   // [I*]
  sleeping:     bool   // [I*]
  bleeding:     bool   // [I*]
  unconscious:  bool   // [I*] hp ∈ (0, -10] (#16 §8); cannot act for 30s; any heal restores
}
```

### 1.3 OwnershipComponent (Doc #4 §4, Doc #5 §4)

```ts
type Owner =
  | { kind: "Npc",    id: EntityId }
  | { kind: "Player", id: PlayerId }
  | { kind: "Guild",  id: GuildId }
  | { kind: "World" }                // unowned/public

type OwnershipComponent = {
  owner:        Owner          // [I*]
  acquired_via: enum { Spawn, Crafted, Purchased, Gifted, Looted, Stolen, Found } // [I]
  bound:        bool           // [I] if true, cannot transfer
}
```

### 1.4 ContainerComponent (Doc #4 §4)

```ts
type ContainerComponent = {
  capacity_weight: float        // [A]
  capacity_volume: float        // [A]
  contents:        EntityId[]   // [I*] unlimited nesting permitted
  lockable:        bool         // [A]
  trap:            ScriptHookRef | null  // [I]
}
```

### 1.5 ScheduleComponent (Doc #4 §5)

> **Placeholder.** The placeholder schema below is superseded by the full normative `Schedule` (note: renamed from `ScheduleComponent`) plus expanded `ScheduleSlot` activity enum in **#17 §6**. Implementations MUST follow #17 §6. Retained here only for traceability.

```ts
type ScheduleSlot = {
  start_time: TimeOfDay   // 24h, original SCHEDULE.DAT-style
  activity:   enum { Sleep, Eat, Work, Travel, Socialize, Worship, Custom }
  location:   EntityId | Vec3   // anchor: bed, forge, etc.
  uses:       EntityId[]        // tools/objects required
  script:     ScriptHookRef | null
}

type ScheduleComponent = {
  slots:       ScheduleSlot[]   // [A] up to 8 daily slots
  overrides:   ScheduleSlot[]   // [I] event-driven (e.g. funeral)
  current_slot_idx: int         // [I*]
}
```

### 1.6 ScriptHookComponent (Doc #4 §2, Doc #7 §2)

```ts
type ScriptHookComponent = {
  on_examine?: ScriptRef
  on_use?:     ScriptRef
  on_combine?: ScriptRef    // (other: EntityId)
  on_attack?:  ScriptRef
  on_destroy?: ScriptRef
  on_tick?:    ScriptRef    // periodic
  custom?:     Record<VerbId, ScriptRef>
}
type ScriptRef = { lang: "lua" | "visual_node", id: string, sandbox: SandboxLevel }
```

### 1.7 VirtueWeightsComponent (Doc #5 §2, §4)

Archetype-level moral tagging. Verb dispatcher reads this to compute deltas.

```ts
type VirtueDelta = Partial<Record<Virtue, int>>  // -100..+100 per virtue
type Virtue = "Truth" | "Mercy" | "Courage" | "Justice"
            | "Devotion" | "Honor" | "Insight" | "Humility"

type VirtueWeightsComponent = {
  is_innocent: bool                   // [A] killing → Mercy/Justice loss
  is_sacred:   bool                   // [A] desecration → Insight loss
  is_holy_site: bool                  // [A] shrines, altars
  steal_delta:   VirtueDelta          // [A] applied if owner != actor
  destroy_delta: VirtueDelta          // [A]
  gift_delta:    VirtueDelta          // [A]
}
```

### 1.8 CombatComponent (Doc #4 §7)

```ts
type CombatComponent = {
  damage:        DiceExpr | int      // [A] for weapons
  damage_type:   enum { Slash, Pierce, Blunt, Fire, Cold, Poison, Magic } // [A]
  armor_class:   int                 // [A/I] for wearables and NPCs
  hp_max:        int                 // [A]
  faction:       string              // [I*] e.g. "town_guard.highmere"
  hostile_to:    string[]            // [I*]
  resistances:   Partial<Record<DamageType, float>>   // [A] 0.0–1.0; final damage *= (1 - resistance) [amended from #16 §3.2]
  armor_pierce:  int                                  // [A] weapons only [amended from #16 §3.2]
  stance:        enum { Normal, Defensive, Fleeing }  // [I*] [amended from #16 §3.2 / set by `defend`/`flee` verbs]
}
```

### 1.9 MagicComponent (Doc #4 §6)

```ts
type MagicComponent = {
  is_reagent:    bool                // [A]
  reagent_type:  string | null       // [A] e.g. "mandrake"
  spell_effect:  ScriptRef | null    // [A] for scrolls/potions
  enchantments:  Enchantment[]       // [I]
}
```

### 1.10 PersistenceScopeTag

Required on every entity. Drives which DB shard accepts writes. See §3.

```ts
type PersistenceScopeTag = { scope: PersistenceScope, owner_key: string | null }
```

### 1.11 PerceptionComponent (NPC awareness) [amended from #25 §T-13-4 + #27 §3]

NPC awareness layer for the witness model (#15 §6.2 + #25 §T-13-4) and sound-propagation alerts (#27 §3). Optional component; entities without it are treated as fully sighted, fully hearing actors with default thresholds. Default values apply to standard humanoid NPC archetypes.

```ts
type PerceptionComponent = {
  sight_radius:        int       // [A] tiles; default 16; observer-side LOS distance cap (independent of lighting modulation in #23 §7.2)
  hearing_radius:      int       // [A] tiles; default 12; sound-event pre-filter radius
  hearing_threshold:   int       // [A] dB; default 0; sound events with `audible_volume_db < threshold` are dropped for this NPC (#27 §3.1)
  sight_blocked:       bool      // [I*] default false; if true, the NPC cannot witness sight events (blind / blindfolded / dark room) but still hears
  hearing_blocked:     bool      // [I*] default false; if true, the NPC cannot witness sound events (deaf / deafened) but still sees
}
```

Phase 1 use: blind/sleeping/dead NPCs short-circuit the witness model per #25 §T-13-4 edge cases (a)/(b)/(c). Sound query layered into the steal witness pipeline includes blind NPCs whose `hearing_radius` covers the actor's tile AND whose `hearing_threshold` is exceeded by the emitted `noise_db`.

---

2. Verb Registry

Canonical, exhaustive list of interaction verbs implied by the docs. Every player input, UGC script call, and MCP tool maps to one of these.

| Verb | Source | Reads | Writes | Virtues Affected | LOS req? | Pausable? | Notes |
|---|---|---|---|---|---|---|---|
| `examine`            | Doc #4 §2 | Physical, State, Ownership, Magic | — | — | yes | no | Always available; pure read |
| `use`                | Doc #4 §2 | State, ScriptHook.on_use | State, Container | varies via script | yes | yes | Default left-click action |
| `drag`               | Doc #4 §2 | Physical, Ownership | Physical.containedBy, Physical.position | Truth, Justice (if owner≠actor) | yes | yes | Pickup/move |
| `drop`               | Doc #4 §2 | Physical | Physical.position, Physical.containedBy=null | — | no | yes | Inverse of drag |
| `combine(other)`     | Doc #4 §2, #4.1 §4 | both Physical, ScriptHook.on_combine, recipe DB | spawns/destroys entities | varies (crafting) | yes | yes | Crafting is verb-driven, not menu-driven |
| `right_click(action)`| Doc #4 §2 | varies | varies | varies | yes | yes | Dispatch wrapper; resolves to a concrete sub-verb. Sub-verb taxonomy resolved per #25 §T-13-1 (per-entity dynamic enum) |
| `attack(target)`     | Doc #4 §7 | Combat, Physical | State.hp, State.broken | Courage, Mercy, Justice, Honor | yes | no (real-time) | Real-time; pauses only on inventory open |
| `cast_spell(spell, target?)` | Doc #4 §6 | Magic, reagent inventory | varies — sets state, spawns entities | Insight, plus spell-specific | spell-dependent | partial | Telekinesis, Fireball, Create Food, etc. |
| `throw(target_pos)`  | Doc #4 §3, §7 | Physical | Physical.velocity | Courage (if combat use) | yes | no | Momentum applied; gravity in flight |
| `talk(npc)`          | Doc #2 §4.6, #4 §5 | NPC dialogue tree, VirtueWeights | dialogue state, possible quest flags | Truth (lying option) | yes | yes | Branching; Virtue-gated lines |
| `trade(npc, offer)`  | Doc #4 §4, #6 §4 | inventories, Ownership | Ownership transfer, gold | Truth, Honor (broken contracts) | yes | yes | Player-driven economy |
| `steal(item)`        | Doc #4 §4, #5 §4 | Ownership, witness LOS | Ownership.owner, Ownership.acquired_via=Stolen | Truth −, Justice − | yes | yes | Implicit when `drag` from foreign Container; alerts via sound (Doc #4 §3) |
| `lockpick(target)`   | Doc #4 §2, §4 | State.locked, skill | State.locked=false | Truth −, Justice − | yes | yes | Right-click action |
| `ignite(target)`     | Doc #4 §2, §3 | Physical.flammability | State.on_fire=true, State.lit=true | Mercy − (if owned/innocent) | yes | yes | Right-click action; spreads via sim |
| `extinguish(target)` | Doc #4 §3 | State.on_fire | State.on_fire=false | — | yes | yes | Water or spell |
| `meditate(shrine)`   | Doc #5 §3 | shrine entity | Player.virtues_visible=true | Insight + | yes | yes | Reveals current Virtue scores |
| `donate(npc, item)`  | Doc #5 §2 | inventories | Ownership transfer | Devotion +, Mercy + | yes | yes | Specialization of `trade` with no return |
| `sleep`              | Doc #6 §3 | Player.location | save state, time advance | — | no | yes | "Campfire save" in private instances |
| `place(entity)`      | Doc #7 §2 | UGC permissions | spawns persistent entity | — | n/a | yes | UGC editor only; goes through dispatcher with `caller=UGC` |
| `script_invoke(verb, args)` | Doc #7 §2 | UGC sandbox | varies | varies | n/a | yes | UGC scripts call through dispatcher; cannot bypass it |
| `move_to(target, options?)` | Doc #23 §5 [amended from #23 §5] | Physical, MoverArchetype, TerrainCapSet, spatial index | spawns/updates `MoveTask`; `Physical.position` per tile-crossing under `WorldState` | none direct (trespass into private region rejected upstream as `ERR_VIRTUE_REJECTED`) | n/a (movement) | yes | A* pathfind; submitted by player click-to-move, NPC ScheduleSystem (Doc #17 §7), combat AI, MCP `avatar.basic` |
| `defend(actor)` | Doc #16 §2.4 [amended from #16 §2.4] | Combat | sets `Combat.stance = Defensive` for 5s (`+50%` armor_class, `-25%` outgoing damage) | none | n/a | yes | Used by AI mode 5 (Defend) and player keybind `[D]` |
| `flee(actor)` | Doc #16 §2.5 [amended from #16 §2.5] | Combat, RegionMetadata, spatial index | sets `Combat.stance = Fleeing`; engages flee pathfinding to nearest safe tile | Courage (companion abandonment context per Doc #5 §2; not direct delta on the verb itself) | n/a | yes | Used by AI mode 11 (Flee) and player verb; companion flee triggers Doc #5 abandonment evaluation |
| `bribe(actor, npc, gold_amount)` | Doc #15 §6.5 [amended from #15 §6.5] | Ownership, OwnershipComponent, NPC.faction, actor.virtues.honor | gold transfer (PlayerInventory scope); clears actor's Wanted flag in NPC's faction; updates NPC reaction state | Truth − (bribery itself is dishonest, default −3) | yes | yes | Requires `npc.faction.accepts_bribes == true`; high-Honor pays MORE (intentional inversion) |
| `buy(merchant_or_stall, item, qty)` | Doc #18 §12 [amended from #18 §12] | Shop, MarketStall, Ownership | atomic gold→item transfer per Doc #18 §7.1 / §8.2; updates `OwnershipComponent.acquired_via = Purchased` | Truth (low-Truth buyer pays +50% in always_watched zones); none on the verb itself | yes | yes | Shop-component primitive; may return `ERR_VIRTUE_REJECTED` per §7.2 refusal rules |
| `sell(merchant, item, qty)` | Doc #18 §12 [amended from #18 §12] | Shop, Ownership | atomic item→gold transfer per Doc #18 §7.1 | none direct | yes | yes | Shop-component primitive; NPC merchants only — stalls do not accept SELL |

### 2.1 GM verbs (per #26 §8) [amended from #26 §8]

The following 11 mutating GM verbs flow through `VerbDispatcher.dispatch(invocation)` with `Caller = { kind: "GM", session_id, gm_avatar_id }` (see §4 Caller enum). Available only to a host whose session has been opened via `gm_session_open` (capability `gm.host`, scoped to that session's lifetime). All are audit-logged in `gm_session_audit`.

| Verb | Source | Reads | Writes | Virtues Affected | Notes |
|---|---|---|---|---|---|
| `puppet(npc_entity_id, override)` | #26 §8 | NPC entity, Schedule, State | adds temporary `Puppeted` component; preserves underlying schedule for restoration | none directly; downstream NPC actions score normally | GM "speaks/acts AS an NPC"; restores schedule on `unpuppet` or session end |
| `unpuppet(npc_entity_id)` | #26 §8 | `Puppeted` | removes `Puppeted`; resumes NPC schedule | none | Inverse of `puppet`; auto-fires on session end |
| `narrate(participants, text)` | #26 §8 | session participants | none (broadcast only) | none | Narration broadcast; flagged in chat as "GM narration"; does not enter dialogue session |
| `gm_spawn(template_id, location)` | #26 §8 | archetype DB, SpawnLimits | spawns NPCs/entities into pocket realm; persistence via Doc #21 §13.2 instance-scoped procedural | none directly; downstream verbs by spawned entities score normally | Bounded by `SpawnLimits.max_concurrent_entities` (default 50); shard-realm spawns require non-`Ephemeral` policy + moderation approval |
| `private_handout(player_id, item_template, qty)` | #26 §8 | HandoutLimits, archetype DB | gives item to participant via `drag` semantics; bypasses economy | applies normal Virtue side-effects (poisoned weapon, stolen unique, etc., scored against the GM) | Logged for audit; bounded by `HandoutLimits` |
| `gather(participants?, location)` | #26 §8 | participant `gather_consent` flag, spatial index | teleports consenting participants to `location` | none | Consent granted at session join; revocable mid-session |
| `time_skip(hours)` | #26 §8 | session region clock | advances local clock for the session's region; NPC schedule effects fire normally | none directly | Legal only in pocket realm OR `LiveWithRollback` arcs; forbidden in `LiveCanonical` |
| `weather_set(weather_type, duration)` | #26 §8 | session region weather | sets weather in pocket realm region | none | Pocket realm only; live-world weather is simulation-governed |
| `grant_virtue(player_id, virtue, delta)` | #26 §8 | VirtueGrantLimits | writes through Virtue Engine (Doc #5 §4); audit-logged in `player_virtue_log` (Doc #21 §3.4) with verb=`gm.grant_virtue` | bounded by `VirtueGrantLimits.max_abs_delta_per_session_per_virtue` (default ±5); fires standard Virtue side-effects | Crossing the bound returns `ERR_GM_VIRTUE_BUDGET` |
| `set_scene(scene_state)` | #26 §8 | `GMSession.pacing_state` | moves `pacing_state`; `InScene` triggers soft-pause (#26 §9) | none | Single lever for the soft-pause mechanism |
| `leave_session()` | #26 §8 | participant list | removes caller from `GMSession.participants`; closes their shared dialogue if any | Honor delta if leaving during `LiveCanonical` (#26 §14) | Available to participants, not the GM (GM uses `gm_session_close`) |

Notes:
- `right_click(action)` is a UI wrapper. The exact menu taxonomy (Mix/Pour/Ignite/Lockpick/etc. as named in Doc #4 §2) is per-entity dynamic (per #25 §T-13-1 ratification — see #25 for the `ActionDef` schema and the per-archetype declaration model).
- All verbs that mutate State, Ownership, or Container fields trigger the dispatch contract in §4.
- Verbs marked "Pausable: no" continue to run during inventory pause but resolve on next sim tick.

---

3. Persistence Scope Enum

Extracted directly from Doc #6 §3. Every Entity carries a `PersistenceScopeTag`; every dispatcher write is routed by this tag.

```ts
enum PersistenceScope {
  WorldState,         // NPC schedules, fires, placed objects
  PlayerInventory,    // gear, gold, reagents
  HousingAndCreations,// player homes, UGC dungeons
  VirtueReputation,   // 8 virtues + Avatar title
  Economy,            // shop prices, resource scarcity
  StoryEvents,        // Guardian incursions, Virtue trials
}
```

| Scope | Persistence Level | Owner Key | Reset Conditions |
|---|---|---|---|
| `WorldState`         | Full, all players in shard | `RegionId` | None except server wipe |
| `PlayerInventory`    | Per-player                | `PlayerId` | Death penalties (optional, per-shard rule) |
| `HousingAndCreations`| Per-player or per-guild   | `PlayerId` \| `GuildId` | Owner inactivity grace period (duration `[OPEN]`) |
| `VirtueReputation`   | Global, permanent, cross-shard | `PlayerId` | Atonement quests only |
| `Economy`            | Dynamic, shared           | `RegionId` | Weekly balancing pass |
| `StoryEvents`        | Phased, server-wide       | `ShardId` | Resolved by community vote or scheduled time |

Save cadence: continuous auto-save with 30-second rollback protection (Doc #6 §3). Manual `sleep` campfire saves only in single-player or private instances.

---

4. Verb Dispatch Contract (Invariant)

> Every verb invocation, regardless of caller (player input, UGC script, MCP tool), MUST flow through a single dispatcher. The dispatcher executes side effects in a fixed order: **Virtue evaluation → Persistence write → Replication.** No system may write to Entity components except via this dispatcher.

```ts
type Caller =
  | { kind: "Player",  id: PlayerId }
  | { kind: "UGC",     script_id: string, owner: PlayerId, sandbox_level: ScriptSandboxLevel }   // [amended from #19 §6]
  | { kind: "MCP",     tool: string, session: string }
  | { kind: "AI",      npc: EntityId }      // NPC schedule executor
  | { kind: "Sim",     reason: string }     // physics tick, fire spread
  | { kind: "GM",      session_id: GMSessionId, gm_avatar_id: AvatarId }              // [amended from #26 §8]
  | { kind: "Admin",   staff_id: StaffId, capability_tier: AdminCapabilityTier }      // [amended from #29 §1]

type VerbInvocation = {
  caller:  Caller
  verb:    VerbId
  actor:   EntityId         // who performs the action
  target:  EntityId | null
  args:    Record<string, any>
  region:  RegionId
}

dispatch(inv: VerbInvocation):
  1. validate(inv)                      // permissions, LOS, sandbox
  2. preconditions(inv)                 // distance, ownership, state flags
  3. effects = resolve_effects(inv)     // pure: produce diff, no writes
  4. virtue_delta = score_virtues(inv, effects)   // Doc #5
  5. apply_writes(effects, virtue_delta):          // single transaction
       a. mutate Entity components
       b. persist by PersistenceScope (§3)
       c. replicate to region peers
  6. emit_side_effects(inv, effects)    // see channels below
```

### Side-effect channels (fired in order, post-write)

1. **Virtue Engine** — `score_virtues` consumes `VirtueWeightsComponent`, ownership context, witness count. Updates per-player virtue scores. Triggers visible-feedback hooks (guard hostility, NPC dialogue tone, dream sequences).
2. **Persistence Layer** — Routes the diff to the DB shard for each affected `PersistenceScope`. `WorldState` writes are region-keyed; `VirtueReputation` writes are global.
3. **Replication Layer** — Broadcasts `[I*]` field deltas to all clients with the affected region in their interest set. Spatial partitioning per Doc #6 §2.
4. **Sound Propagation** — `attack`, `drag` (heavy), `ignite`, `cast_spell` emit audio events that may schedule NPC `on_alert` script hooks (Doc #4 §3).
5. **Schedule Interruption** — If `actor` or `target` is an NPC mid-schedule, push the current slot, switch to reactive behavior (Doc #4 §5).
6. **UGC Script Hooks** — `on_*` script refs on actor, target, and region fire after replication, in a sandboxed context that re-enters the dispatcher for any further mutations.
7. **MCP Telemetry** — MCP-originated invocations emit a structured event back to the calling tool session.

### Forbidden

- Direct component writes from physics, AI, UGC, or MCP code paths.
- Bypassing the Virtue scoring step, even for `Sim`-caller invocations (fire spread that destroys an owned barrel still scores).
- Cross-scope writes in the same transaction without explicit declaration.

---

5. Open Questions / Unresolved Areas

Items the docs leave unspecified that block implementation. These must be resolved before vertical-slice freeze.

1. `[RESOLVED — see #25 §T-13-1]` **Right-click sub-verb taxonomy.** Doc #4 §2 lists Mix, Pour, Ignite, Lockpick "etc." Need an enumerated, closed set vs. a `script_invoke` extension model — affects UGC API stability.
2. `[OPEN — partially resolved]` **NPC ownership transfer on death.** When an NPC dies, do their owned items become `Owner.World` (free to take), enter a corpse Container with original Ownership preserved (looting = stealing), or transfer to next-of-kin/faction? Doc #4 §4 mentions corpse decay timers but not ownership. Companion case resolved in #15 §3.7; non-companion NPC corpse rule carries the #20 §4.1 placeholder (300s decay → World) pending Phase-2 ratification.
3. `[RESOLVED — see #17 §6.1 + #25 §T-13-3]` **Schedule slot granularity.** Doc #4 §5 says "up to 8 daily time slots" — is this a hard cap per archetype, per instance, or per day? What time resolution (minute, 15-min, hour)?
4. `[RESOLVED — see #15 §6.2 + #25 §T-13-4]` **Witness model for stealing.** Doc #4 §3 implies sound propagation and NPC LOS, Doc #5 §4 implies any steal triggers Virtue loss. Is the loss applied (a) always, (b) only if witnessed, or (c) always for the score but only with legal consequence if witnessed? Affects dispatcher's `score_virtues` purity.
5. `[OPEN]` **Virtue opposition coupling.** Doc #5 §2 mentions raising one Virtue may slightly lower its philosophical opposite. The opposition graph (which Virtue opposes which) and the coupling coefficient are unspecified.
6. `[OPEN]` **Avatar Score formula.** Doc #5 §3 references a "single hidden Avatar Score" weighing all eight Virtues — weights and aggregation function not given.
7. `[OPEN]` **Cross-shard Virtue reputation.** Doc #6 §3 says VirtueReputation is "global & permanent" but Doc #6 §2 allows multiple shard types (Classic, Virtue, Chaos). Does Chaos-shard behavior leak into Virtue-shard reputation? "New Avatar reset" semantics also undefined.
8. `[OPEN]` **Housing inactivity grace period.** Doc #6 §3 cites "owner inactivity (grace period)" for housing reset — duration not specified.
9. `[RESOLVED — see #18 §2]` **Crafting recipe representation.** Doc #4.1 §4 says recipes are "combination rule[s] in the simulation database (no hard-coded crafting list)" — schema for recipes (predicate + product) not defined; needed for UGC recipe authoring (Doc #7 §2).
10. `[RESOLVED — see #15 §5.2 + #25 §T-13-10]` **Container weight/volume cascading.** Doc #4 §4 enforces limits and allows unlimited nesting. Does an outer container's weight include nested contents (realistic) or only direct children (gameplay)? Affects `drag` precondition checks.
11. `[RESOLVED — see #22 §15]` **Replication interest set for instanced housing.** Private instances (Doc #6 §2) need an explicit rule for which dispatcher writes replicate to visiting friends vs. owner-only.
12. `[RESOLVED — see #19 §5 + #16 §5]` **Sandbox levels for ScriptHook.** Doc #7 §2 distinguishes visual-node from Lua "advanced mode" but does not enumerate the sandbox capabilities (what verbs/components a script can read vs. write, rate limits, CPU budget per tick).
13. `[OPEN]` **MCP caller authority.** MCP tool calls flowing through the dispatcher need an authority model: do they act as the connected player, as a privileged GM, or as a sandboxed third party? Affects validation step 1 in §4.
14. `[RESOLVED — see #16 §10]` **Combat pause semantics under multiplayer.** Doc #4 §7 says "real-time with pause-on-inventory" — single-player only, or does opening inventory in multiplayer pause locally while the world continues for others? Affects which combat verbs are truly non-pausable in dispatcher terms.
15. `[RESOLVED — see #21 §13 + #25 §T-13-15]` **Procedurally-generated entity persistence.** Doc #8 §3 says generated objects are "fully interactive from the moment they spawn" — do they default to `WorldState` scope, or to a new `Procedural` scope with regeneration semantics?

---

End of Document #13.
