Document #16: Combat & Magic Systems
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Combat & Magic Systems Lead]
Status: Living Technical Reference — Normative spec for damage, spells, AI-mode dispatch, and combat-driven Virtue scoring

> **Updated 2026-05-04 per Doc #41.** Combat resolution is fully server-authoritative (Rust). UE5's Gameplay Ability System (GAS) is FORBIDDEN — it is non-deterministic and fights this doc's design. UE5 is the renderer; combat math lives only on the Rust shard.

Depends on: #2 GDD §4.3, §4.4, #4 Simulation §6, §7, #4.1 Crafting & Alchemy (reagents as physical entities), #5 Virtues §4 (environmental kills), #13 Core Schema (Entity, Verb, Scope), #14 MCP Surface (`attack`/`cast_spell`/`throw`), #15 Character, Party & Inventory (Hits/Mana derivation, 10 SI combat AI modes, paperdoll traversal), #41 Engine & Stack ADR.

Heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Britannia Reborn.

---

## 1. Combat Philosophy

Combat in Britannia Reborn is real-time, mouse-driven, and pause-on-inventory `[BG]` — there is no turn-based mode and no initiative system. It is a consumer of the same simulation layer as every other verb (Doc #4 §7), so a thrown lit torch into hay is a combat outcome by virtue of the fire-spread sim, not a special-case combat rule. Every kill, miss, mercy, and environmental burn is scored by the Virtue Engine through the dispatcher (Doc #5 §4) — the system distinguishes a sword to the throat from a fireball into a barn from a barrel-pushed-into-fire, all via the same `VerbDispatcher` (Doc #13 §4). Serpent Isle improvements (10 named AI modes, right-hand swing fix, visible weapon durability) are pulled forward where strict upgrades `[SI]`; we do not import SI's stat-only genesis or its Black-Sword-specific rules.

---

## 2. Combat Verb Dispatch Contracts

The three combat verbs from Doc #13 §2 (`attack`, `throw`, `cast_spell`) are formalized below, plus two new verbs (`defend`, `flee`) added to support AI modes (§4) and listed in §11 as MCP surface additions.

> **Client/server boundary (per Doc #41).** Client-side animation, VFX, and audio are presentational only. All damage rolls, status effects, mana costs, range/LOS validation, target validation, Virtue deltas, and durability decrements happen on the Rust server. Clients (UE5 and TS) submit ACTION INTENTS via the wire protocol (Protobuf in `/shared/proto`); the Rust server returns RESOLUTION EVENTS that drive presentation. Swing animations, hit-flashes, spell particles, and combat audio cues are triggered by inbound resolution events — never by local prediction of damage outcomes. UE5's Gameplay Ability System (GAS) MUST NOT be used; the verb dispatcher in §2.1–§2.5 is the only authoritative path.

### 2.1 attack

```ts
type AttackInput = {
  actor:           EntityId
  target:          EntityId
  weapon:          EntityId | null      // null = unarmed; otherwise must be in left_hand or right_hand (Doc #15 §5.1)
  intent?:         "strike" | "displace"  // [BR] displace = shove; used for env-kills (§6)
}

type AttackResult = {
  ok:              bool
  damage_dealt:    int
  damage_type:     DamageType            // §3
  crit:            bool
  state_changes:   StateChange[]         // e.g. on_fire applied by burning weapon
  target_status:   "alive" | "unconscious" | "dead"
  virtue_deltas:   Record<Virtue, int>
  error?:          ErrorCode
}
```

Resolve order (executed inside `VerbDispatcher.dispatch` per Doc #13 §4):

1. **Range check** — actor.position within `weapon.range` of target.position (unarmed = 1.5 tiles, melee = 1.5, bow = 12, crossbow = 10, sling = 8). Fail → `ERR_OUT_OF_RANGE`.
2. **LOS check** — straight-line raycast through region tile grid; blocked by `Solid` `PhysicalComponent.solidity` walls. Fail → `ERR_LOS_BLOCKED`.
3. **AI-mode override** — if `actor` is a companion and `CompanionPolicy.ai_mode == Manual` and caller is not the obey_player, reject `ERR_AI_OVERRIDE`. Otherwise the per-tick AI in §4 is the typical caller and the player attack is the override.
4. **Damage roll** — formula in §3, includes crit roll.
5. **Armor mitigation** — subtract `target.Combat.armor_class` reduced by armor-pierce on weapon if any.
6. **State effects** — apply `on_fire` if weapon is burning, `poisoned` if weapon is poisoned (Doc #4 §6, Doc #4.1 alchemy), `bleeding` on crit with slashing/piercing weapons (§7).
7. **Virtue scoring** — invokes Doc #5 §4 with witness set from Doc #15 §6.2; intent=displace routes through env-kill scoring (§6).
8. **Persistence write** — `target.State.hp` mutation under `WorldState` scope (NPC) or `PlayerInventory` scope (Avatar Hits — Hits are derived per Doc #15 §2.1 but the persisted delta is the damage event).
9. **Replication** — `[I*]` deltas to all clients in region.

Error modes: `ERR_OUT_OF_RANGE`, `ERR_LOS_BLOCKED`, `ERR_INVALID_TARGET` (target lacks `Combat` component or already dead), `ERR_AI_OVERRIDE`, `ERR_VIRTUE_REJECTED` (Virtue Shard absolute rule, e.g., murder of protected NPC, per Doc #14 §4 invariant 2).

### 2.2 cast_spell

```ts
type CastSpellInput = {
  actor:        EntityId
  spellbook:    EntityId               // must be in actor.paperdoll OR loose in actor's container tree
  spell_id:     SpellId                // must be in spellbook.Spellbook.learned_spells (§5)
  target:       SpellTarget            // Self | Entity | Tile | Area
}

type SpellTarget =
  | { kind: "self" }
  | { kind: "entity", entity_id: EntityId }
  | { kind: "tile",   region_id: RegionId, x: int, y: int, z: int }
  | { kind: "area",   region_id: RegionId, x: int, y: int, z: int, radius: float }

type CastSpellResult = {
  ok:              bool
  reagents_consumed: ReagentId[]
  mana_spent:      int
  effects_applied: SpellEffectInstance[]
  virtue_deltas:   Record<Virtue, int>
  error?:          ErrorCode
}
```

Resolve order:

1. **Spellbook ownership** — spellbook.OwnershipComponent.owner == actor; otherwise `ERR_OWNERSHIP`.
2. **Spell known** — spell_id in spellbook.Spellbook.learned_spells; otherwise `ERR_SPELL_UNKNOWN`.
3. **Mana check** — actor.Magic.mana >= spell.mana_cost; otherwise `ERR_INSUFFICIENT_MANA`.
4. **Reagent check** — for each reagent in spell.reagents, traverse actor's paperdoll + container tree (Doc #15 §5.2 cascading rules) for one stack with `MagicComponent.is_reagent == true` and matching `reagent_type`. Fail → `ERR_MISSING_REAGENT { reagent_type }`.
5. **Range / LOS / targeting validation** — per spell.targeting kind. Self = always valid. Entity = LOS + range (default 12 tiles, overridable per spell). Tile/Area = LOS to center.
6. **Cast time** — schedule resolution at `now + spell.cast_time_ms`; during this window, taking damage interrupts and refunds mana but consumes reagents `[BG]`.
7. **Reagent consumption** — atomically decrement one of each from stacks; routed through dispatcher writes.
8. **Mana deduction** — actor.Magic.mana -= spell.mana_cost.
9. **Effect resolution** — for each `SpellEffect` in spell.effect, invoke its handler; effects that mutate other entities re-enter the dispatcher (Doc #13 §4 §6 forbidden-direct-write rule applies).
10. **Virtue scoring** — Spirituality + (sanctioned cast), plus per-effect deltas (Damage on innocent → Compassion/Justice loss, Heal → Compassion +, Resurrect → Spirituality + + Sacrifice +).
11. **Persistence + replication** as standard.

Error modes: `ERR_OWNERSHIP`, `ERR_SPELL_UNKNOWN`, `ERR_INSUFFICIENT_MANA`, `ERR_MISSING_REAGENT`, `ERR_OUT_OF_RANGE`, `ERR_LOS_BLOCKED`, `ERR_INVALID_TARGET`, `ERR_INTERRUPTED`, `ERR_VIRTUE_REJECTED`.

### 2.3 throw

```ts
type ThrowInput = {
  actor:       EntityId
  projectile:  EntityId                // any entity with PhysicalComponent
  to:          { region_id: RegionId, x: float, y: float, z: float }
}

type ThrowResult = {
  ok:               bool
  impact_entity:    EntityId | null
  damage_dealt:     int                  // 0 if no impact_entity
  state_changes:    StateChange[]
  fragility_break:  bool                 // projectile destroyed on impact (Doc #13 §1.1 fragility)
  virtue_deltas:    Record<Virtue, int>
  error?:           ErrorCode
}
```

Resolve order:

1. **Range** — Euclidean distance from actor to `to` <= 8 tiles + STR/4. Fail → `ERR_OUT_OF_RANGE`.
2. **LOS** — to target tile.
3. **Ballistic resolution** — physics tick computes parabolic arc with gravity; first entity intersected becomes impact_entity.
4. **Impact damage** — if impact_entity has `Combat` component: `damage = projectile.Physical.weight * velocity / 2` rounded, capped at 30. State of projectile carries: a lit torch sets `on_fire` on impact, a poisoned dart sets `poisoned`.
5. **Fragility check** — if `projectile.Physical.fragility > random(0,1)`: projectile destroyed; if it was a sealed liquid container (oil flask, potion), spill effect applied to impact tile.
6. **Virtue scoring** — if impact_entity is hostile: Valor scoring identical to `attack`. If projectile was a gifted item: Honor − (Doc #14 §5.10).
7. **Persistence + replication** as standard.

Error modes: `ERR_OUT_OF_RANGE`, `ERR_LOS_BLOCKED`, `ERR_PHYSICS` (projectile too heavy: weight > actor.STR / 2).

### 2.4 defend `[BR]` (new verb)

```ts
type DefendInput = { actor: EntityId }
type DefendResult = { ok: bool, stance_until_tick: int }
```

Sets `actor.Combat.stance = Defensive` for next 5s. Effects: `+50%` armor_class, `-25%` damage on outgoing attacks. Stance is a `[I*]` flag on `CombatComponent` (extension). Used by AI mode 5 (Defend) and player keybind `[D]`. No Virtue impact. Pausable: yes (does not interrupt real-time loop).

### 2.5 flee `[BR]` (new verb)

```ts
type FleeInput = { actor: EntityId }
type FleeResult = { ok: bool, fleeing_until_tick: int }
```

Sets `actor.Combat.stance = Fleeing`; engages pathfinder to nearest tile in a region whose `RegionMetadata.always_watched_by` is the actor's faction OR whose `chaos_zone == false`, whichever is nearer. Companion who flees triggers the Doc #5 abandonment event for the player (Valor − for player if companion was protecting them and is abandoned — `[OPEN]` how this scopes). Player flee verb has no Virtue impact directly; the Virtue Engine evaluates flight context separately (Doc #5 §2 Valor).

---

## 3. Damage Model

```ts
type DamageType = "physical" | "fire" | "cold" | "poison" | "magic" | "holy"
// physical further sub-typed at weapon level: Slash | Pierce | Blunt (Doc #13 §1.8)

damage = (weapon_base
        + str_mod(actor.STR)
        + skill_mod(actor.Combat)
        - max(0, target.Combat.armor_class - weapon.armor_pierce))
        * crit_mult
        * environment_mod

str_mod(STR)        = floor(STR / 4)                  // STR 8 → +2, STR 30 → +7
skill_mod(Combat)   = floor(Combat / 5)               // Combat 5 → +1, Combat 30 → +6
crit_mult           = if crit_roll then 2.0 else 1.0
crit_chance(actor)  = clamp(0.02 + actor.Combat * 0.005 + actor.DEX * 0.003, 0.02, 0.30)
                      // floor 2%, ceiling 30% [BR formula]
environment_mod     = product of (§3.1 modifiers)
```

### 3.1 Environment Modifiers

| Condition | Modifier |
|---|---|
| Target on fire, incoming physical | × 1.25 (charred armor weaker) |
| Target wet, incoming fire | × 0.5 |
| Target wet, incoming cold | × 1.5 |
| Target sleeping or paralyzed | × 2.0 (Honor − applies, Doc #14 §5.8) |
| Actor flanking (AI mode 10) | × 1.3 |
| Actor in defensive stance | × 0.75 (mirrors §2.4) |
| Holy damage on `is_sacred=true` actor turned undead `[OPEN]` | × 2.0 |

Modifiers stack multiplicatively. Final damage clamped to `[1, target.Combat.hp_max]`.

### 3.2 Resistances

Extend `CombatComponent` (Doc #13 §1.8):

```ts
type CombatComponent = {
  // ...existing fields...
  resistances: Partial<Record<DamageType, float>>   // [A], 0.0–1.0; final damage *= (1 - resistance)
  armor_pierce: int                                  // [A] for weapons only
  stance:       enum { Normal, Defensive, Fleeing }  // [I*] [BR]
}
```

Examples: skeleton has `physical: 0.5` (bones reduce slash/pierce), fire elemental has `fire: 1.0, cold: -0.5` (negative = vulnerability multiplier 1.5×).

---

## 4. AI-Mode Dispatch

The 10 SI combat AI modes from Doc #15 §3.3 are policies on `CompanionPolicy.ai_mode`. They run in a `CompanionAI` system that ticks every 500ms and emits verb invocations through the same `VerbDispatcher` as player input — preserving Doc #13 §4 invariant.

```ts
type CombatAiMode =
  | "Manual" | "AttackNearest" | "AttackWeakest" | "AttackStrongest"
  | "Defend" | "Berserk" | "Flee" | "Random" | "Protect" | "Flank"

interface CompanionAiTick {
  // Called every 500ms per companion in active region
  tick(companion: Entity, party: Entity[], region: Region): void
}
```

Per-mode algorithm (each runs only if companion is alive, conscious, and not currently in cast-time of a spell):

| Mode | Per-Tick Decision |
|---|---|
| **Manual** | Noop. Return immediately; await explicit verb from obey_player. |
| **AttackNearest** | `hostiles = visible_hostiles_in_region(companion)`; if empty noop. Else `target = argmin(distance(companion, h))`. Invoke `attack(companion, target, equipped_weapon)`. |
| **AttackWeakest** | Same gather; `target = argmin(h.State.hp)`. Invoke `attack`. |
| **AttackStrongest** | `target = argmax(h.State.hp)`. Invoke `attack`. |
| **Defend** | If hostile within 6 tiles of obey_player: invoke `attack` on that hostile. Else move to within 1.5 tiles of obey_player and invoke `defend(companion)`. |
| **Berserk** | Same as AttackNearest, but never invoke `flee` regardless of `companion.State.hp` ratio. Overrides flee_threshold. |
| **Flee** | If any hostile within 8 tiles: invoke `flee(companion)`. Never attack. |
| **Random** | Pick uniformly from hostiles in 12-tile radius; invoke `attack`. |
| **Protect** | Like Defend but targets `companion.CompanionPolicy.protect_target` (defaults to obey_player); fall back to obey_player if protect_target unset. |
| **Flank** | If target locked: pathfind to a tile in the rear 90° arc behind target's facing; on arrival invoke `attack` (gets ×1.3 environment_mod, §3.1). If no target: behave as AttackNearest until locked. |

Hostile NPCs use a separate `HostileAI` (§9) — `CompanionAI` is companion-only.

`visible_hostiles_in_region(e)` = entities with `Combat` component, `Combat.faction` in `e.Combat.hostile_to`, with LOS to `e`, in same region, alive.

Auto-flee override `[BR]`: any mode except Berserk that would invoke `attack` first checks `companion.State.hp / companion.Combat.hp_max < CompanionPolicy.flee_threshold`; if true, switch to one-shot `flee` invocation that tick (does not change persisted ai_mode). `flee_threshold` defaults to `0.20`. Player may set per companion via the combat-status panel (`[L]` per Doc #15 §5.4) `[OPEN]`.

---

## 5. Spell System

### 5.1 Eight Circles `[BG]`

| Circle | Mana Cost | Reagent Pattern (typical) | Example Spells `[BG]` |
|---|---|---|---|
| 1st | 5  | 1 reagent | In Lor (light), An Zu (sleep), Grav Por (magic arrow) |
| 2nd | 10 | 1–2 reagents | Mani (heal small), An Sanct (untrap), In Wis (locate) |
| 3rd | 15 | 2 reagents | An Tym (paralyze field), An Nox (cure poison), In Por (telekinesis) |
| 4th | 20 | 2–3 reagents | Vas Lor (great light), In Mani (heal medium), Rel Hur (wind) |
| 5th | 25 | 3 reagents | Vas Mani (great heal), In Quas Wis (clone), An Ex Por (magic lock) |
| 6th | 30 | 3–4 reagents | Vas Flam (fireball), Kal Vas Xen (summon creature), In Sanct Grav (mass paralyze) |
| 7th | 35 | 4 reagents | Vas Rel Por (gate travel), An Tym (mass freeze), In Vas Por Ylem (earthquake) |
| 8th | 40 | 4–5 reagents | In Mani Corp (resurrect), Kal Vas Flam (mass fire), Vas Por Ylem (Armageddon-class, gated) |

Reagent set verbatim `[BG]`: black pearl, blood moss, garlic, ginseng, mandrake root, nightshade, spider's silk, sulfurous ash. Each is a stackable `Entity` with `MagicComponent.is_reagent = true` (Doc #13 §1.9), stack cap 100 (Doc #15 §5.3).

Mana cost formula: `mana_cost = circle * 5` `[BR formalization of BG pattern]`. The full BR spell roster is `[OPEN]` (§13).

### 5.2 Spellbook Entity

Spellbooks are physical inventory items `[BG]`. New blank spellbooks purchasable from mage NPCs. Spells are added by combining a scroll with the spellbook (`combine` verb, Doc #13 §2).

```ts
type SpellbookComponent = {
  learned_spells:  Set<SpellId>           // [I]
  bookmarks:       SpellId[]              // [I] up to 8 quick-cast slots [BR]
  open_state:      "closed" | "open"      // [I*] open spellbook pauses combat for owner [BG]
}
```

Spellbook is just an `Entity` with `Spellbook` component plus standard `Physical`, `Ownership`, `State`. Stealable, weighable, droppable like any other item — matches Doc #4.1 simulation-coupled item rule. Loss of spellbook = loss of all spells until recovery.

### 5.3 Spell Schema

```ts
type SpellId = string                     // e.g. "in_lor", "vas_flam", "in_mani_corp"

type Spell = {
  id:              SpellId
  name:            string                 // "In Lor", "Vas Flam"
  circle:          1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  incantation:     string                 // canonical Britannian, displayed on cast
  reagents:        ReagentId[]            // multiset; duplicates = multiple of same reagent
  mana_cost:       int                    // = circle * 5
  cast_time_ms:    int                    // [BR] 500 (1st) → 3000 (8th); table in §5.5
  targeting:       "self" | "entity" | "tile" | "area"
  area_radius:     float | null           // tiles, only if targeting=area
  range:           float                  // tiles, default 12
  effect:          SpellEffect[]          // applied in order
  virtue_seed:     VirtueDelta            // base delta before per-effect/per-target adjustments
}

type ReagentId = "black_pearl" | "blood_moss" | "garlic" | "ginseng"
               | "mandrake" | "nightshade" | "spider_silk" | "sulfurous_ash"
```

### 5.4 SpellEffect Taxonomy

```ts
type SpellEffect =
  | { kind: "Damage",      damage_type: DamageType, amount: DiceExpr | int }
  | { kind: "Heal",        amount: DiceExpr | int }
  | { kind: "ApplyState",  state: StateFlag, duration_ms: int | "permanent" }
  | { kind: "RemoveState", state: StateFlag }
  | { kind: "Summon",      archetype: ArchetypeId, duration_ms: int, faction: string }
  | { kind: "Teleport",    destination: TeleportTarget }
  | { kind: "Reveal",      reveal_invisible: bool, reveal_traps: bool, radius: float }
  | { kind: "Light",       intensity: float, duration_ms: int }
  | { kind: "Lock",        target_kind: "door" | "chest" }
  | { kind: "Unlock",      target_kind: "door" | "chest", magic_lock_ok: bool }
  | { kind: "AreaFire",    radius: float, ignite_chance: float, damage: int }
  | { kind: "AreaIce",     radius: float, freeze_state: bool, damage: int }

type StateFlag = "on_fire" | "poisoned" | "wet" | "paralyzed" | "invisible"
               | "charmed" | "sleeping" | "bleeding"
```

### 5.5 Cast Flow

End-to-end sequence (mouse-driven; MCP variant identical at dispatcher):

1. Player presses `[B]` or right-clicks spellbook → `SpellbookComponent.open_state = "open"`.
2. Single-player only: `open_state == open` pauses simulation for the casting player (matches Doc #4 §7 inventory pause). Multiplayer shards: no pause (§10).
3. Player clicks an incantation in the spellbook UI.
4. Player clicks target (or self / tile / area depending on `spell.targeting`).
5. Client emits a single `cast_spell` verb invocation; server-side `VerbDispatcher` runs §2.2 contract.
6. Spellbook closes; combat resumes (single-player).

Cast time table:

| Circle | cast_time_ms |
|---|---|
| 1 | 500 |
| 2 | 750 |
| 3 | 1000 |
| 4 | 1250 |
| 5 | 1500 |
| 6 | 2000 |
| 7 | 2500 |
| 8 | 3000 |

### 5.6 Reagent Inventory Check

Reagent traversal is the same paperdoll/container traversal as Doc #15 §5.2 (cascading):

```
find_reagent(actor, reagent_type):
  1. for slot in actor.paperdoll: if entity.MagicComponent.reagent_type == reagent_type: return entity
  2. for container in actor.containers (BFS, unlimited depth):
       for item in container.contents:
         if item.MagicComponent.reagent_type == reagent_type: return item
  3. return null
```

Reagent pouches are just `Container` entities (Doc #13 §1.4) with appropriate `capacity_weight`/`capacity_volume`. Hidden reagents (in a chest in a chest in a barrel) are valid sources.

### 5.7 Scriptability Decision

> **Resolves Doc #13 §5 [OPEN] item 12 (sandbox levels for ScriptHook) for the spell case.**

Spells in Phase 1 are NOT scriptable. The spell registry is fixed C++/UE5 data, loaded at server start from `data/spells.toml`. Spells do not accept `ScriptHookComponent.on_cast` overrides. UGC spell extension (custom incantations, custom reagent combos, custom effects) is deferred to Doc #19 (UGC API v2). This deliberately scopes the §12 sandbox-level question down to "ScriptHooks for non-spell verbs only" for Phase 1.

---

## 6. Environmental Combat Interactions

Verbs interact with environmental state through the existing simulation, not via combat-specific code. The Virtue Engine reads the dispatcher's effect list and applies the env-kill rule from Doc #5 §4 (less harsh than direct murder).

| Verb invocation | Environmental Precondition | Outcome | Virtue Scoring |
|---|---|---|---|
| `cast_spell(vas_flam)` on tile | tile contains entity with `Physical.flammability > 0.3` (hay, wood, oil-soaked rag) | Tile.State.on_fire = true; fire spreads per Doc #4 §3 | Damage scoring at moment NPC enters fire tile, scored as env-kill |
| `attack(arrow)` with `arrow.State.lit = true` | hits flammable entity | `on_fire` applied to target; if target tile has flammable: ignite chain | If target is innocent NPC and dies in resulting fire: env-kill scoring |
| `throw(barrel)` of oil | barrel.fragility breaks on impact (§2.3) | Spills `oil` entity over impact tile (Doc #4.1 alchemy); `Physical.flammability = 0.95` | None until ignited |
| Subsequent `cast_spell(in_flam)` or `attack(lit_arrow)` on oil | oil tile + ignition source | Oil ignites; fire damage to all entities in tile | Env-kill for any NPC death in resulting fire (Doc #5 §4) |
| `attack(target, intent="displace")` | target adjacent to fire tile | Target shoved into fire tile; takes On Fire damage | Env-kill scoring; Honor − is small; Compassion − is reduced vs. direct murder |
| `cast_spell(in_por)` (telekinesis) on barrel into enemy | barrel weight + velocity → impact damage | Standard `throw` resolution | Same as `throw` of barrel at enemy |
| `ignite(haystack)` near sleeping enemy | hay.flammability = 1.0, enemy on adjacent tile | Fire spreads to enemy tile; enemy takes On Fire | Env-kill; if enemy is sleeping, Honor − still applies |

Env-kill multiplier (applied to Compassion/Justice negative deltas only):

```
env_kill_virtue_mult = 0.4   // [BR] env-kills score at 40% of direct-murder magnitude (Doc #5 §4)
```

Env-kills do NOT zero out negative Virtue impact — desecrating a town square by burning beggars in a fire is still a Virtue catastrophe, just smaller per kill than running them through with a sword.

---

## 7. Status Effects (State Flags)

Extends Doc #13 §1.2 `StateComponent`. Each is a sparse `[I*]` boolean (presence = active) with optional `expires_at_tick` for timed states.

| State | Onset | Tick Effect | Duration / Removal |
|---|---|---|---|
| **On Fire** | `cast_spell(vas_flam)`, fire spread, lit weapon hit, env-kill push | 5 Hits/sec damage_type=fire to entity | Removed by `wet`, by entering water tile, by `cast_spell(an_flam)` (extinguish), or by 8s timeout |
| **Poisoned** | poisoned weapon hit, `cast_spell(in_nox)`, eating poisoned food | 1 Hit/sec damage_type=poison | Removed by `cast_spell(an_nox)` (cure), by Cure potion, or by 60s timeout |
| **Wet** | water tile, rain weather, `cast_spell(in_an_flam)` (douse) | -50% incoming fire damage; +50% incoming cold damage | Removed after 30s, or instantly if entity gains `on_fire` (steam-off, then both states clear) |
| **Paralyzed** | `cast_spell(an_tym)`, paralyzing trap | Cannot invoke any verb; AI tick is noop | 10s timeout `[BG]`, or removed by damage > 10 Hits |
| **Invisible** | `cast_spell(quas_lor)` (invisibility), invisibility potion | Hostile AI cannot select as target (visible_hostiles excludes) | Broken by attacking, casting offensive spell, or 30s timeout |
| **Charmed** | `cast_spell(in_quas)` (charm), charm potion | If companion: ai_mode forced to `Protect(caster)`; if hostile NPC: faction temporarily flipped | 60s timeout, or broken by being damaged by caster |
| **Sleeping** | `cast_spell(an_zu)`, sleep gas, fatigue | Cannot act; environment_mod ×2.0 incoming damage (§3.1) | Broken by any damage, by loud sound (Doc #4 §3 propagation), or by 120s timeout |
| **Bleeding** | crit hit with slash/pierce weapon | 0.5 Hits/sec damage_type=physical | Removed by Heal spell, by bandage `combine` recipe, or by 60s timeout |

These are the exact flags referenced in Doc #13 §1.2 `StateComponent` plus the new ones (`paralyzed`, `invisible`, `charmed`, `sleeping`, `bleeding`) added as a §1.2 extension. The amendment is reflected in the `StateFlag` union in §5.4.

Tick cadence: 1 Hz simulation tick processes timed states. On Fire damage applies on each tick (5 ticks / 5 Hits per second). Removals on threshold conditions are immediate.

---

## 8. Death & Unconsciousness

```ts
on_damage(target: Entity, dmg: int):
  target.State.hp -= dmg
  if target.State.hp <= 0:
    if target.State.hp > -10:
      target.State.unconscious = true
      schedule_event(at = now + 30s, kind = "unconscious_to_dead", target = target.id)
    else:
      // overkill: skip unconscious
      die(target)
```

| Event | Trigger | Outcome |
|---|---|---|
| **Unconscious** | hp drops to (0, -10] | `target.State.unconscious = true`; cannot act for 30s; ANY heal restores consciousness; if not healed in 30s → die |
| **Dead** | hp ≤ -10 OR 30s post-unconscious without heal | Spawn corpse `Entity` per Doc #15 §3.7 (companion 60s claim window applies for companions; non-companion NPC corpse rules `[OPEN]` per Doc #13 §5 item 2 — partially carried forward) |
| **Avatar death** | Avatar.State.hp ≤ -10 | Triggers Doc #15 §4.1 respawn flow (Lord British's chamber single-player, nearest meditated shrine multiplayer) |
| **Resurrection** | `cast_spell(in_mani_corp)` on corpse OR Healer spawned by Ankh of Renewal (Doc #15 §4.2) | Corpse → live entity at full Hits = STR; permadeath-locked companions reject |

Corpse decay timer per Doc #4.1 §3.1 / Doc #13 §1.2. Resurrect-on-decayed-corpse fails with `ERR_INVALID_TARGET`.

---

## 9. Combat AI for Hostile NPCs

Hostile NPCs (rats, brigands, undead, monsters) are not `Companion` — they have a separate component:

```ts
type HostileComponent = {
  aggression_radius:   float          // [A] tiles; trigger Idle → Aware
  pack_behavior:       bool           // [A] if true, alerting one alerts pack within 8 tiles
  flee_threshold_hits: float          // [A] 0.0–1.0; trigger Engage → Flee
  preferred_target:    "nearest" | "weakest" | "avatar"   // [A]
  state:               "Idle" | "Aware" | "Engage" | "Flee"   // [I*]
  alert_target:        EntityId | null                          // [I*]
}
```

State machine (ticks at 500ms with `CompanionAI`, but invokes verbs as caller `{kind: "AI", npc: id}` per Doc #13 §4):

```
Idle:
  if any potential_target within aggression_radius with LOS:
    state = Aware; alert_target = that target
    if pack_behavior: alert pack neighbors within 8 tiles
Aware:
  pathfind toward alert_target until within weapon range
  → Engage
Engage:
  if hp / hp_max < flee_threshold_hits: state = Flee
  else: invoke attack(self, alert_target, equipped_weapon)
Flee:
  invoke flee(self) (§2.5)
  if no hostiles within 12 tiles for 5s: state = Idle
```

Spawning rules (placement of hostile NPCs in regions, respawn cadence) are deferred to Doc #18 (Encounter Design) and Doc #8 (Procedural Generation §3 already covers procedural-region spawn density).

---

## 10. Multiplayer Combat

> **Resolves Doc #13 §5 [OPEN] item 14 (combat pause semantics under multiplayer).**

| Mode | Pause-on-inventory? | Pause-on-spellbook? | Player attackable while inventory open? |
|---|---|---|---|
| Single-player | Yes (full simulation pause) | Yes | N/A |
| Private instance (1–2 players co-op) | Yes (consensus pause; either player opening inventory pauses all) | Yes | No |
| Persistent shard (3–8 players) | **No** | **No** | **Yes** — opening inventory does NOT pause shared simulation `[BR]` |
| Chaos shard | **No** | **No** | **Yes**, plus PvP enabled |

Rationale: pause-on-inventory is a single-player fidelity feature. In persistent shards it would create griefing vectors (open-inventory invulnerability cheese, action lockout for nearby players). The simulation continues; the player's UI is paused locally but the avatar remains a valid attack target. Spellbook open in shards does not interrupt enemy attacks; the casting player must time the cast or move to safety.

Companion AI continues ticking regardless of UI state in shards. In single-player and private instances, companion AI is paused alongside the simulation pause.

---

## 11. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by `avatar.full` capability unless noted.

### 11.1 New Tools

| Tool | Capability | Envelope Notes | Mutates |
|---|---|---|---|
| `defend` | `avatar.full` | `actor_id` (must equal `session.avatar_id` or be a companion of session avatar) | Sets `Combat.stance = Defensive` for 5s. |
| `flee` | `avatar.full` | `actor_id` | Sets `Combat.stance = Fleeing`; engages flee pathfinding (§2.5). |
| `learn_spell` | `avatar.full` | `spellbook_id`, `scroll_id` | Wraps `combine(spellbook, scroll)`; on success, scroll consumed and `Spellbook.learned_spells` gains spell. May fail if scroll's spell is already known. |
| `set_flee_threshold` | `avatar.full` | `companion_id`, `threshold: float` (0..1) | Updates `CompanionPolicy.flee_threshold` `[OPEN]` per §4. |

### 11.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/spellbook/{entity_id}/known_spells` | list of `SpellId` known + their reagent/mana costs | `inspect.read`, must be a spellbook owned by `session.avatar_id` |
| `forge://shard/{s}/region/{region}/combat_state` | active engagements: `[{actor, target, weapon, started_at_tick}]`; aggressors_radius applied | `inspect.read`, scoped to bound shard |
| `forge://shard/{s}/avatar/{id}/combat` | stance, current target if any, last damage dealt/received, on-cooldown abilities | `inspect.read` for OWN avatar only |

### 11.3 Existing Tool Clarifications

- `attack` (Doc #14 §5.8): adds optional `intent: "strike" | "displace"` to envelope per §2.1. Default `"strike"` preserves existing behavior.
- `cast_spell` (Doc #14 §5.9): clarified to require `spellbook_entity_id` implicit (server resolves from actor's paperdoll/inventory tree); explicit override allowed if multiple spellbooks present.
- `throw` (Doc #14 §5.10): impact damage now follows §2.3 formula; existing fragility/ignition behavior unchanged.

---

## 12. Phase 1 Prototype Scope

Per Doc #11 (12-week "Britain Alive") and Doc #15 §8.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Combat verbs | `attack` (melee weapons only), `defend` | `cast_spell`, `throw`, `flee` (verb plumbed but no flee AI) |
| Hostile NPCs | 3 archetypes in Cave of Trials: rat, skeleton, brigand | All other monsters, pack behavior, faction warfare |
| AI modes | 2 wired up: `Manual`, `AttackNearest` | Modes 3–10 |
| State effects | `On Fire`, `Poisoned` only | Wet, Paralyzed, Invisible, Charmed, Sleeping, Bleeding |
| Damage model | Full §3 formula, all 6 damage_types in schema, but only physical/fire/poison actually used | Cold, magic, holy live but unutilized |
| Resistances | `Combat.resistances` field present; populated only on skeleton (physical 0.5) | Other archetypes get default empty map |
| Pause semantics | Single-player pause-on-inventory enabled | Multiplayer combat disabled in vertical slice (matches Doc #15 §8 — no MP combat in Phase 1) |
| Death | Hits = 0 → unconscious 30s → dead → corpse | Resurrection (Ankh, Resurrect spell) per Doc #15 §8 |
| Spellbook | Schema present; one literal Mage NPC with for-sale spellbooks; no actual casting | `cast_spell` verb, scroll learning, all 8 circles |
| Reagents | All 8 reagents exist as items, stealable, weighable; no active spell consumption | Reagent consumption in casts |
| MCP | None of §11 tools required for Phase 1 (per Doc #14 §8 already restricts MCP to `examine`/`use`) | All §11 tools and resources deferred to Phase 2 |

Phase 1 success metric: a player can enter Cave of Trials with Iolo (set to `AttackNearest`) and Shamino (set to `Manual`), engage three brigands, take poisoned-arrow damage, drink a cure potion (uses §7 RemoveState path via `use` verb on potion), kill one brigand directly (Valor +, Compassion −), kill another by knocking him into the burning brazier with `attack(intent=displace)` (env-kill scoring confirmed at 40% of direct-murder magnitude), and witness a third brigand die to On Fire DoT after Iolo's torch ignited him.

---

## 13. Open Questions

1. `[OPEN]` **Full BR spell roster.** §5.1 lists circles + canonical examples only. BG had ~50 spells; SI added several more. The full BR spell table (every SpellId, its `incantation`, `reagents`, `effect[]`, `range`, `cast_time_ms`, `virtue_seed`) needs a design pass. Reagent-cost balancing is the critical gate.
2. `[OPEN]` **Weapon durability formula.** Doc #13 §1.2 has `durability: int`. Per-swing decrement function, repair rules at blacksmiths, and breakage thresholds unspecified. SI made durability visible in the paperdoll tooltip; BR should do the same `[SI]` but the rate is `[OPEN]`.
3. `[OPEN]` **Area-effect spell tile geometry.** §5.4 `AreaFire` / `AreaIce` take a `radius: float`. Tile mask for non-circular AoE (cone, line, ring) not defined. Ring-of-fire and lightning-bolt-line spells will require a `tile_mask: TileMask` extension.
4. `[OPEN]` **Charmed in PvP shards.** §7 says Charmed NPC's faction temporarily flips. On a Chaos / PvP-enabled shard, can `cast_spell(in_quas)` charm another player's Avatar? If yes, what's the consent / opt-out model? If no, what's the rejection error? Affects Doc #6 PvP rules.
5. `[OPEN]` **MCP cast_spell in single-player offline mode.** A `cast_spell` MCP call in single-player triggers pause-on-spellbook. If the MCP client is asynchronous and slow to respond after opening the book, the simulation pauses indefinitely waiting for the cast invocation. Need a server-side timeout (cancel cast if no follow-through within Ns) and a client-visible feedback hook.
6. `[OPEN]` **Holy damage source.** §3 lists `holy` damage_type. No spell, weapon, or in-game source produces it in the BG/SI canon directly (paladins use blessed weapons via enchantment, not damage type). Either remove from enum or define a spell/blessing that produces it. Affects §3.1 row "Holy damage on `is_sacred=true` actor turned undead" which already references the type.
7. `[OPEN]` **Companion `flee_threshold` per-companion override surface.** §4 mentions player-set override via combat-status panel `[L]`; the UI control is unspecified, and §11.1 introduces `set_flee_threshold` MCP tool — but the keyboard/UI mapping in-engine is `[OPEN]`.
8. `[OPEN]` **Berserk + auto-flee interaction with player-cast Sleep.** §4 says Berserk never invokes flee. If a friendly Mage casts `An Zu` on a Berserk companion to save them from overkill, does Sleeping override Berserk's no-flee invariant? Most likely yes (Sleeping overrides all behavior), but worth ratifying.
9. `[OPEN]` **Spell interruption damage threshold.** §2.2 step 6 says taking damage interrupts a cast. All damage, or above a threshold? `[BG]` was all-damage; this trivializes high-circle casts in any mob fight. Suggest threshold = 5 Hits `[BR]` but flag.
10. `[OPEN]` **Unconscious entity attackability.** §8 makes unconscious distinct from dead (30s window). Can an enemy attack an unconscious target and finish them off? If yes, scored as Honor − (sleeping target ×2.0 modifier per §3.1 already covers it mechanically). If no, an unconscious player on a Chaos shard is invulnerable for 30s — exploitable. Suggest yes-attackable on Chaos, no-attackable on Virtue, `[OPEN]` for Classic.
11. `[OPEN]` **Pack behavior alert propagation cap.** §9 `pack_behavior` alerts pack within 8 tiles. No cap on chained alerts (a pack member alerts another, who alerts another). Could cascade across an entire dungeon. Need a max-hop or alerted-set BFS cap.
12. `[OPEN]` **Two-handed weapon and shield interaction.** Doc #15 §5.1 says two-handed weapons occupy both `left_hand` and `right_hand`. §3 damage formula assumes one weapon. What is `weapon_base` for two-handers — published as 1.5× single-hand baseline `[BR]`? Confirm.

---

## 14. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #2 §4.3, Doc #4 §7, Doc #5 §4 |
| §2 Verb Contracts | Doc #13 §2 (verb registry), Doc #13 §4 (dispatch invariant), Doc #14 §5.8/5.9/5.10 |
| §3 Damage Model | Doc #13 §1.8 (CombatComponent), Doc #15 §2.1 (Hits derivation) |
| §4 AI-Mode Dispatch | Doc #15 §3.3 (10 SI modes), Doc #13 §4 (caller=AI invariant) |
| §5 Spell System | Doc #13 §1.9 (MagicComponent), Doc #13 §1.4 (Container traversal), Doc #15 §5.2 (cascading), Doc #4.1 (reagents as items) |
| §6 Env Combat | Doc #4 §3 (fire/water/sound), Doc #5 §4 (env-kill rule) |
| §7 Status Effects | Doc #13 §1.2 (StateComponent), Doc #4 §3 (state propagation) |
| §8 Death | Doc #15 §3.7 (corpse + companion claim), Doc #15 §4 (resurrection), Doc #4.1 §3.1 (decay) |
| §9 Hostile AI | Doc #13 §1.5 (Schedule for non-combat NPCs), Doc #8 §3 (procedural spawn), Doc #18 (deferred) |
| §10 MP Combat | Doc #6 §2 (shard types), Doc #14 §4 invariant 4 (shard binding) |
| §11 MCP Surface | Doc #14 §5 (tool envelope), §6 (resources), §3 (capabilities) |
| §12 Phase 1 | Doc #11 (vertical slice), Doc #14 §8, Doc #15 §8 |
| §2 client/server boundary | Doc #41 (Engine & Stack ADR — Rust authoritative; GAS forbidden; UE5/TS as dumb views consuming Protobuf resolution events) |

### Resolved Doc #13 [OPEN] Items

- **§5 item 12 (sandbox levels for ScriptHook)** — partially resolved for spells: spells are NOT scriptable in Phase 1, fixed registry only. ScriptHook sandbox question for non-spell verbs remains open.
- **§5 item 14 (combat pause semantics in multiplayer)** — fully resolved: pause-on-inventory and pause-on-spellbook are single-player and private-instance only. Persistent shards do not pause; Avatar remains attackable with inventory open.

---

End of Document #16.
