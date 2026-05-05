Document #18: Economy, Crafting Recipes & Trade
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Economy & Systems Lead]
Status: Living Technical Reference — Normative spec for the recipe schema, currency, NPC merchants, persistent shard marketplace, and atomic player-to-player trade

Depends on: #2 GDD §5, #4 Simulation §4, #4.1 Crafting addendum, #5 Virtues §4, #6 Persistent World §3 + §4, #11 Prototype Scope, #13 Core Schema, #14 MCP Surface, #15 Character/Party/Inventory.

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Project Virtue.

---

## 1. Economy Philosophy

Crafting is diegetic — no menu, no recipe tree UI. The player drags physical objects onto each other, onto tools, or onto environmental fixtures (forge, oven, anvil, mortar, loom, cauldron) and the simulation matches the input set against a recipe database (Doc #4.1 §4) `[BG]`. Shop inventories are finite and restock on schedule `[BG]`; there is no infinite-supply merchant. Above the NPC layer sits the `[BR]` persistent player-driven marketplace: Avatar-owned `MarketStall` entities listed under regional supply/demand, with prices, scarcity, and bribery costs all modulated by Virtue (Doc #5 §4). Every coin is a physical, stealable, weighable Entity (Doc #15 §5.3) — there is no abstract wallet. The `Economy` persistence scope (Doc #6 §3, Doc #13 §3) carries shop state, scarcity tables, and stall listings; the `PlayerInventory` scope carries gold and crafted goods.

---

## 2. Recipe Schema

> **Resolves Doc #13 §5 [OPEN] item 9** (crafting recipe representation).

Recipes are data, not code. They live in a queryable recipe database (`forge://shard/{s}/recipes`) and are matched at verb time by the `combine` / `use(b, on=a)` dispatcher path (Doc #13 §2). UGC creators add recipes through the same schema (Doc #7 §2; full UGC recipe authoring deferred to Doc #19).

```ts
type RecipeId       = string             // e.g. "cooking.bread.basic"
type EntityTypeId   = ArchetypeId        // see Doc #13 §1
type SkillReq       = { stat: "combat" | "magic" | "dex" | "int", min: int }

type StateMatch     = Partial<Record<keyof StateComponent, bool | int | "any">>

type RecipeInput = {
  entity_type:    EntityTypeId
  count:          int
  consumed:       bool                   // false = catalyst (mortar holds, doesn't deplete)
  state_required: StateMatch | null      // e.g. { wet: false } for flour
}

type ToolSpec = {
  entity_type:    EntityTypeId           // e.g. "fixture.forge"
  state_required: StateMatch             // e.g. { lit: true }
  within_tiles:   int                    // default 1; the actor must be adjacent
}

type VirtueMod = {
  virtue:    Virtue                       // Doc #13 §1.7
  weight:    float                        // multiplied into quality_formula
}

type QualityFormula = {
  base:           int                     // 0..100
  skill_weight:   float                   // contribution per (skill - 10)
  virtue_weight:  float                   // contribution per (virtue - 50)
  tool_weight:    float                   // contribution per (tool.quality - 50)
}

type RecipeOutput = {
  entity_type:     EntityTypeId
  count:           int
  quality_formula: QualityFormula         // see §5
  inherits_owner:  bool                   // default true → output.owner = actor
}

type FailureSpec = {
  output:        RecipeOutput | null      // e.g. "moldy_sludge" entity
  damage:        { amount: int, type: DamageType } | null
  state_apply:   { target: "actor" | "tool", state: StateMatch } | null
  virtue_delta:  VirtueDelta | null       // catastrophic failure may cost Humility
}

type Recipe = {
  id:               RecipeId
  name:             string                // human-readable, for UGC editor only
  inputs:           RecipeInput[]
  tool:             ToolSpec | null       // null = bare-hands recipe (e.g. tear cloth)
  skill_required:   SkillReq | null
  virtue_modifier:  VirtueMod | null
  cast_time_ms:     int                   // animation + sim hold; pausable per Doc #13 §2
  outputs:          RecipeOutput[]        // multiple permitted (bread + crumbs)
  failure:          FailureSpec | null    // null = silent no-op on near-miss
  virtue_score:     VirtueDelta | null    // recipe-intrinsic Virtue movement
  source:           "core" | "ugc"        // UGC-authored recipes get marketplace review
}
```

### 2.1 Recipe Matching Algorithm

Invoked by the dispatcher when the player issues `combine(a, b)` or `use(b, on=a)`. Pure read; produces a candidate recipe id, then the dispatcher proceeds with the standard contract (Doc #13 §4).

```
match_recipe(actor, primary, secondary) -> RecipeId | null:
  1. tools_nearby = sim.entities_within(actor, max_tiles=1)
                      .filter(e -> e.archetype is fixture or hand-held tool)
  2. candidates = recipe_db.query(
       inputs_subset_of = { primary.archetype, secondary.archetype },
       tool_subset_of   = tools_nearby.map(.archetype) U { null },
     )
  3. eligible = candidates.filter(r ->
       all r.inputs satisfied by { primary, secondary } with state checks AND
       (r.tool is null OR matching tool present and state-valid) AND
       (r.skill_required is null OR actor.stats[r.skill_required.stat] >= r.skill_required.min)
     )
  4. if eligible.empty: return null   // dispatcher emits humorous "doesn't seem useful" feedback
  5. sort eligible by (skill_required.min desc, id asc)
  6. return eligible[0].id
```

Ties are broken by `skill_required` descending (more specialized wins), then by `id` ascending (stable). UGC recipes never outrank a core recipe with identical inputs at the same skill tier — the matcher prefers `source = "core"` as a final tiebreaker `[BR]`.

### 2.2 Storage

The recipe DB is a per-shard table replicated read-only to all region servers, mutated only by content patches and approved UGC marketplace publishes. It is **not** a replicated game-state object; clients query it through the MCP resource (§12) or through the engine UI lookup helper.

---

## 3. Recipe Categories

Examples drawn from Doc #4.1 §3. All entries are illustrative; the full Phase 1 set of 8 lives in `data/recipes/phase1.toml` (`[OPEN]`).

| Category | Inputs | Tool | Output | Source |
|---|---|---|---|---|
| Cooking | flour + water | none (mix in hand) | dough | `[BG]` |
| Cooking | dough | oven (`lit: true`) | bread + crumbs | `[BG]` |
| Cooking | raw meat | oven OR campfire | cooked meat | `[BG]` |
| Cooking | dough + meat + pot | oven | meat pie | `[SI]` |
| Smithing | iron ore | forge (`lit: true`) | iron ingot | `[BG]` |
| Smithing | iron ingot + hammer | anvil | dagger blade (assemble step) | `[BG]` |
| Smithing | dagger blade + wood | workbench | dagger | `[BG]` |
| Alchemy | mandrake reagent | mortar & pestle | mandrake powder | `[BG]` |
| Alchemy | mandrake powder + spider silk + sulfurous ash + water | cauldron (`lit: true`) | healing potion | `[BG]` `[SI]` |
| Textile | thread × 5 | loom | bolt of cloth | `[BG]` |
| Carpentry | wood + carpentry tools | workbench | arrow shafts × 10 | `[BG]` |
| Carpentry | wood + carpentry tools | workbench | chair | `[BG]` |
| Magical | iron sword + `In Mani Ylem` cast | none | enchanted sword (fire dmg) | `[BR]` |
| Magical | bread + `In Mani` (Create Food) | none | blessed bread (heals +5) | `[BR]` |

Magical-variant recipes are matched not by a second physical input but by a `spell_effect` overlay applied during the recipe match step — the active spell on the target counts as a virtual input. Schema extension: `RecipeInput.entity_type` accepts `"spell:<spell_id>"` as a special token.

---

## 4. Failure & Emergent Recipes

### 4.1 Failure Modes

| Trigger | Result | Notes |
|---|---|---|
| No matching recipe | Silent no-op + flavor text "That doesn't seem useful…" | Default; cheap; avoids punishing exploration `[BG]` |
| Matched recipe with `failure` spec, missing skill | `FailureSpec.output` spawned (e.g. `item.sludge.moldy`) | Tunable per-recipe |
| Alchemy with wrong reagent ratio | Explosion: 1d6 fire damage to actor + ignites adjacent flammables | `[BG]` precedent |
| Cooking with poisoned ingredient | Successful cook, but output carries `poisoned: true` state | Emergent — not a failure, but a hidden hazard |
| Smithing with impure ore | Output `quality` clamped to 0..40 | Soft failure |

### 4.2 Emergent Recipes

Doc #4.1 §1 design rule: *if it makes sense in a medieval fantasy world, it should work*. The schema supports this directly — any UGC-published or core-team-added recipe enters the matcher with no engine code change. Players discover recipes either:

1. **Documented** — taught by NPCs, books, or quest rewards. Adds an entry to the player's personal recipe journal (UI-only; not authoritative).
2. **Emergent** — player attempts a combination, the matcher finds a recipe, the journal auto-records it. Combinations that match nothing produce the silent no-op above, leaving no breadcrumb.

Cross-reference: UGC recipe publishing flow, marketplace review, and Virtue scoring of UGC recipes belong in Doc #19 (`[OPEN]` until that doc lands).

---

## 5. Quality System

Every crafted output carries a per-instance `quality: int` field (0..100) on its `Entity` (added to the `Physical` or `Combat` component depending on item kind). Quality is **per-instance**, not per-archetype `[BR]` — two daggers from the same recipe have different quality based on actor skill and Virtue at craft time.

```
quality = clamp(0, 100,
    formula.base
  + formula.skill_weight  * (actor.stats[recipe.skill_required.stat] - 10)
  + formula.virtue_weight * (actor.virtues[recipe.virtue_modifier.virtue] - 50)
  + formula.tool_weight   * (tool.quality - 50)
)
```

| Item kind | Quality affects | Range |
|---|---|---|
| Weapon | damage multiplier | ×0.5 (q=0) to ×1.5 (q=100) |
| Armor | armor_class bonus | +0 (q=0) to +5 (q=100) |
| Food | hp restored on consume | base ±50% |
| Potion | effect potency / duration | base ×0.5 to ×1.5 |
| Tool | quality_weight contribution to recipes it crafts | direct |
| Cosmetic / furniture | display tier (cosmetic only) | visual variant |

Quality decays under `durability` (Doc #13 §1.2): a weapon at `durability = 0` breaks regardless of original quality. Quality does not regenerate; repair recipes cap at `min(original_quality, repair_skill * 2)`.

---

## 6. Currency Model

Coins are physical, stackable Entities (Doc #15 §5.3 — gold stacks unlimited per container). No abstract wallet exists `[BG]`.

| Coin | gp value | Stack | Notes |
|---|---|---|---|
| Copper | 0.01 | unlimited per stack | `[BG]` smallest unit; mostly used for street-market change |
| Silver | 0.1 | unlimited per stack | `[BG]` |
| Gold | 1.0 | unlimited per stack | `[BG]` baseline currency |
| Platinum | 10.0 | unlimited per stack | `[BR]` introduced for late-game stall sales to keep coin weight tractable |

```ts
type CoinComponent = {
  denomination: "copper" | "silver" | "gold" | "platinum"
  count:        int
}
```

Coins live under `PersistenceScope = PlayerInventory` while held; loose coin piles in the world fall under `WorldState`. Theft of coins is identical to theft of any other entity — the witness model in Doc #15 §6 applies. There is no magical "global wallet"; coin physically present at the point of trade is the only legal tender.

Aggregate gp value at a transaction is computed by summing all coin Entities in the actor's inventory tree at trade time. Change-making is the dispatcher's responsibility (it splits and merges coin stacks atomically as part of the trade write).

---

## 7. Shop & Merchant Model

NPCs with mercantile schedules (Doc #13 §1.5) carry an additional `Shop` component:

```ts
type Shop = {
  inventory:        EntityId[]                    // actual Entities, not stack-counts
  price_table:      Map<EntityTypeId, int>        // base buy-from-merchant price in gp
  restock_interval: int                           // game-hours; default 24
  restock_quantity: Map<EntityTypeId, int>        // per restock tick, capped at initial stock
  initial_stock:    Map<EntityTypeId, int>        // ceiling for restock
  faction:          string                        // for Virtue × faction modifiers (§7.2)
  bribery_floor:    int                           // see Doc #15 §6.5
}
```

### 7.1 BUY / SELL Keywords `[BG]`

Talking (`talk` verb, Doc #13 §2) to a merchant exposes `BUY` and `SELL` keywords in the dialogue tree. Each opens a panel rendered against the merchant's `Shop` inventory and the Avatar's inventory respectively. All transactions still flow through `VerbDispatcher` — the panel is a UI shim; the underlying call is `buy(merchant_id, item_id, qty)` or `sell(merchant_id, item_id, qty)` (§12).

Inventory items in the merchant panel are fully simulated `Entity` instances — examinable, weighable, and individual-quality varies. A merchant restocking a "dagger" does not produce identical daggers; the restock spawns new instances with quality rolled per the merchant's craftsmanship table.

### 7.2 Price Formula `[BR]`

```
buy_price  = base_price * virtue_buy_mod(actor.virtues, npc.faction) * scarcity_mod(region, item)
sell_price = base_price * 0.4 * virtue_sell_mod(actor.virtues, npc.faction) * scarcity_mod(region, item)
```

Multipliers (clamped to [0.5, 2.0] to prevent runaway):

| Modifier | Trigger | Effect |
|---|---|---|
| `virtue_buy_mod` low Honor (<30) | merchant suspects player is a deadbeat | ×1.25 |
| `virtue_buy_mod` low Honesty (<30) | merchant suspects theft | ×1.50 |
| `virtue_buy_mod` high Compassion (>70) at compassion-aligned merchant | gratitude discount | ×0.90 |
| `virtue_buy_mod` high Honor (>70) at faction-guild merchant | guild discount | ×0.85 |
| `virtue_buy_mod` low Justice (<20) at any lawful-aligned merchant | refusal | trade refused outright; reaction state Wary→Hostile (Doc #17 §11 reference) |
| `virtue_sell_mod` high Sacrifice (>70) | merchant gifts small reagents free | ×1.15 to player's sale price; some recipes flagged `gift_eligible` transfer at 0 gp |
| `scarcity_mod` regional supply low | demand spike | ×1.10 to ×2.00 |
| `scarcity_mod` regional supply high | glut | ×0.50 to ×0.90 |

The 0.4 multiplier on `sell_price` is the canonical merchant margin `[BG]` — a player can never break even on resale at the same shop.

### 7.3 Restock Behavior

Every `restock_interval` game-hours (default 24h = one game-day), the dispatcher's economy tick:

1. For each `(item_type, quantity)` in `Shop.restock_quantity`:
2. `current = count of inventory items of item_type`
3. `add = min(quantity, initial_stock[item_type] - current)`
4. Spawn `add` new `Entity` instances of `item_type`, push into `Shop.inventory`.

Restock writes go through the dispatcher under `PersistenceScope = Economy` (Doc #6 §3). No NPC has infinite supply.

### 7.4 Haggle (`[OPEN]`)

`[BG]` permitted some haggling on a per-merchant basis. BR's haggle dispatcher path is `[OPEN]` — proposed as a `right_click` sub-verb on the BUY/SELL panel that rolls actor DEX + INT against a merchant fixed difficulty, granting up to 15% off on success. Final form pending economy balance pass.

---

## 8. Persistent Shard Marketplace `[BR]`

The player-driven layer above NPC merchants. There is no NPC equivalent to a player stall — only Avatars sell on this market.

### 8.1 MarketStall Entity

```ts
type MarketStall = {
  archetype:        "fixture.market_stall"
  components: {
    Physical:        PhysicalComponent              // placeable, large
    Container:       ContainerComponent             // holds listed inventory
    Ownership:       OwnershipComponent             // owner.kind = "Player"
    Shop: {
      inventory:        EntityId[]                  // owner's listed items
      price_table:      Map<EntityId, int>          // per-instance price (quality matters)
      auto_restock:     false                       // stalls do NOT auto-restock
      faction:          "player"
    }
    PersistenceScope: { scope: Economy, owner_key: RegionId }
  }
}
```

A stall is purchased or built (cost / craft recipe `[OPEN]`) and placed in a region with the `marketplace = true` metadata flag. The owner stocks the stall by dragging items into its `Container`; the per-item price is set on each instance. Other Avatars browse via `talk(stall)` → `BUY` keyword (the stall NPC-emulation layer is a passive script hook, no real NPC).

### 8.2 Stall Transactions

```
buy_from_stall(buyer, stall, item_id, offered_gp):
  1. validate stall.owner != buyer
  2. validate item_id in stall.inventory
  3. validate offered_gp >= stall.price_table[item_id]
  4. dispatcher.transaction(scope = Economy):
       a. transfer item_id : stall.Container -> buyer.inventory
       b. transfer offered_gp : buyer.coins -> stall.owner.escrow_wallet
       c. update region scarcity ledger (§8.3)
  5. emit StallSale event for owner notification
```

The owner does not need to be online; sale gold accumulates in an `escrow_wallet` Entity inside the stall's `Container`, retrievable next login.

### 8.3 Anti-Griefing

| Rule | Enforcement |
|---|---|
| Theft from stalls is theft | `drag` from a stall whose `owner != actor` triggers `steal` per Doc #13 §2 + Doc #15 §6 |
| Stall destruction | Stalls have `hp` and `durability`. Destruction in PvE shards is forbidden (refused at dispatcher); in Chaos shards, destruction returns contents to the world floor as `Owner = World` |
| Cross-shard stalls forbidden | Stalls bind to `RegionId` at placement; all reads/writes scoped to bound shard (Doc #14 §4 invariant 4) |
| Owner abandonment | If owner inactive past the housing grace period (Doc #13 §5 [OPEN] item 8), stall reverts to `Owner = World` and contents are marketed by NPC clerks `[OPEN]` |

### 8.4 Regional Scarcity Ledger

Each region maintains a per-item-type ledger:

```ts
type ScarcityEntry = {
  item_type:    EntityTypeId
  supply_24h:   int                       // count of new listings over rolling 24 game-hours
  demand_24h:   int                       // count of buys over rolling 24 game-hours
  scarcity_mod: float                     // derived; clamped [0.5, 2.0]
}
```

The ledger updates every 24 game-hours via an Economy-scope dispatcher tick. The exact propagation algorithm (Cobb-Douglas? Linear?) is `[OPEN]`. The output `scarcity_mod` feeds both NPC merchants (§7.2) and player stalls (the displayed price is informational; the actual sale price is whatever the stall owner set, but listing-time recommendations show scarcity-adjusted suggestions).

---

## 9. Atomic Trade Between Players

Player-to-player trade is the consensual side of inventory transfer. It is **never theft** and incurs no Virtue penalty — fully consensual transfers are by definition Honest (Doc #5 §4 reading).

### 9.1 VerbDispatcher.trade

```ts
type TradeOffer = {
  items:  EntityId[]
  gold:   int                              // computed from coin Entities at submit time
}

type TradeSession = {
  session_id:     string                   // UUIDv4
  initiator:      AvatarId | EntityId      // EntityId for companion-trade
  recipient:      AvatarId | EntityId
  initiator_offer: TradeOffer
  recipient_offer: TradeOffer
  status:         "pending" | "initiator_confirmed" | "recipient_confirmed" | "both_confirmed" | "cancelled"
  region:         RegionId
  opened_at:      ServerTick
  expires_at:     ServerTick               // default 5 minutes
}
```

### 9.2 Two-Phase Commit

```
trade_commit(session: TradeSession):
  // Phase 1: validate (lock both inventories)
  acquire inventory_lock(session.initiator), inventory_lock(session.recipient)
  for side in [initiator, recipient]:
    other = the other side
    validate all items in side.offer.items are owned by side
    validate other.inventory.weight + side.offer.weight <= other.inventory.capacity_weight
    validate other.inventory.volume + side.offer.volume <= other.inventory.capacity_volume
    validate side has at least side.offer.gold in coin Entities
  if any validation failed:
    release locks
    return ERR_PHYSICS or ERR_OWNERSHIP

  // Phase 2: swap, persist, replicate
  begin transaction(scope = PlayerInventory)
    for side in [initiator, recipient]:
      transfer side.offer.items -> other.inventory
      transfer side.offer.gold (split coin Entities as needed) -> other.inventory
    update OwnershipComponent.acquired_via = "Gifted" on all transferred items
  commit

  release locks
  emit TradeCompleted to both sides
```

Either party clicking Cancel before `both_confirmed` rolls back trivially (no writes have occurred). Network drop between Phase 1 and Phase 2 is handled by the standard 30-second rollback (Doc #6 §3).

### 9.3 Single-Player Companion Trade

Identical dispatcher path with auto-accept on the companion side — matches Doc #15 §3.2 (`inventory_share_policy: Open` companions auto-accept; `OwnerOnly` rejects; `AskFirst` emits a pending-trade event but the player-driven companion is treated as initiator's own input and resolves immediately).

### 9.4 Distinction from Steal

| Path | Consent? | Virtue Effect | `acquired_via` |
|---|---|---|---|
| `trade` | both sides | none | `Gifted` |
| `give` (Doc #15 §7.1) | recipient implicit | Sacrifice + (if no return), Compassion + (target in need) | `Gifted` |
| `donate` (Doc #13 §2) | recipient implicit | Sacrifice + + | `Gifted` |
| `steal` (Doc #13 §2) | none | Honesty −, Justice − | `Stolen` |
| `drag` from `World`-owned | n/a (unowned) | none | `Found` |

---

## 10. Virtue × Economy Interactions

Cross-reference to Doc #5 §4 ("High Sacrifice players get free reagents from grateful NPCs; low Honor players pay higher taxes"). BR formalizes:

| Trigger | Effect | Source |
|---|---|---|
| Sacrifice > 75 | Compassion-aligned merchants gift 1 small reagent per game-day on first BUY visit | Doc #5 §4 |
| Honesty < 30 | All merchants in regions with `always_watched = true` apply +50% buy mod (§7.2) | Doc #15 §6.4 + §7.2 |
| Honor > 70 + faction match (e.g. Paladin in Empath Abbey) | 15% guild discount on all purchases | §7.2 |
| Justice < 20 | Lawful-aligned merchants refuse trade entirely, NPC reaction Wary→Hostile | Doc #17 §11 |
| Bribery active | Cost scales inversely with target NPC's Honor (high-Honor targets cost more, refuse more) | Doc #15 §6.5 |
| Compassion > 70 | Beggar NPCs offer small information / quest hooks (no economic effect, but a social-economic loop) | Doc #5 §4 |
| Spirituality > 80 | Shrine offering plates accept any item as a Virtue-positive `donate`, including high-value gear | Doc #5 §3 |
| Humility < 20 | NPC reaction tone shifts; some merchants refuse to even open BUY panel | Doc #5 §2 |

---

## 11. Crafting Station Entities

Stations are placeable in player housing (Doc #6 §3 `HousingAndCreations` scope) and pre-placed in towns. All are standard `Entity` instances; their components are minimal but their archetype-level `ScriptHook.on_use` is what makes the station "active" for the matcher.

| Station | Archetype | Required components | State flags |
|---|---|---|---|
| Forge | `fixture.forge` | Physical, State, ScriptHook | `lit: bool`, `temperature: int` |
| Oven | `fixture.oven` | Physical, State, ScriptHook | `lit: bool`, `temperature: int` |
| Anvil | `fixture.anvil` | Physical, ScriptHook | passive |
| Loom | `fixture.loom` | Physical, ScriptHook | passive |
| Mortar & Pestle | `tool.mortar_pestle` | Physical (small, hand-held) | passive; carried in inventory |
| Cauldron | `fixture.cauldron` | Physical, Container, State, ScriptHook | `lit: bool`, `temperature: int`; contains liquid input |
| Workbench | `fixture.workbench` | Physical, ScriptHook | passive |
| Alchemy bench | `fixture.alchemy_bench` | Physical, Container, ScriptHook | passive; holds reagent intermediates |
| Campfire | `fixture.campfire` | Physical, State, ScriptHook | `lit: bool`; substitutes for oven on cooking recipes only |

Stations placed in player housing carry `PersistenceScope = HousingAndCreations` and respect the housing grace period for ownership inactivity. Stations in town squares carry `PersistenceScope = WorldState` and never reset `[BG]` (the Britain forge is the Britain forge forever).

---

## 12. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capability sets defined in Doc #14 §3.

### 12.1 New Tools

| Tool | Capability | Envelope notes | Mutates |
|---|---|---|---|
| `craft` | `avatar.full` | `recipe_id`, `inputs: EntityId[]`, `tool_id: EntityId \| null` | Explicit crafting path; returns `ERR_INVALID_TARGET` if matcher's recipe id ≠ submitted `recipe_id`. Optional alternative to letting `combine` auto-match. |
| `buy` | `avatar.full` | `merchant_id` OR `stall_id`, `item_id`, `qty` | Atomic gold→item transfer per §7.1 / §8.2. May return `ERR_VIRTUE_REJECTED` per §7.2 refusal rules. |
| `sell` | `avatar.full` | `merchant_id`, `item_id`, `qty` | Atomic item→gold transfer per §7.1. Stalls do not accept SELL — selling is for NPC merchants only. |
| `trade` | `avatar.full` | `other_avatar_id`, `offer: TradeOffer`, `request: TradeOffer` | Opens a `TradeSession` (§9). Returns `session_id` on `ok: true`. Does NOT commit on its own; awaits `accept_trade`. |
| `accept_trade` | `avatar.full` | `trade_session_id` | Marks the calling Avatar as confirmed. Two-phase commits when both sides have accepted. |
| `reject_trade` | `avatar.full` | `trade_session_id` | Cancels the session; no writes. |

All return the standard `VerbResult` envelope per Doc #14 §5. All declare `persistence_scope` as `economy` for shop/stall calls and `player` for trade-between-Avatars calls (mismatches return `ERR_SCOPE_MISMATCH` per Doc #14 §4 invariant 3).

### 12.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/recipes` | full recipe DB (paged); each entry per §2 schema | `inspect.read` |
| `forge://shard/{s}/region/{id}/economy` | scarcity ledger (§8.4) + active stall listings (§8.1) | `inspect.read` |
| `forge://shard/{s}/avatar/{id}/wallet` | aggregate gp value + coin Entity breakdown by denomination | `inspect.read` for OWN avatar only (per Doc #15 §7.3 capability gating rule) |

The `recipes` resource is read-only over MCP — UGC recipe authoring is in-engine only (Doc #7) and goes through the marketplace review queue, not through MCP.

### 12.3 Cross-Reference

`combine` (Doc #14 §5.6) remains the dispatcher's preferred crafting path. `craft` is provided for clients that want explicit recipe-id specification — useful for LLM-driven QA harnesses that want deterministic recipe selection rather than relying on the matcher's tiebreak rules (§2.1).

---

## 13. Phase 1 Prototype Scope (12-Week "Britain Alive")

Per Doc #11, Doc #14 §8, Doc #15 §8. Deliberately minimal.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Recipes | 8 working recipes from Doc #4.1 §6 (bread, dough, dagger, healing potion, cooked meat, arrows, cloth bolt, blessed bread) | All other recipes; magical-variant `spell_effect` token |
| Stations | 3 functional in Britain: forge, oven, alchemy bench (cauldron). Anvil + workbench + loom present but recipes deferred | Mortar & pestle as inventory tool; campfire substitution; player-housing placement |
| Quality | Per-instance `quality` field stored on outputs; combat damage multiplier active | Armor / food / potion quality effects; tool quality contribution; repair recipes |
| Currency | Gold only (single denomination) | Copper, silver, platinum stacks |
| NPC merchants | 3 in Britain: baker (bread + flour), blacksmith (basic weapons), apothecary (reagents). BUY/SELL keyword path active. | All other merchants; haggle; faction-guild discounts |
| Virtue × price | High Honor discount + low Honesty surcharge visible | All other Virtue × economy rules; Justice-refusal cascade |
| Restock | 24 game-hour restock tick active | Restock quantity tuning per merchant |
| Shop scarcity | Static `scarcity_mod = 1.0` for all items | Live ledger; demand tracking |
| Player-to-player trade | **Deferred** — no MP marketplace in Phase 1 (consistent with Doc #15 §8) | All of §9 |
| Persistent shard marketplace | **Deferred** — single-player vertical slice; no `MarketStall` placement | All of §8 |
| MCP tools | None of §12 required for Phase 1 (per Doc #14 §8 the only mutating verb is `use`) | All of §12 |

Phase 1 success metric: a player can buy flour from the Britain baker, drag flour onto water to make dough, drag dough into a lit oven to bake bread (observing per-instance quality), donate the bread to a beggar (observing Sacrifice +), and return to the same baker the next game-day to find the shelves restocked.

---

## 14. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §2 Recipe schema | Doc #4.1 §4, Doc #13 §1 (Entity), Doc #13 §5 [OPEN] 9 (resolved) |
| §3 Recipe categories | Doc #4.1 §3 |
| §4 Failure | Doc #4.1 §1, Doc #4 §3 (fire spread), Doc #5 §2 (Humility on catastrophic failure) |
| §5 Quality | Doc #13 §1.1 (Physical), §1.8 (Combat), Doc #15 §5 (paperdoll) |
| §6 Currency | Doc #15 §5.3 (stacking), Doc #13 §1.4 (Container) |
| §7 Merchants | Doc #13 §1.5 (Schedule), Doc #5 §4 (Virtue × economy), Doc #6 §3 (Economy scope) |
| §8 Marketplace | Doc #6 §2 (spatial partitioning), §3 (HousingAndCreations + Economy scopes), Doc #13 §5 [OPEN] 8 (housing grace) |
| §9 Trade | Doc #13 §2 (`trade` verb), Doc #15 §5.5 (trade dialog), §3.2 (companion policy) |
| §10 Virtue × economy | Doc #5 §2, §4, Doc #15 §6.4 (always-watched), §6.5 (bribery), Doc #17 §11 (NPC reactions) |
| §11 Stations | Doc #4 §4 (special containers), Doc #6 §3 (HousingAndCreations scope) |
| §12 MCP additions | Doc #14 §3 (capabilities), §5 (envelope), §6 (resources), §4 invariant 3 (scope match) |

---

## 15. Open Questions

1. `[OPEN]` **Base price table.** §7 references `Shop.price_table` and §8 references stall price suggestions, but the canonical base-gp value for each item type does not yet exist. Needs an economy balance pass coordinated with crafting input cost (a dagger should cost more than its iron ingot input). Pending `data/prices/base.toml`.
2. `[OPEN]` **Regional scarcity propagation algorithm.** §8.4 defines the ledger schema and update cadence but not the function from `(supply_24h, demand_24h)` to `scarcity_mod`. Candidates: linear ratio, Cobb-Douglas, or a seasonal-baseline-with-shock model. Affects stall listing recommendations and NPC restock pricing.
3. `[OPEN]` **Cross-shard wallet portability for cosmetic-only purchases.** Doc #6 §2 permits paid cosmetic recall scrolls and (potentially) a real-money cosmetic store. If those purchases are gold-denominated, gold must be at least partially cross-shard for the cosmetic case while remaining shard-local for gameplay. Resolution likely lives in a future live-ops doc, but the contract boundary needs to be clear before the persistent marketplace ships.
4. `[OPEN]` **Companion-merchant interaction.** Can a party companion (e.g. Iolo) sell items to NPC merchants on the Avatar's behalf, or initiate trades with other Avatars? Touches `CompanionPolicy.inventory_share_policy` (Doc #15 §3.2). BG precedent: companions hold items but never transact independently — BR's stance is `[OPEN]`.
5. `[OPEN]` **MarketStall ownership transfer on housing abandonment.** §8.3 defers to Doc #13 §5 [OPEN] 8 (housing grace period). Once that grace period is set, stall reversion mechanics need a concrete rule: revert to `World` (anyone takes the contents)? Auctioned by NPC clerk? Returned to owner's escrow on next login?
6. `[OPEN]` **Haggle dispatcher path.** §7.4 sketches a DEX+INT roll on a `right_click` sub-verb but the menu_token model (Doc #14 §4 invariant 5) needs concrete `action_id` values and a `params` schema. Pending right-click sub-verb taxonomy resolution (Doc #13 §5 [OPEN] 1).
7. `[OPEN]` **Crafting failure Virtue scoring.** §4.1 mentions Humility loss on catastrophic failure but the magnitude and trigger conditions are not formalized. Should setting your own alchemy lab on fire cost Spirituality, Humility, or both?
8. `[OPEN]` **UGC recipe Virtue review.** §4.2 punts UGC recipe publishing to Doc #19. Once #19 lands, the recipe schema's `source: "ugc"` flag needs a marketplace-approval pipeline definition.
9. `[OPEN]` **Recipe journal as authoritative state vs. UI cache.** §4.2 calls the player's journal "UI-only". If a player wipes their client cache, do learned recipes survive? Persistence scope for the journal is currently unset; candidates are `PlayerInventory` (per-Avatar) or none (recompute on demand from action history).
10. `[OPEN]` **Two-phase trade timeout under network partition.** §9.2 cites the 30-second rollback (Doc #6 §3) but trade-specific timeout semantics (does the lock release on partition? does the session expire?) need a concrete rule before MP ships.

---

End of Document #18.
