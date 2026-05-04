Document #13: Core Schema — Entity, Verb, Scope
Project Title: Ultima VII: Britannia Reborn
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
type ArchetypeId = string  // e.g. "item.torch", "npc.blacksmith.iolo"
type RegionId = string     // e.g. "britain", "trinsic"

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
type Virtue = "Honesty" | "Compassion" | "Valor" | "Justice"
            | "Sacrifice" | "Honor" | "Spirituality" | "Humility"

type VirtueWeightsComponent = {
  is_innocent: bool                   // [A] killing → Compassion/Justice loss
  is_sacred:   bool                   // [A] desecration → Spirituality loss
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
  faction:       string              // [I*] e.g. "town_guard.britain"
  hostile_to:    string[]            // [I*]
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

---

2. Verb Registry

Canonical, exhaustive list of interaction verbs implied by the docs. Every player input, UGC script call, and MCP tool maps to one of these.

| Verb | Source | Reads | Writes | Virtues Affected | LOS req? | Pausable? | Notes |
|---|---|---|---|---|---|---|---|
| `examine`            | Doc #4 §2 | Physical, State, Ownership, Magic | — | — | yes | no | Always available; pure read |
| `use`                | Doc #4 §2 | State, ScriptHook.on_use | State, Container | varies via script | yes | yes | Default left-click action |
| `drag`               | Doc #4 §2 | Physical, Ownership | Physical.containedBy, Physical.position | Honesty, Justice (if owner≠actor) | yes | yes | Pickup/move |
| `drop`               | Doc #4 §2 | Physical | Physical.position, Physical.containedBy=null | — | no | yes | Inverse of drag |
| `combine(other)`     | Doc #4 §2, #4.1 §4 | both Physical, ScriptHook.on_combine, recipe DB | spawns/destroys entities | varies (crafting) | yes | yes | Crafting is verb-driven, not menu-driven |
| `right_click(action)`| Doc #4 §2 | varies | varies | varies | yes | yes | Dispatch wrapper; resolves to a concrete sub-verb. Sub-verb taxonomy `[OPEN]` |
| `attack(target)`     | Doc #4 §7 | Combat, Physical | State.hp, State.broken | Valor, Compassion, Justice, Honor | yes | no (real-time) | Real-time; pauses only on inventory open |
| `cast_spell(spell, target?)` | Doc #4 §6 | Magic, reagent inventory | varies — sets state, spawns entities | Spirituality, plus spell-specific | spell-dependent | partial | Telekinesis, Fireball, Create Food, etc. |
| `throw(target_pos)`  | Doc #4 §3, §7 | Physical | Physical.velocity | Valor (if combat use) | yes | no | Momentum applied; gravity in flight |
| `talk(npc)`          | Doc #2 §4.6, #4 §5 | NPC dialogue tree, VirtueWeights | dialogue state, possible quest flags | Honesty (lying option) | yes | yes | Branching; Virtue-gated lines |
| `trade(npc, offer)`  | Doc #4 §4, #6 §4 | inventories, Ownership | Ownership transfer, gold | Honesty, Honor (broken contracts) | yes | yes | Player-driven economy |
| `steal(item)`        | Doc #4 §4, #5 §4 | Ownership, witness LOS | Ownership.owner, Ownership.acquired_via=Stolen | Honesty −, Justice − | yes | yes | Implicit when `drag` from foreign Container; alerts via sound (Doc #4 §3) |
| `lockpick(target)`   | Doc #4 §2, §4 | State.locked, skill | State.locked=false | Honesty −, Justice − | yes | yes | Right-click action |
| `ignite(target)`     | Doc #4 §2, §3 | Physical.flammability | State.on_fire=true, State.lit=true | Compassion − (if owned/innocent) | yes | yes | Right-click action; spreads via sim |
| `extinguish(target)` | Doc #4 §3 | State.on_fire | State.on_fire=false | — | yes | yes | Water or spell |
| `meditate(shrine)`   | Doc #5 §3 | shrine entity | Player.virtues_visible=true | Spirituality + | yes | yes | Reveals current Virtue scores |
| `donate(npc, item)`  | Doc #5 §2 | inventories | Ownership transfer | Sacrifice +, Compassion + | yes | yes | Specialization of `trade` with no return |
| `sleep`              | Doc #6 §3 | Player.location | save state, time advance | — | no | yes | "Campfire save" in private instances |
| `place(entity)`      | Doc #7 §2 | UGC permissions | spawns persistent entity | — | n/a | yes | UGC editor only; goes through dispatcher with `caller=UGC` |
| `script_invoke(verb, args)` | Doc #7 §2 | UGC sandbox | varies | varies | n/a | yes | UGC scripts call through dispatcher; cannot bypass it |

Notes:
- `right_click(action)` is a UI wrapper. The exact menu taxonomy (Mix/Pour/Ignite/Lockpick/etc. as named in Doc #4 §2) and which become first-class verbs vs. `script_invoke` is `[OPEN]`.
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
  | { kind: "UGC",     script_id: string, owner: PlayerId }
  | { kind: "MCP",     tool: string, session: string }
  | { kind: "AI",      npc: EntityId }      // NPC schedule executor
  | { kind: "Sim",     reason: string }     // physics tick, fire spread

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

1. `[OPEN]` **Right-click sub-verb taxonomy.** Doc #4 §2 lists Mix, Pour, Ignite, Lockpick "etc." Need an enumerated, closed set vs. a `script_invoke` extension model — affects UGC API stability.
2. `[OPEN]` **NPC ownership transfer on death.** When an NPC dies, do their owned items become `Owner.World` (free to take), enter a corpse Container with original Ownership preserved (looting = stealing), or transfer to next-of-kin/faction? Doc #4 §4 mentions corpse decay timers but not ownership.
3. `[OPEN]` **Schedule slot granularity.** Doc #4 §5 says "up to 8 daily time slots" — is this a hard cap per archetype, per instance, or per day? What time resolution (minute, 15-min, hour)?
4. `[OPEN]` **Witness model for stealing.** Doc #4 §3 implies sound propagation and NPC LOS, Doc #5 §4 implies any steal triggers Virtue loss. Is the loss applied (a) always, (b) only if witnessed, or (c) always for the score but only with legal consequence if witnessed? Affects dispatcher's `score_virtues` purity.
5. `[OPEN]` **Virtue opposition coupling.** Doc #5 §2 mentions raising one Virtue may slightly lower its philosophical opposite. The opposition graph (which Virtue opposes which) and the coupling coefficient are unspecified.
6. `[OPEN]` **Avatar Score formula.** Doc #5 §3 references a "single hidden Avatar Score" weighing all eight Virtues — weights and aggregation function not given.
7. `[OPEN]` **Cross-shard Virtue reputation.** Doc #6 §3 says VirtueReputation is "global & permanent" but Doc #6 §2 allows multiple shard types (Classic, Virtue, Chaos). Does Chaos-shard behavior leak into Virtue-shard reputation? "New Avatar reset" semantics also undefined.
8. `[OPEN]` **Housing inactivity grace period.** Doc #6 §3 cites "owner inactivity (grace period)" for housing reset — duration not specified.
9. `[OPEN]` **Crafting recipe representation.** Doc #4.1 §4 says recipes are "combination rule[s] in the simulation database (no hard-coded crafting list)" — schema for recipes (predicate + product) not defined; needed for UGC recipe authoring (Doc #7 §2).
10. `[OPEN]` **Container weight/volume cascading.** Doc #4 §4 enforces limits and allows unlimited nesting. Does an outer container's weight include nested contents (realistic) or only direct children (gameplay)? Affects `drag` precondition checks.
11. `[OPEN]` **Replication interest set for instanced housing.** Private instances (Doc #6 §2) need an explicit rule for which dispatcher writes replicate to visiting friends vs. owner-only.
12. `[OPEN]` **Sandbox levels for ScriptHook.** Doc #7 §2 distinguishes visual-node from Lua "advanced mode" but does not enumerate the sandbox capabilities (what verbs/components a script can read vs. write, rate limits, CPU budget per tick).
13. `[OPEN]` **MCP caller authority.** MCP tool calls flowing through the dispatcher need an authority model: do they act as the connected player, as a privileged GM, or as a sandboxed third party? Affects validation step 1 in §4.
14. `[OPEN]` **Combat pause semantics under multiplayer.** Doc #4 §7 says "real-time with pause-on-inventory" — single-player only, or does opening inventory in multiplayer pause locally while the world continues for others? Affects which combat verbs are truly non-pausable in dispatcher terms.
15. `[OPEN]` **Procedurally-generated entity persistence.** Doc #8 §3 says generated objects are "fully interactive from the moment they spawn" — do they default to `WorldState` scope, or to a new `Procedural` scope with regeneration semantics?

---

End of Document #13.
