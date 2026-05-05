Document #15: Character, Party & Inventory
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Player Systems Lead]
Status: Living Technical Reference — Normative spec for Avatar genesis, party state, paperdoll, inventory, and the ownership/witness model

Depends on: #2 GDD (pillars), #4 Simulation, #4.1 Crafting, #5 Virtues, #6 Persistent World, #11 Prototype Scope, #13 Core Schema (Entity/Verb/Scope), #14 MCP Surface.

Source heritage tags used throughout: `[SI]` = mechanic taken from *Ultima VII Part Two: The Iron Marches* (1993). `[U4]` = mechanic taken from *Ultima IV: Quest of the Avatar* (1985). `[BG]` = mechanic taken from *Ultima VII: The Black Gate* (1992). `[BR]` = original to Project Virtue.

---

## 0. Design Philosophy

Project Virtue is the *Black Gate* storyline played on a *The Iron Marches*-grade chassis with a *Quest of the Avatar* moral spine. From `[SI]` we adopt the expanded 13-slot paperdoll, the 10 canonical combat AI modes, the Hourglass-of-Fate-style companion resurrection, and the explicit `owner` tag on every item. From `[U4]` we restore the gypsy virtue-question character generator, because the Eight Virtues are our pillar (Doc #5) and SI's stat-only genesis is the regression we will not inherit. From `[BR]` we add what neither game shipped: persistent Avatar identity bound to a shard (Doc #6 §3), party-permission rules between human Avatars, anti-griefing constraints on companion AI, virtuous-act XP, and a single-dispatcher witness model for theft (Doc #13 §4) that resolves four open items in Doc #13. We do not propose returning to BG's narrower paperdoll, and we do not propose importing BG saves into BR.

---

## 1. Character Generation Flow

Single canonical genesis path. No save import from any prior Ultima `[SI]`.

| Step | Input | Output | Notes |
|---|---|---|---|
| 1. Identity | Avatar name (24 char max — extended from SI's 14 `[BR]`), portrait pick | `avatar_id`, `display_name`, `gender` (bundled into portrait `[SI]`) | Portrait is the gender selector; no separate gender prompt. |
| 2. Gypsy questions `[U4]` | 7 paired-virtue dilemmas | `class_skew`, seeded `VirtueReputation` | See §1.2. Drives both starting class and starting Virtue scores. |
| 3. Stats | derived from `class_skew` | STR, DEX, INT, Combat, Magic (1–30 `[SI]`), Hits, Mana | See §2. No point-buy in Phase 1. |
| 4. Starting kit | derived from `class_skew` | populated `paperdoll`, starting backpack | See §1.4. |
| 5. Shard binding `[BR]` | `shard_id` | persistent record under `VirtueReputation` scope | Immutable for the Avatar's life. See §1.5. |

### 1.1 Avatar Identity

```ts
type AvatarId = u64
type Gender = "male" | "female"

type AvatarIdentity = {
  avatar_id:    AvatarId          // server-assigned at genesis
  display_name: string            // <= 24 chars, unicode, unique within shard
  portrait_id:  PortraitId        // gender bundled [SI]
  gender:       Gender            // derived from portrait_id, immutable
  shard_id:     ShardId           // bound at genesis, immutable [BR]
  created_at:   Timestamp
}
```

### 1.2 Gypsy Virtue Questions `[U4]`

Restored from *Ultima IV*. The gypsy presents 7 paired-virtue dilemmas. Each dilemma forces a binary choice between two of the Eight Virtues (Doc #5 §2). The aggregate result determines:

1. **Starting class skew** — the Virtue most often chosen maps to one of eight classes (one per Virtue, matching U4):

   | Virtue | Class | Stat Skew | Starting Weapon |
   |---|---|---|---|
   | Truth | Mage | INT/Magic | Dagger + spell book |
   | Mercy | Bard | DEX/INT | Rapier + lute |
   | Courage | Fighter | STR/Combat | Longsword |
   | Justice | Druid | INT/Magic | Quarterstaff |
   | Devotion | Tinker | DEX | Crossbow + tools |
   | Honor | Paladin | STR/Combat/Magic | Mace + shield |
   | Insight | Ranger | DEX/Combat | Bow |
   | Humility | Shepherd | balanced low | Sling |

2. **Starting Virtue scores** — each of the 8 Virtues seeded in `[50, 60]` with a positive bias toward Virtues the player chose (chosen Virtue +5, rejected Virtue -2 from baseline 55). Result is written under the `VirtueReputation` persistence scope at genesis (Doc #6 §3).

**Sample question (canonical form from U4):**

> *Thou hast been prohibited by thy absent Lord from joining thy friends in a close-fought battle. Dost thou*
> *(a) refuse to join thy friends, since thou wast forbidden to do so? — VALOR vs HONOR → choice = HONOR*
> *(b) join thy friends in spite of thy Lord's specific orders? — VALOR vs HONOR → choice = VALOR*

The full set of 7 gypsy questions for Project Virtue is `[OPEN]` (§10). U4's original 7 are the heritage reference but copy must be re-authored.

### 1.3 Stat Assignment

Stats are assigned, not point-bought, in Phase 1. Range 1–30 `[SI]`. Class skew biases the roll; baseline is 8 in each stat with `class_skew` adding +4 to one primary, +2 to one secondary.

```ts
type Stats = {
  str:     int   // 1..30 [SI]
  dex:     int   // 1..30
  int:     int   // 1..30
  combat:  int   // 1..30 (secondary, trainable)
  magic:   int   // 1..30 (secondary, trainable)
}

derive_hits(s: Stats, level: int): int  =  s.str + (level * 5)             // [BR formula]
derive_mana(s: Stats, level: int): int  =  s.int + s.magic + (level * 3)   // [BR formula]
```

The Avatar does *not* start with INT and Magic at maximum (SI's default `[SI]`). In BR the gypsy questions decide the skew, so a Fighter Avatar legitimately starts low-INT.

### 1.4 Starting Equipment

Each class's starting kit is hardcoded, populates the paperdoll directly (§6), and grants 50 gp + 1 ration of bread + 3 torches in the backpack. Reagent-using classes (Mage, Druid, Paladin) get a starting reagent pouch with 5 of each cantrip-tier reagent (garlic, ginseng, mandrake, sulfurous ash). Specifics live in `data/starting_kits.toml`; the data table is `[OPEN]` until art assets are locked.

### 1.5 Persistent-Shard Binding `[BR]`

The act of completing genesis writes `AvatarIdentity` plus the seeded `VirtueReputation` row to the shard's persistence layer (Doc #6 §3, scope = `VirtueReputation`, owner_key = `avatar_id`). This row is the canonical Avatar identity. It cannot be re-rolled in place. A "new Avatar" reset (Doc #5 §3) destroys the row and forces fresh genesis; this matches U4's monk-of-the-Codex semantics. There is no Black Gate save import path `[SI]`.

Cross-shard Avatar identity: a single human player MAY hold one Avatar per shard, but each Avatar's `VirtueReputation` row is shard-local. Doc #13 §5 [OPEN] item 7 (cross-shard reputation leak) is *not* resolved here; we deliberately scope this doc to per-shard genesis.

---

## 2. Stat & Progression Model

### 2.1 Trainable Stats

```ts
type TrainableStat = "str" | "dex" | "int" | "combat" | "magic"
const STAT_CAP: int = 30   // [SI]
```

| Stat | Trained At | Effect |
|---|---|---|
| STR | Combat trainers (Highmere barracks, etc.) | Hits, melee damage, carry weight |
| DEX | Thieves' guild, ranger lodges | Hit chance, dodge, stealth checks |
| INT | Lycaeum sages | Mana pool, spell tier unlocks |
| Combat | Combat trainers | Hit chance, weapon proficiency |
| Magic | Magic trainers | Spell efficacy, mana regen rate |

### 2.2 Leveling

| Property | Value | Source |
|---|---|---|
| Level cap | **8** | Matches BG/SI vanilla `[SI]`. Silver Seed's level 9 not adopted. |
| Training points per level | **3** | Verbatim `[SI]`. |
| Training point cost at trainer | 100 gp × current stat value | `[BR]` — replaces the SI flat fee to give late-game gold a sink. |
| XP sources | combat kills, quest milestones, virtuous acts `[BR]` | See §2.3. |
| XP curve | doubling per level: 100, 200, 400, 800, 1600, 3200, 6400, 12800 | `[BR]` |

### 2.3 XP Award Rules

Awarded by `VerbDispatcher` (Doc #13 §4) as a side-effect channel post-write, immediately after Virtue scoring, before persistence:

```ts
type XpEvent =
  | { kind: "kill",   target_archetype: ArchetypeId, level_delta: int }
  | { kind: "quest",  quest_id: string, tier: 1|2|3 }
  | { kind: "virtue", virtue: Virtue, magnitude: int }   // [BR]

xp_award(e: XpEvent): int = match e with
  | kill   -> 10 * max(1, target_level - actor_level + 3)
  | quest  -> [50, 200, 500][tier - 1]
  | virtue -> 2 * magnitude        // virtuous-act XP, cite Doc #5 §2
```

The `virtue` source is the BR addition. Rationale (Doc #5 §1): if every action has moral weight, then virtuous progression must be a first-class advancement axis, not a side reward. A pacifist Shepherd can hit level 8 without a single kill.

### 2.4 Skill Atrophy (Persistent Shards Only) `[BR]`

Resolves the "veterans permanently dominate the economy" risk noted in Doc #6 §5. Single-player shards exempt.

```ts
ATROPHY_INTERVAL_DAYS:    int   = 30
ATROPHY_DELTA_PER_TICK:   int   = 1
ATROPHY_MAX_LOSS_PERCENT: float = 0.50  // floor at 50% of trained value
ATROPHY_AFFECTS:          TrainableStat[] = ["combat", "magic"]
```

Atrophy applies only to Combat and Magic (the post-genesis trainable secondaries). STR/DEX/INT are not eroded by inactivity. Atrophy is fully recoverable by spending one training-point session at a trainer, regardless of how much was lost.

---

## 3. Party Management

### 3.1 Party Limits

| Mode | Max Party Size | Source |
|---|---|---|
| Single-player | 4 | Matches BG/SI |
| Cooperative multiplayer | 8 | Matches Doc #6 §4 |
| PvP / Chaos shard | 8 | Matches Doc #6 §4; permadeath rule §5 applies |

### 3.2 Companion Schema

Companions are standard `Entity` instances (Doc #13 §1) with `Schedule` (#13 §1.5) plus a new sub-component:

```ts
type CompanionPolicy = {
  ai_mode:                CombatAiMode      // §3.3
  obey_player_id:         AvatarId          // [BR] which Avatar this companion follows in MP
  permadeath_locked:      bool              // [SI] story-flagged sacrifices
  inventory_share_policy: enum {
    Open,           // any party member may take
    OwnerOnly,      // only obey_player_id may take
    AskFirst        // [BR] dispatcher emits a pending-trade event
  }
  witness_enabled:        bool              // [BR] true in BR; differs from SI default false
  soulbound_destruct_on_death: bool         // §4 ownership transfer rule
}
```

The companion entity itself is bound by `PersistenceScope = WorldState` for its NPC schedule and `PlayerInventory` for items in its paperdoll while in the party (Doc #13 §3).

### 3.3 Combat AI Modes (10 canonical, verbatim `[SI]`)

| # | Mode | Behavior |
|---|---|---|
| 1 | Manual | Player issues every action; companion holds otherwise. |
| 2 | Attack Nearest | Engage nearest hostile; default for new companions. |
| 3 | Attack Weakest | Target the lowest-HP hostile in range. |
| 4 | Attack Strongest | Target the highest-threat hostile in range. |
| 5 | Defend | Stay in melee range of the obey_player; intercept threats to them. |
| 6 | Berserk | Attack any hostile, ignore self-preservation. |
| 7 | Flee | Move away from hostiles; do not attack. |
| 8 | Random | Pick a hostile at random per engagement. |
| 9 | Protect | Stay in melee range of a designated party member; intercept threats to them. |
| 10 | Flank | Move to attack from rear/side arcs; coordinate position. |

Mode is set per-companion via `set_combat_mode` (§8). Mode persists with the companion entity.

### 3.4 Permadeath Locks `[SI]`

Companions flagged `permadeath_locked = true` cannot be resurrected by any means, including the Ankh of Renewal (§5). BR mirrors SI's Boydon (any death) and Bron (Wall of Lights only) precedents. BG-equivalent candidates: Spark (if the BG storyline's tragic Stonereach-orphan death is preserved) and Tseramed (if the Forest of Blackford arc retains its ranger devotion). Final list `[OPEN]`.

### 3.5 Real-Time Follow + Per-Companion Override

Companions follow `obey_player_id` in formation by default (Doc #2 §4.1). `[L]` opens the per-companion combat status panel; from there each companion's `ai_mode` is independently settable. `[F]` triggers the SI-style `feed party` action: dispatcher consumes 1 ration per companion from any open inventory.

### 3.6 Multiplayer Party Rules `[BR]`

| Rule | Behavior |
|---|---|
| Invite | `party.invite(target_avatar_id)` — both Avatars must be in the same region. |
| Leave | Always permitted; companion entities remain bound to their original `obey_player_id`. |
| XP cap on shared kills | Group-shared XP is divided evenly, then capped at 1.5× the solo award to prevent power-leveling via a high-level escort. |
| Group reputation | Per Doc #6 §4: party Virtue events score against every member, scaled by their proximity at the time of action (within 30m = full, 30–100m = half, beyond = none). |
| Inter-Avatar trade | Side-by-side paperdoll dialog (§6.4). Dispatched via `VerbDispatcher.trade()`. |
| PvP-allowed shards | Inter-Avatar item transfer outside the trade dialog is `theft-distinct` — flagged as `Stolen` (`OwnershipComponent.acquired_via`). |

### 3.7 Companion Death — Inventory Transfer `[BR]`

> **Resolves Doc #13 §5 [OPEN] item 2** (NPC ownership transfer on death) for the companion case.

On companion death, the companion's paperdoll and backpack contents become a `Container` entity (the corpse) with state:

1. For **60 seconds**, contents are flagged `party-claimable`. Any party member may `drag` from the corpse without triggering theft (no Truth/Justice loss, no witness check). `OwnershipComponent.owner` flips to the claiming player on transfer.
2. After 60s, the corpse's `OwnershipComponent.owner` flips to `World`. Anyone may loot; non-party looters are unaffected by Virtue weights (the item is now genuinely unowned — distinct from the BG "looting a dead innocent" case, which still scores).
3. Items with `OwnershipComponent.bound = true` AND `CompanionPolicy.soulbound_destruct_on_death = true` are destroyed if not retrieved within the 60s window. This is how BR handles oath-bound artifacts (Sacred Quest items, etc.).
4. The corpse entity itself follows the standard `decay_timer` per Doc #4 §3.1.

The general non-companion NPC case (a slain shopkeeper) is intentionally left to a future doc — the parameters above are tuned for party-member loss specifically.

---

## 4. Death, Resurrection, Redemption

### 4.1 Avatar Death

| Mode | Respawn Location | Penalty |
|---|---|---|
| Single-player | Lord Avermere's chamber, Castle Avermere | Hits = 1, equipment intact, no XP loss |
| Multiplayer (Virtue/Classic shard) | Nearest shrine the Avatar has ever meditated at | Hits = 1, -5 to all Virtues (recoverable, see §4.4) |
| Multiplayer (Chaos shard) | Nearest shrine | Hits = 1, -5 Virtues, **AND** drop a random 1d3 inventory items as a corpse-container at death point (lootable by anyone) |

### 4.2 Companion Resurrection

Two paths, both via `VerbDispatcher` (Doc #13 §4):

**(a) Ankh of Renewal `[BR]`** (BR's rename of SI's Hourglass of Fate `[SI]`):

```ts
type AnkhOfRenewal = {
  archetype: "item.quest.ankh_of_renewal"
  uses: int                  // [I] limited charges, refilled at any shrine
  on_use: ScriptRef          // summons a Healer NPC at Avatar's location
}
```

Use action: spawns a Healer NPC archetype within 5m, who walks to the nearest dead-companion corpse and casts Resurrect on it. Permadeath-locked companions (§3.4) reject the spell with a scripted lament. The Healer despawns after 60s.

**(b) Resurrect spell** (8th Circle, `In Mani Corp`, reagents: garlic + ginseng + spider's silk + sulfurous ash, verbatim `[SI]`). Standard `cast_spell` verb (Doc #14 §5.9). Requires intact corpse (entity must still exist; if `decay_timer` expired, target is invalid).

### 4.3 Permadeath Cases

| Case | Cause | Recovery |
|---|---|---|
| Story-devotion companions | `CompanionPolicy.permadeath_locked = true` triggered by quest script | None |
| Chaos-shard companion kill | Companion dies while in a region tagged `chaos_zone = true` | None |
| Boydon-equivalent assembled companions | If BR includes any (`[OPEN]`, §10) | None (mirror SI Boydon rule) |

### 4.4 Redemption Path (Doc #5 §5)

| Path | Effect |
|---|---|
| Shrine pilgrimage | Visit all 8 shrines and `meditate` at each → +1 to every Virtue per completed pilgrimage circuit (cooldown: one circuit per in-game month). |
| Atonement quest | Per-Virtue scripted quest that restores up to +20 in the targeted Virtue. |
| Memorial Quest `[BR]` | For each permadeath-locked companion lost, a per-companion scripted quest grants +5 Devotion. Cannot resurrect the companion. |

---

## 5. Inventory & Paperdoll

### 5.1 The Expanded Paperdoll `[SI]`

Adopted verbatim from The Iron Marches, with two BR corrections to documented SI bugs.

| # | Slot | Type | Notes |
|---|---|---|---|
| 1 | Head | armor | Helms, hats, circlets. |
| 2 | Neck | jewelry | Amulets, holy symbols. |
| 3 | Earrings | jewelry | `[SI]` slot, new vs BG. Serpent Earrings, etc. |
| 4 | Torso | armor | Plate, chain, robes, leather. |
| 5 | Cloak | armor | `[SI]` slot. Fur cloaks for polar zones, magical cloaks. |
| 6 | Back | utility | `[SI]` expanded — slung weapon, shield, bedroll, OR backpack. |
| 7 | Belt | utility | Pouches, scabbards. Quick-access stack. |
| 8 | Left Hand | weapon | Primary weapon. Two-handed weapons occupy both hands. |
| 9 | Right Hand | weapon/shield | Shield or secondary weapon. **BR fix**: weapons in right hand DO swing in combat (SI bug repaired). |
| 10 | Hands | armor | Gauntlets. **BR fix**: rings live in slot 11 (Rings) when no gauntlets are worn — see below. |
| 11 | Rings | jewelry | `[BR]` slot — promoted to its own slot to fix SI's awkward "rings live in Hands when no gauntlets" toggle. Up to 2 rings. |
| 12 | Legs | armor | Greaves, leggings. |
| 13 | Feet | armor | Boots, shoes. |
| 14 | Quiver | utility | `[SI]` relocated. Holds arrows/bolts; auto-feeds bow/crossbow. |

That's 14 slots — SI's 13 plus the BR Rings slot. The Hands slot now holds gauntlets only.

```ts
type EquipSlot =
  | "head" | "neck" | "earrings" | "torso" | "cloak" | "back" | "belt"
  | "left_hand" | "right_hand" | "hands" | "rings" | "legs" | "feet" | "quiver"

type Paperdoll = Partial<Record<EquipSlot, EntityId>>
// Two-handed weapons set both left_hand and right_hand to the same EntityId.
// rings slot resolves to a stack of up to 2 ring EntityIds.
```

### 5.2 Container Nesting & Cascading

Container nesting depth: **unlimited** `[SI]`. Dual constraint (weight in stones, volume/bulk) enforced at every level `[SI]`.

> **Resolves Doc #13 §5 [OPEN] item 10** (container weight/volume cascading).

| Property | Cascades? | Rule |
|---|---|---|
| `weight` | **Yes**, to all ancestors | A child container's total weight (its own + contents) propagates to its parent's `weight` field. The Avatar's carry-weight check sums the full tree. |
| `volume` (bulk) | **No** past one level | A container's `volume` is measured against its parent only, not propagated. Rationale: a chest of bags should not double-count bulk. The bag fills the chest's volume, but the bag's contents fill the bag's own volume budget independently. |

This matches the realistic-weight / abstract-volume split that SI used in practice but never documented.

### 5.3 Stacking Rules

| Item Type | Stacks? | Stack Cap | Notes |
|---|---|---|---|
| Gold | yes | unlimited | Single stack per container. `[SI]` |
| Reagents | yes | 100 per stack | Per reagent type. `[SI]` |
| Arrows / bolts | yes | 100 per stack | `[SI]` |
| Food (non-perishable: cheese, bread) | yes | 20 per stack | `[SI]` |
| Food (perishable: meat, fish) | no | 1 each | Per Doc #4.1 §3.1; each instance has its own `decay_timer`. |
| Torches | yes | 10 per stack | Lit torches do NOT stack. `[SI]` |
| Potions | no | 1 each | Each has own enchantment instance. |
| Quest items | no | 1 each | `OwnershipComponent.bound = true` typical. |

### 5.4 Mouse & Keyboard Conventions `[SI]`

| Input | Action |
|---|---|
| Left-click | examine |
| Double-left | use / talk / attack / open (context-dependent on target) |
| Right-click | step (movement; `[SI]` convention) |
| Drag | move / equip — drop on slot equips, drop on container places, drop on companion paperdoll opens trade |
| Right-click on item in inventory | context menu (resolves to `right_click(action_id)` per Doc #14 §5.7) |
| `[I]` | toggle inventory |
| `[Z]` | toggle stats panel |
| `[L]` | toggle combat-status panel (party AI modes) |
| `[F]` | feed party (consumes 1 ration per member) |

### 5.5 Trade Dialog

Trade between two Avatars or between an Avatar and a companion opens a side-by-side paperdoll dialog `[SI]`. Both sides drag items into a shared "offer" tray. Either party may cancel. On confirm, all items move atomically (Doc #14 §5 envelope guarantees idempotency via `client_op_id`). Partial trades are not possible — all items move or none do.

```ts
// Renamed from `TradeOffer` to disambiguate from the canonical player-to-player
// `TradeOffer` declared in #18 §9.1. This record describes the simpler
// companion-trade dialog state (party-internal item move); the #18 §9.1 record
// is the full two-phase TradeSession offer payload.
// [OPEN — verify no external references]
type CompanionTradeOffer = {
  from_avatar:   AvatarId | EntityId  // companion as EntityId
  to_avatar:     AvatarId | EntityId
  items_offered: EntityId[]
  gold_offered:  int
  status:        "pending" | "confirmed" | "cancelled"
}
```

Backed by `VerbDispatcher.trade()` (Doc #13 §2 verb registry). Player-to-player trade uses the canonical `TradeOffer` + `TradeSession` from #18 §9.1.

### 5.6 Notable Item Categories the System Must Support

| Category | Example | Required Mechanics |
|---|---|---|
| Usable plot items | Ankh of Renewal `[BR]` | `on_use` script, charge counter |
| Gate-travel keys | Serpent Jawbone analog (BR's name `[OPEN]`) | Triggers a travel verb when used at a gate node |
| Bound items | Avatar's wedding ring | `OwnershipComponent.bound = true`, refuses transfer |
| Magical equipment with passive effects | Belt of Strength `[SI]` (Silver Seed precedent) | `MagicComponent.enchantments[]`, applied while equipped |
| Alchemical reagents | mandrake root | `MagicComponent.is_reagent = true`, stackable |
| Perishable food | venison | `decay_timer` per Doc #4.1 §3.1 |
| Region-gated equipment | Fur cloak (polar zones) `[SI]` | `on_tick` script reads region temperature, applies penalty if absent |

The Black Sword's soul-prism gem and the 23 Serpent Candle variants (per the SI research) are storyline-specific to *The Iron Marches*; BR carries them only as schema validators — proof that the inventory model handles complex multi-state plot items.

---

## 6. Ownership, Theft & Witnesses

> **Resolves Doc #13 §5 [OPEN] item 4** (witness model for stealing).

### 6.1 Ownership Tag

Per Doc #13 §1.3, every entity already carries `OwnershipComponent.owner: Owner`. BR specifies the witness model that turns this tag into gameplay.

### 6.2 Steal Verb Resolution

`VerbDispatcher.steal()` is invoked implicitly when a `drag` verb moves an entity whose `owner != World` and `owner != actor` (Doc #13 §2). Resolution sequence:

```
steal(actor, item):
  1. witnesses_npc    = NPCs with line-of-sight to (actor, item) AND awake
                        AND in same region (Schedule + sim region query)
  2. witnesses_player = Avatars in same region with line-of-sight
  3. witnesses_party  = party companions of actor with line-of-sight  // [BR]
  4. witnessed = (witnesses_npc U witnesses_player U witnesses_party).nonempty
  5. emit WitnessEvent { actor, item, witnesses, region } to Virtue Engine
  6. Virtue Engine applies:
       - score_delta = item.steal_delta (always applied to score, per Doc #5 §4)
       - if witnessed: push WitnessReport to Justice/Truth engines
                       → may flag actor as Wanted (Doc #6 §5)
                       → guard NPCs may auto-engage on next schedule tick
  7. dispatcher records OwnershipComponent.acquired_via = Stolen
```

### 6.3 BR Diverges from SI on Companion Witnesses

In *The Iron Marches*, party companions ignored theft and murder by the Avatar `[SI]`. BR restores the *Black Gate* behavior: **companions DO observe and react** (`witness_enabled = true` is the default in `CompanionPolicy`). Reason: the entire Virtues system (Doc #5) depends on the moral weight of party-witnessed choice. A companion who silently watches the Avatar murder a beggar undermines the pillar.

Concretely: a witnessing companion fires a dialogue barb, may lower their own loyalty (`CompanionPolicy` extension `[OPEN]`), and in extreme cases (witnessed murder of an `is_innocent = true` NPC) will leave the party. Companion-witness Virtue scoring is identical to NPC-witness scoring.

### 6.4 Always-Watched Zones `[BR]`

SI hardcoded the Monitor armory as always-watched `[SI]`. BR generalizes this to a per-region declaration:

```ts
type RegionMetadata = {
  region_id:          RegionId
  always_watched:     bool                  // [BR] all theft witnessed regardless of LOS
  always_watched_by:  Faction               // who reacts (e.g. "town_guard.highmere")
  pvp_allowed:        bool
  chaos_zone:         bool
}
```

Default `always_watched = true` zones in BR: Castle Avermere treasury, every shrine offering plate, Lycaeum's restricted library, Empath Abbey's vault.

### 6.5 Bribery `[SI]`

```ts
bribe(actor, npc, gold_amount):
  1. require npc.faction.accepts_bribes == true   // typically town guards
  2. base_cost = npc.bribery_floor                // per archetype, e.g. 50 gp
  3. honor = actor.virtues.honor
  4. final_cost = base_cost * (1.0 + honor / 100.0)   // high-Honor pays MORE
  5. if gold_amount >= final_cost:
       - dispatcher transfers gold (PlayerInventory scope)
       - clears actor's Wanted flag in this NPC's faction
       - virtue_delta: Truth -3 (bribery itself is dishonest)  [BR]
     else:
       - npc reacts as if insulted; may engage hostile
```

The "high-Honor pays more" inversion is intentional — a paragon's reputation makes them a mark for graft, and bribery should sting their Truth score.

### 6.6 Cross-References

This section resolves Doc #13 §5 items 2 (NPC ownership transfer on death — companion case in §3.7) and 4 (witness model for stealing — §6.2). Doc #13 items 1 (right-click sub-verb taxonomy), 3 (schedule slot granularity), 5 (Virtue opposition coupling), 6 (Avatar Score formula), 7 (cross-shard reputation), 8 (housing inactivity grace), 9 (crafting recipe schema), 11 (private-instance replication interest), 12 (sandbox levels), 13 (MCP caller authority), 14 (combat pause in MP), and 15 (procedural entity persistence) are explicitly NOT in scope for this document.

---

## 7. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capability sets defined in Doc #14 §3.

### 7.1 New Tools

| Tool | Capability | Envelope Notes | Mutates |
|---|---|---|---|
| `create_avatar` | `avatar.full` only; one-shot per session, locks shard binding | name, portrait_id, gypsy_answers[], shard_id | Writes new `AvatarIdentity` + seeded `VirtueReputation` row. Closes session on success; client must reconnect with the new `avatar_id`. |
| `equip` | `avatar.full` | `entity_id`, `slot: EquipSlot` | Moves item from inventory to paperdoll slot. `ERR_INVALID_TARGET` if slot mismatch. |
| `give` | `avatar.full` | `entity_id`, `recipient_avatar_id` | Atomic transfer to another Avatar in same region. Triggers trade dialog if recipient is a player (auto-accepts if recipient is a companion under the same `obey_player_id`). |
| `set_combat_mode` | `avatar.full` | `companion_id`, `mode: CombatAiMode` | Updates `CompanionPolicy.ai_mode`. |
| `bribe` | `avatar.full` | `npc_id`, `amount: int` | See §6.5. May return `ERR_VIRTUE_REJECTED` if NPC's faction doesn't accept bribes. |

All return the standard `VerbResult` envelope per Doc #14 §5.

### 7.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/avatar/{id}/paperdoll` | `Paperdoll` (§6.1) plus per-slot item summaries | `inspect.read` for OWN avatar only |
| `forge://shard/{s}/avatar/{id}/party` | party members, each with `CompanionPolicy` and current AI mode | `inspect.read` for OWN avatar only |
| `forge://shard/{s}/avatar/{id}/stats` | `Stats` + Hits + Mana + level + XP-to-next | `inspect.read` for OWN avatar only |

### 7.3 Capability Gating Rule `[BR]`

Cross-Avatar reads of paperdoll, party, or stats are **forbidden** under the shard-binding invariant (Doc #14 §4.4). The session's `avatar_id` is the only legal target. Resource URIs naming a different avatar return `ERR_CAPABILITY` even if both Avatars are on the bound shard. Public Virtue title (Doc #14 §6, last row) remains the only cross-Avatar visibility primitive.

---

## 8. Phase 1 Prototype Scope (12-Week "Highmere Alive")

Per Doc #11. Deliberately minimal; proves the dispatcher path end-to-end.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Character gen | Name + portrait + 3 of the 7 gypsy questions (single-player only); class skew computed but stat assignment fixed | Full 7 questions, shard binding, persistence write |
| Stats | All 5 primary/secondary stats present in schema; fixed level 1; training disabled | Trainer NPCs, leveling, XP, atrophy |
| Party | Erevan + Theran only; default AI mode = `Attack Nearest`; no permadeath logic | All other companions, AI modes 3–10, trade dialog, MP party invites |
| Paperdoll | 8 of 14 slots active: head, torso, back, belt, left_hand, right_hand, hands, feet | earrings, neck, cloak, rings, legs, quiver |
| Inventory | Container nesting working at unlimited depth; weight constraint enforced; drag/drop | volume/bulk constraint, trade UI, stacking caps for non-gold items |
| Resurrection | Avatar respawn at Lord Avermere's chamber on death; no companion resurrection | Ankh of Renewal item, Resurrect spell, Memorial Quests |
| Ownership | World vs NPC tagging only; theft witness check uses single-NPC line-of-sight | Player-witnesses, companion-witnesses, always-watched zones, bribery |
| MCP | None of the §7 tools required for the Phase 1 slice | All §7 tools and resources deferred to Phase 2 |

Phase 1 success metric (consistent with Doc #14 §8): a player can complete genesis, walk into Highmere with Erevan and Theran, equip a sword in left_hand, drag a torch from a bag-in-chest into their backpack (proving cascading weight), and steal a loaf of bread under one watching baker's nose to observe the Truth/Justice delta.

---

## 9. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Genesis | Doc #5 §3 (Avatar reset), Doc #6 §3 (`VirtueReputation` scope) |
| §2 Stats & XP | Doc #5 §2 (virtuous-act XP), Doc #6 §5 (atrophy as anti-veteran-lock) |
| §3 Party | Doc #6 §4 (8-player co-op cap), Doc #13 §1.5 (Schedule), Doc #13 §5 [OPEN] 2 |
| §4 Death & Resurrection | Doc #5 §5 (redemption), Doc #4 §3.1 (decay timers) |
| §5 Inventory | Doc #2 §4.5, Doc #4 §2 (object schema), Doc #13 §1.4 (Container), Doc #13 §5 [OPEN] 10 |
| §6 Ownership | Doc #5 §4, Doc #6 §5, Doc #13 §1.3 (Owner), Doc #13 §2 (`steal` verb), Doc #13 §5 [OPEN] 4 |
| §7 MCP | Doc #14 §3 (capabilities), §5 (tool envelope), §6 (resources) |

---

## 10. Open Questions

1. `[OPEN]` **Gypsy question content.** §1.2 specifies the format and a single sample question (the Courage-vs-Honor dilemma from U4). The full set of 7 BR-original questions needs a design pass. Constraints: each question must force a binary choice between exactly two of the Eight Virtues; the 7 questions collectively must touch all 8 Virtues at least once.
2. `[OPEN]` **Avatar customization beyond portrait.** Doc #10 §3 references dye systems for art assets; whether dyes apply to Avatar appearance (skin tone, hair color, equipment tinting) at genesis or only as in-game cosmetics is undecided. If at genesis, §1.1 needs a `cosmetics` block.
3. `[OPEN]` **Atrophy formula for assembled companions.** If BR includes any Boydon-style assembled-from-parts companion `[SI]`, does §2.4 atrophy apply at all? An assembled companion arguably has no "training" to lose, but also no biological excuse for skill retention. Pending the Companion Roster doc.
4. `[OPEN]` **Permadeath-locked companion list.** §3.4 names Spark and Tseramed as BG-equivalent candidates; final list awaits the BG storyline-fidelity pass.
5. `[OPEN]` **`CompanionPolicy.loyalty` extension.** §6.3 references companion loyalty as a witness-reaction modifier but does not define the field. Loyalty's range, decay rules, and recoverability are TBD; affects whether companions ever leave the party for cumulative reasons rather than single triggering events.
6. `[OPEN]` **Starting kit data table.** §1.4 references `data/starting_kits.toml`; not yet authored.
7. `[OPEN]` **Gate-travel key naming.** §5.6 references a "Serpent Jawbone analog" but BR's lore equivalent is unnamed. Pending World Bible (Doc #3) update.
8. `[OPEN]` **Two-handed-weapon back-slot interaction.** Per §5.1, two-handed weapons occupy both left_hand and right_hand. If the back slot holds a slung weapon (also `[SI]`), can a two-handed weapon be slung? SI is silent; assume yes pending art validation.

---

End of Document #15.
