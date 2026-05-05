# 36 — Procedural Quest Skeletons

Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Procedural Narrative Lead / Live Service Design]
Status: Living Technical Reference — Normative spec for the procedural quest skeleton library, slot binding, coherence checking, chaining, and authoring tools promised in Doc #8 §3.3 and Doc #19 §10.

Depends on: #3 World Bible, #5 Virtues, #6 Persistent World, #8 Procedural Generation & World Expansion Framework, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface, #15 Character/Party/Inventory, #17 Dialogue & NPC Schedule, #18 Economy, Crafting & Trade, #19 Quest & UGC Scripting, #21 Save Format & Shard DB, #26 Long-range Arcs & Hosted GM Sessions, #28 Telemetry/Analytics & Live Ops, #29 Moderation & Admin Tools.

Resolves: Doc #8 §3.3 (procedural quest skeleton library was promised but not specified). Doc #19 §10 (`QuestSkeleton.params` schema was sketched but slot resolution, coherence checks, chaining, and authoring were left to this document).

Provenance tags: `[BG]` Black Gate (Ultima VII original), `[SI]` The Iron Marches, `[U4]` Ultima IV (Virtues canon), `[BR]` Project Virtue (new layer). Most of this document is `[BR]` — Ultima VII's quests were hand-authored single-file scripts; nothing in the original used templated parameter slots or runtime binding.

---

## 1. Skeleton Philosophy

### 1.1 Why skeletons at all `[BR]`

Avermere must grow continuously without surrendering its hand-crafted feel (Doc #8 §1, "Guided Discovery, Never Random Chaos"). Hand-authoring every side quest in every frontier region scales linearly with team size and inversely with shipping velocity; pure LLM-driven generation produces text that drifts off-canon, contradicts world state, and bypasses Virtue scoring. **Skeletons sit between**: a designer-authored *shape* (a fetch, an escort, a betrayal) with typed parameter slots that the procedural generator binds at runtime to live world state. The shape carries the load-bearing structure — Virtue branches, fail conditions, journal cadence, reward semantics — while the slots carry the local color (which NPC, which item, which region, which moral dilemma).

The skeleton is a `Quest` (Doc #19 §3.1) with `is_skeleton = true` and a typed `params` array. **Every binding emits a fully-formed `Quest` instance through the same schema** — no parallel runtime, no privileged write path. Skeleton binding is just code that fills in the strings and `EntityId`s of an ordinary quest before it enters the journal.

### 1.2 Non-negotiables

1. **Dispatcher invariant.** Every effect a skeleton-bound quest produces — `GiveItem`, `ChangeVirtue`, `StartQuest`, `CompleteQuest` — flows through `VerbDispatcher.dispatch(...)` (Doc #13 §4 / Doc #19 §6). A bound quest is structurally identical to a hand-authored one. Per the Doc #41 Engine & Stack ADR, the dispatcher and the binder both run on the authoritative Rust server; UE5 and TS/PixiJS clients are dumb views that surface bound quest text and stage state via the Protobuf wire protocol and never bind quests locally.
2. **Virtue scoring fires.** A bound "slay" quest whose target is an `is_innocent = true` NPC produces the same Mercy/Justice loss as any other innocent kill (Doc #13 §1.7, Doc #5 §4). The skeleton system cannot launder away moral weight.
3. **Coherence before journal.** A bound quest is only written to a player's journal (Doc #17 §3.2) **after** the coherence checker (§7) has confirmed its slots resolve to entities that exist, are reachable, and do not contradict existing live quests in the player's journal or the region.
4. **Determinism from seed.** Given a fixed `(skeleton_id, region_seed, time_seed)`, slot resolution produces the same quest. This makes incidents reproducible for moderation review (Doc #29) and gives Doc #28 telemetry a stable identity per quest instance.
5. **Lord Avermere's cabinet is off limits.** The eight canonical companions (Erevan, Shamino, Spark, Dupre, Jaana, Geoffrey, Julia, Katrina) and Lord Avermere himself are permanently excluded from `target` and `victim` slots in skeletons unless explicitly opted-in via the Alternate Avermere flag (Doc #19 §8.3, Doc #3 §7). `[BR]` matching the Doc #19 validator red-flag rule.

### 1.3 Hand-authored vs skeleton-bound

| Property | Hand-authored quest (Doc #19 §3) | Skeleton-bound quest (this doc) |
|---|---|---|
| `Quest.id` | Designer-assigned, stable | Generated `skel:<skeleton_id>:<region>:<seed>:<idx>`; stable per binding |
| `Quest.metadata.is_skeleton` | `false` | source skeleton was `true`; binding output is `false` (it is now a concrete quest) |
| `Quest.metadata.bound_from` | absent | populated with `(skeleton_id, region_seed, time_seed, bind_at)` |
| Journal text | Final strings | Templated strings interpolated at bind time |
| Storage | `WorldState`, owner_key = author region or `"official"` | `WorldState`, owner_key = `RegionId` (Doc #19 §10) |
| Mutability | Static after publish | Static after binding; re-binding produces a *new* `Quest` instance, never edits in-place |

The journal page that the player sees is identical in shape to a hand-authored one; nothing leaks the skeleton origin to the player.

---

## 2. Skeleton Taxonomy

The Phase-1-launch skeleton library is a small, curated set. Frontier expansions add to the library through the same publishing pipeline as UGC quests (Doc #19 §9). Every skeleton is tagged with a primary `kind` and may carry secondary tags for retrieval and rotation (§11).

### 2.1 Primary kinds

| Kind | Spine | Typical slots | Virtue affordances |
|---|---|---|---|
| `fetch` | Giver asks Avatar to retrieve `{item}` from `{location}` and return it | `giver`, `item`, `location`, `reward`, `time_window?` | Mercy (helping the needful); Truth (proving a returned item authentic); Devotion if reward forfeited |
| `deliver` | Giver hands Avatar `{package}` to carry to `{recipient}` in `{destination}`, possibly with peril en route | `giver`, `package`, `recipient`, `destination`, `reward`, `time_window?`, `intercept?` | Honor (oath of safe passage); Truth (no peeking inside `package`) |
| `slay` | `{target}` is identified as a monster/threat; Avatar is asked to kill it | `giver`, `target`, `location`, `reward`, `evidence?` | Courage (combat); Justice (correct identification); Mercy if target turns out to be misidentified |
| `escort` | Giver or `{escortee}` requires safe travel to `{destination}`, with `{ambushers}` likely along the path | `giver`, `escortee`, `destination`, `time_window`, `ambushers?`, `reward` | Courage + Mercy; Devotion if escortee dies |
| `investigate` | A wrong has occurred; Avatar must gather `{clues}` and identify `{culprit}` from a candidate set | `giver`, `crime`, `clue_set`, `suspect_set`, `reward` | Truth (truthful accusation); Justice (correct identification) |
| `defend` | A `{location}` will be attacked by `{aggressors}` at `{time_window}`; Avatar must hold | `giver`, `location`, `aggressors`, `time_window`, `reward` | Courage; Devotion |
| `gather` | Collect `{count}` of `{resource}` from `{biome_or_region}` and bring to `{recipient}` | `recipient`, `resource`, `count`, `biome_or_region`, `reward` | Mercy (rebuilding); Humility (humble labor) |
| `rescue` | `{captive}` is held by `{captor}` in `{prison}`; Avatar must free them | `giver`, `captive`, `captor`, `prison`, `reward`, `ransom_alt?` | Mercy; Devotion (ransom alt) |
| `ritual` | Perform a `{rite}` requiring `{components}` at `{shrine_or_circle}` at `{time_window}` | `officiant?`, `rite`, `components`, `shrine_or_circle`, `time_window` | Insight; Devotion (rare components); Humility |
| `exploration` | Discover a hinted `{landmark}` in `{region}` and report what was found | `giver`, `landmark`, `region`, `reward`, `report_keyword` | Insight; Truth (truthful report) |
| `courier_chain` | A multi-hop delivery: `{package}` travels A → B → C → D, each hop yielding a fragment of a larger reveal | `start_giver`, `hops[]`, `final_recipient`, `reward` | Honor; Truth; Patience as a sub-virtue of Humility |
| `betrayal` | An apparent giver/quest is a trap; the "true" objective is uncovered mid-quest, presenting a Virtue choice | `apparent_giver`, `apparent_quest`, `true_objective`, `reveal_trigger`, `reward_truth`, `reward_complicity` | Truth (refuse complicity); Mercy (refuse the betrayal); Honor; Justice |
| `mediate` | Two NPCs `{party_a}` and `{party_b}` are in dispute over `{stake}`; Avatar must broker | `party_a`, `party_b`, `stake`, `reward_a?`, `reward_b?` | Justice; Humility |
| `cleanse` | A `{site}` has been profaned by `{taint}`; Avatar must purify it (often a ritual sub-skeleton) | `site`, `taint`, `cleanser`, `reward` | Insight; Devotion |
| `vigil` | Stand watch / accompany a dying NPC / wait at a place during a `{time_window}` | `subject`, `time_window`, `reward` | Mercy; Insight; Humility |

`courier_chain`, `betrayal`, and `mediate` are *meta-skeletons*: their internal stages compose other skeletons (§9 chaining). The library is open — designers add new kinds through §10 authoring tools.

### 2.2 Secondary tags

Every skeleton carries a tag set that informs §11 rotation, retrieval, and anti-monotony:

```ts
type SkeletonTag =
  | "combat_heavy" | "combat_light" | "no_combat"
  | "social"       | "exploration"  | "puzzle"
  | "moral_choice" | "trickster"
  | "short"        | "medium"       | "long"           // approximate length bucket
  | "solo_friendly" | "party_friendly" | "party_required"
  | "frontier"     | "civic"        | "wild" | "dungeon"
```

Tags are advisory for retrieval; coherence checks (§7) and difficulty knobs (§6) are the load-bearing constraints.

### 2.3 Provenance and credit

- **Origin-authored** skeletons carry `author = "official"`.
- **UGC-authored** skeletons (Doc #19 §10, sandbox level `Trusted`) carry `author = PlayerId` and surface the creator's name on every bound quest's journal page and Hall of Wonders metrics (Doc #19 §10).
- A bound quest's journal does **not** distinguish skeleton from hand-authored; the credit line ("Quest contributed by *<creator>*") attaches whether the skeleton was Origin or UGC. `[BR]`

---

## 3. Skeleton DSL & Schema

The `QuestSkeleton` type extends Doc #19 §10's sketch into a fully-typed schema.

### 3.1 Top-level

```ts
type SkeletonId = string
type SlotName   = string                    // e.g. "giver", "item", "location"

type QuestSkeleton = {
  id:              SkeletonId
  kind:            SkeletonKind             // §2.1 primary kind enum
  tags:            SkeletonTag[]            // §2.2
  version:         int                      // bumped on any edit; binding records this
  author:          PlayerId | "official"
  description:     LocalizedString          // designer-facing description (not journal text)
  params:          SlotSpec[]               // typed parameter slots (§3.2)
  templates:       TemplateBundle           // strings & journal text with `{slot}` placeholders (§3.3)
  stages:          SkeletonStage[]          // analogous to QuestStage; supports `{slot}` references
  rewards:         RewardSpec[]             // resolved with reward_tier knob (§6)
  fail_conditions: FailCondition[]          // §3.4
  prerequisites:   Prerequisite[]           // §3.5; checked before binding
  variation_knobs: VariationKnobs           // §6
  coherence_hints: CoherenceHints           // §7; designer-supplied extra constraints
  chain_hooks:     ChainHook[]              // §9
  metadata: {
    created_at:     Timestamp
    updated_at:     Timestamp
    virtue_score:   int                     // alignment, like Doc #19 §8
    publish_state:  enum { Draft, Compiled, Submitted, Approved, Rejected, Live, Retired }
  }
}
```

### 3.2 Slot specifications

```ts
type SlotSpec = {
  name:        SlotName                     // referenced as "{name}" in templates
  type:        SlotType
  required:    bool
  bind_at:     "instantiate" | "first_trigger"   // matches Doc #19 §10
  resolver:    ResolverHint                 // §5 — what the binder should look for
  validate:    SlotValidator[]              // pre-bind constraints
  description: LocalizedString              // designer note for authoring UI
}

type SlotType =
  | { t: "NpcRef",         filter: NpcFilter }              // resolves to live EntityId
  | { t: "ItemArchetype",  filter: ItemFilter }             // archetype id; instance materialized later
  | { t: "ItemInstance",   filter: ItemFilter }             // specific live instance
  | { t: "Location",       filter: LocationFilter }         // RegionId or TileCoord
  | { t: "FactionRef",     filter: FactionFilter }
  | { t: "ResourceNode",   filter: ResourceFilter }         // mine, grove, etc.
  | { t: "VirtueDilemma",  axes: Virtue[], polarity: "+" | "-" | "either" }
  | { t: "TimeWindow",     min_seconds: int, max_seconds: int, calendar?: CalendarTag }
  | { t: "Count",          min: int, max: int }
  | { t: "Reward",         tier: RewardTier | "from_knob" }
  | { t: "Free",           kind: "string" | "int" | "float" }   // designer-typed literal

type NpcFilter = {
  faction?:           FactionId | FactionId[]
  archetype_pattern?: string                          // e.g. "npc.commoner.*", "npc.brigand.*"
  schedule_tag?:      string                          // "shopkeeper", "wanderer"
  is_innocent?:       bool
  excludes?:          EntityId[]                      // protect canonical NPCs (§1.2 rule 5)
  min_age_days?:      int                             // NPC must have existed in shard ≥ N days
  proximity_to?:      SlotName                        // bind near another already-bound slot
  proximity_tiles?:   int
}

type ItemFilter = {
  archetype_pattern?: string                          // e.g. "item.tool.*", "item.heirloom.*"
  rarity?:            "common" | "uncommon" | "rare" | "unique"
  weight_max?:        float                           // must be carryable
  region_origin?:     RegionId | "any"
}

type LocationFilter = {
  region_pattern?:    string
  biome?:             BiomeTag[]
  poi_kind?:          string                          // "ruin", "shrine", "cave", "tower"
  reachable_from?:    SlotName                        // walkable from another slot
  max_distance_tiles?: int
  forbid_pocket_realm?: bool                          // skeleton declines instanced realms
}
```

### 3.3 Templates

`TemplateBundle` carries every player-facing string. All strings use `{slot}` and `{slot.field}` interpolation; the binder substitutes after resolution.

```ts
type TemplateBundle = {
  journal_title:        LocalizedTemplate
  journal_intro:        LocalizedTemplate              // shown when StartQuest fires
  journal_per_stage:    Record<StageId, LocalizedTemplate>
  journal_success:      LocalizedTemplate
  journal_fail:         LocalizedTemplate
  giver_dialogue_offer: LocalizedTemplate              // surfaced on `talk` to giver, gated keyword
  giver_dialogue_accept: LocalizedTemplate
  giver_dialogue_progress: LocalizedTemplate
  giver_dialogue_complete: LocalizedTemplate
  rumor_seed?:          LocalizedTemplate              // optional rumor that NPCs will spread (Doc #17 §9)
}
```

`LocalizedTemplate` extends Doc #17's `LocalizedString` with the placeholder grammar. Every accessed `{slot.field}` must exist on the resolved type or compilation fails (§10.2).

Worked-template fragment:

```
journal_intro:
  en-US: "I have agreed to fetch {item.name} from {location.name} for {giver.name},
          who claims it was lost there during {giver.backstory_event}. {giver.honorific}
          says I have until {time_window.deadline_local} to return it."
```

### 3.4 Fail conditions

```ts
type FailCondition =
  | { c: "Timeout",           ref: SlotName /* TimeWindow */ }
  | { c: "TargetDead",        ref: SlotName /* NpcRef */ }     // e.g. giver dies → quest fails
  | { c: "ItemDestroyed",     ref: SlotName /* ItemInstance */ }
  | { c: "LocationDestroyed", ref: SlotName /* Location */ }
  | { c: "VirtueFloor",       virtue: Virtue, value: int }     // Avatar drops below; quest auto-fails
  | { c: "FactionFloor",      faction: SlotName /* FactionRef */, value: int }
  | { c: "PartyDispersed",    min_party_size: int }
  | { c: "QuestAbandoned" }                                    // explicit player abandon
```

Fail conditions are evaluated by the same predicate engine that drives Doc #19 §3.1 `fail_predicate`; they compile to ordinary `ConditionNode` instances at bind time.

### 3.5 Prerequisites

Checked at binding time — if any prerequisite is unmet at the moment binding runs, the binder skips this skeleton for this region/seed and tries the next candidate (§5.4 fallback ladder).

```ts
type Prerequisite =
  | { p: "ShardAge",         min_days: int }                   // shard ≥ N days old
  | { p: "RegionAge",        region: RegionId, min_days: int }
  | { p: "FactionExists",    faction: FactionId }
  | { p: "ResourceAvailable", resource_kind: string, region: RegionId, min_count: int }
  | { p: "PreviousArcStage",  arc: ArcId, stage: ArcStageId }   // Doc #26 cross-link
  | { p: "NoActiveQuest",     skeleton: SkeletonId }            // anti-duplication §7.4
  | { p: "PlayerVirtueRange", virtue: Virtue, min: int, max: int }   // skeleton offered only to suitable Avatars
  | { p: "PlayerProgressFlag", scope: PersistenceScope, key: string }
```

`PlayerVirtueRange` and `PlayerProgressFlag` are evaluated **per-recipient** at offer time, not per-region at binding time. The same bound quest can be offered to one Avatar and refused-to-offer to another; this is the mechanism by which the same skeleton skin produces different visible quest sets to different Avatars.

---

## 4. Skeleton Stages

Bound skeletons use ordinary `QuestStage` records (Doc #19 §3.1). The skeleton-side authoring carries `SkeletonStage`, which is a `QuestStage` template.

```ts
type SkeletonStage = {
  id:                   StageId
  name_template:        LocalizedTemplate
  description_template: LocalizedTemplate            // becomes journal text on enter
  entry_effects:        SkeletonAction[]             // ActionNode templates with {slot} refs
  completion_predicate: SkeletonPredicate
  fail_predicate:       SkeletonPredicate | null
  next_stage:           StageRef
  fail_stage:           StageRef | null
  notes:                string                       // designer-only
}

type SkeletonAction = ActionNode                     // Doc #19 §2.2; `params` may include {slot}
type SkeletonPredicate = ConditionNode               // Doc #19 §2.2 with {slot} refs
```

The binder walks every `entry_effects[i].params` and `completion_predicate.predicate`, substituting slot references with their resolved values, producing concrete `ActionNode` and `ConditionNode` records that are valid Doc #19 graph.

### 4.1 Standard stage shape

Most single-skeleton quests follow a 3-stage spine:

| Stage | Typical entry effects | Typical completion predicate |
|---|---|---|
| `OFFER` | `OpenDialogue(giver, ..., tree=offer_tree)` | `FlagSet(scope=PlayerInventory, key="quest:{quest_id}:accepted")` |
| `ACTIVE` | `SetFlag(...)`; depending on kind, may `SpawnEntity` for `slay`/`defend` | Kind-specific (item in inventory; target dead; location reached; ritual completed) |
| `RETURN` | `OpenDialogue(giver, ..., tree=return_tree)` | `FlagSet(...:turned_in)` → terminal `success` |

`escort`, `courier_chain`, `betrayal`, and `mediate` extend the spine; `vigil` collapses it to two stages.

---

## 5. Slot Resolution

The binder is a deterministic resolver that consumes a `QuestSkeleton`, a `RegionId`, a `region_seed`, and a `time_seed`, and produces a `BoundQuest` (a `Quest` ready to be persisted) plus a `ResolutionTrace` for telemetry/moderation.

### 5.1 Inputs and seeds

```ts
type BindRequest = {
  skeleton_id:    SkeletonId
  region_id:      RegionId
  region_seed:    u64                              // stable per region; Doc #8 appendix
  time_seed:      u64                              // hash(shard_day, slot_index)
  for_player_id?: PlayerId                         // if offer-time prerequisites apply
  knobs:          VariationKnobsOverride           // §6, optional
}
```

Determinism: `(skeleton_id, region_seed, time_seed)` → identical resolution result given identical world state at bind time. Live world state is the non-deterministic input — an NPC who died will not be picked, but the absence is a function of world state, not RNG drift.

### 5.2 Resolver pipeline

```
bind(skeleton, request) -> BoundQuest | BindError:
  1. check_prerequisites(skeleton, request)         -> ok | skip
  2. seed_rng = mix(skeleton.id, request.region_seed, request.time_seed)
  3. for slot in topo_sort(skeleton.params):        // dependency order (§5.3)
       candidates = world_query(slot, request, already_bound)
       if candidates.empty:
         return BindError.SLOT_UNRESOLVABLE { slot }
       picked = deterministic_pick(candidates, seed_rng, slot)
       run slot.validate[]; on failure remove and retry
       already_bound[slot.name] = picked
  4. coherence_check(skeleton, already_bound)        // §7; may reject
  5. instantiate_templates(skeleton.templates, already_bound)
  6. compile_stages(skeleton.stages, already_bound)
  7. apply_variation_knobs(...)                      // §6
  8. resolve_rewards(skeleton.rewards, knobs.reward_tier)
  9. assemble Quest { ... } with metadata.bound_from
  10. emit ResolutionTrace
  11. return BoundQuest
```

### 5.3 Slot dependencies

Slots may declare proximity or reachability constraints to other slots (`proximity_to`, `reachable_from` in filters, §3.2). These form a DAG; the binder topo-sorts before resolving. A cycle is a compile-time skeleton error caught by the validator (§10.2).

Worked example: a `slay` skeleton with slots `giver`, `target`, `location`:

- `giver.resolver = NpcRef { faction: "civic.*" }`
- `location.resolver = Location { reachable_from: "giver", max_distance_tiles: 800 }`
- `target.resolver = NpcRef { archetype_pattern: "npc.brigand.*", proximity_to: "location", proximity_tiles: 32 }`

Topo order: `giver → location → target`.

### 5.4 World query

Each slot type has a corresponding query against the live shard:

| Slot type | Query backend |
|---|---|
| `NpcRef` | NPC index keyed by region + faction + archetype pattern; filtered by alive + min_age + excludes |
| `ItemArchetype` | Static archetype registry (Doc #13 §1) |
| `ItemInstance` | Live-instance index in region; filtered by archetype pattern, rarity, weight |
| `Location` | POI index for region (Doc #8 §3.2); biome tags from terrain map |
| `FactionRef` | Faction registry per shard (Doc #6 §5) |
| `ResourceNode` | Resource node index (Doc #18 §4 / Doc #8 §3.5); filtered by region + kind + availability |
| `VirtueDilemma` | Curated dilemma library (§5.6) |
| `TimeWindow` | Computed from shard clock + skeleton constraints + calendar tags |
| `Count` | Drawn from range with seeded RNG |
| `Reward` | §6 reward tier table |
| `Free` | Static literal authored in skeleton |

Queries are bounded — every query has a hard cap of 256 candidates returned; if the cap is reached, pick is biased toward the first-256 by region locality. This bound is a defensive measure against pathological filters.

### 5.5 Deterministic pick

```
deterministic_pick(candidates, seed_rng, slot) -> Candidate:
  rank candidates by:
    1. bias_score(slot, candidate)                 // designer hints; lower = preferred
    2. uniform(seed_rng.fork(slot.name))            // stable shuffle
  return ranked[0]
```

`bias_score` lets designers prefer NPCs whose schedule includes idle slots (so they're available for `talk`), or items whose archetype is locally common, or locations far from existing quest hot spots (anti-monotony, §11).

### 5.6 Virtue dilemma slot

`VirtueDilemma` slots resolve from a curated dilemma library — small authored fragments (~60 fragments at launch, expandable through §10) keyed by virtue axes and polarity. Each fragment carries:

- A **frame** (the moral situation, e.g., "the giver lies about the item's true ownership")
- A **branch_point** (the stage at which the player learns the truth)
- A **virtue_consequences** map for each player choice

Dilemmas inject a *branch* into an otherwise-linear skeleton stage, replacing the simple `RETURN` stage with a forked terminal. The Virtue Engine (Doc #5 §4) scores the chosen branch as it would any verb. This is how a `fetch` of a "lost heirloom" can become a Mercy test ("the rightful owner is the thief") or an Truth test ("the giver lied about who they were").

---

## 6. Variation Knobs

Knobs let the binder produce visibly different quests from the same skeleton — different difficulty, different length, different tone — without re-authoring.

```ts
type VariationKnobs = {
  difficulty:        DifficultyKnob       // affects target HP, reward, time_window tightness
  length:            LengthKnob           // adds/removes optional sub-stages
  reward_tier:       RewardTier           // resolves Reward slots
  narrative_tone:    NarrativeTone        // selects a template variant
  virtue_alignment:  VirtueAlignmentKnob  // biases dilemma selection and reward composition
}

type DifficultyKnob   = "trivial" | "easy" | "standard" | "hard" | "heroic"
type LengthKnob       = "short" | "standard" | "long" | "epic"
type RewardTier       = "minor" | "standard" | "fine" | "great" | "legendary"
type NarrativeTone    = "earnest" | "gallows" | "pastoral" | "ominous" | "comic"
type VirtueAlignmentKnob = "+truth" | "+mercy" | "+courage" | "+justice"
                         | "+devotion" | "+honor" | "+insight" | "+humility"
                         | "neutral" | "shadowed"   // shadowed = deliberately negative-pull
```

### 6.1 Difficulty mapping

| Knob | Target HP scale | Time window | Companion-recommended size |
|---|---|---|---|
| `trivial` | 0.6× base | very loose | solo new Avatar |
| `easy` | 0.8× | loose | solo |
| `standard` | 1.0× | designer default | solo or duo |
| `hard` | 1.4× | tight | duo+ |
| `heroic` | 2.0× | very tight | full party (4+) |

Difficulty knob is selected per-binding by the procedural generator using region difficulty (Doc #8 §3.4) clamped by an offer-time check against the asking Avatar's character level / Virtue title.

### 6.2 Length mapping

| Knob | Stage count | Optional sub-stages added |
|---|---|---|
| `short` | spine only | none |
| `standard` | spine + 1 optional | one of: travel-encounter, optional courier-side-quest, side dialogue |
| `long` | spine + 2–3 | adds chained sub-skeleton (§9) |
| `epic` | spine + 4+ | seeds an arc (Doc #26 §2) |

`epic` length implicitly upgrades the artifact to an Arc; it is reserved for `Trusted` and `Official` skeleton authors (matches Doc #26 §5).

### 6.3 Reward tier resolution

Reward tiers map to gold, items, Virtue deltas, and reputation changes per the Doc #18 economy table. Tiers are clamped by skeleton-declared maxima (`rewards: RewardSpec[]` may declare per-tier ceilings).

```
resolve_rewards(specs, tier) -> RewardEffect[]:
  for spec in specs:
    if spec.kind == "Gold":
      amount = spec.base_gold * tier_multiplier(tier)
      emit RewardEffect.GiveItem { archetype: "currency.gp", count: amount }
    if spec.kind == "Item":
      pool = spec.pool[tier]                       // pre-tiered pool
      pick = deterministic_pick(pool, seed_rng.fork("reward"), null)
      emit RewardEffect.GiveItem { archetype: pick, count: 1 }
    if spec.kind == "Virtue":
      delta = spec.base_delta * tier_multiplier(tier)
      emit RewardEffect.ChangeVirtue { virtue: spec.virtue, delta }
```

Tier multipliers: `minor 0.5, standard 1.0, fine 1.5, great 2.5, legendary 5.0`.

### 6.4 Narrative tone

Tone selects a variant of every `LocalizedTemplate` that has tone-keyed alternates. A pastoral fetch quest reads "I yearn for my grandmother's brass ladle, lost in the brook"; a gallows-toned variant of the same skeleton reads "Aye, the brook took it. Thirty years ago. Ladle, ma, all of it. I'd only like the ladle back." Tone is non-load-bearing — it does not change the spine.

### 6.5 Virtue alignment knob

Biases dilemma selection (§5.6) and reward composition (a `+truth` aligned skeleton is more likely to pick a Virtue dilemma whose "honest" branch is the Avatar's virtuous path, and to emit Truth-tinted Virtue rewards). `shadowed` is the deliberate-negative-pull alignment used in `betrayal` skeletons and Alternate Avermere content.

---

## 7. Coherence Checks

Bound quests must not contradict the world. The coherence checker runs after slot resolution and before the bound quest is committed to the journal or quest registry.

### 7.1 Categories of incoherence

| Category | Example | Check |
|---|---|---|
| **Dead reference** | Target NPC died between resolution and commit | Re-fetch slot entities at commit; reject if dead/destroyed |
| **Reachability** | Item is in a sealed pocket realm; location is across an unreachable border | Pathfinder reachability query (Doc #14 §5.11); reject if no path |
| **Ownership contradiction** | "Fetch the heirloom from the cave" but the heirloom is in another player's inventory | Ownership query (Doc #13 §1.3); reject if owner is `Player` and the player isn't the recipient |
| **Active-quest collision** | Skeleton would fetch the same item another active quest is also fetching | Active-quest registry query keyed on `(item_id, role)` |
| **Faction contradiction** | "Slay the brigand" but the candidate target's faction is now allied with the giver's faction | Faction relation query (Doc #6 §5); reject if relation has flipped |
| **Schedule contradiction** | Giver's schedule has them in a non-interruptible slot for the entire offer window | Doc #17 §6 schedule check; reject if no `talk`-able slot in next 24 game-hours |
| **Lore canon** | Target archetype matches a canonical NPC (Doc #19 §8.3) without Alternate Avermere opt-in | Hard reject; matches Doc #19 validator red flag |
| **Prior-resolved arc** | Skeleton would describe an event already resolved by an arc (Doc #26) | Arc registry query; reject if relevant arc completed contradictorily |
| **Player-witness contradiction** | "Find who killed X" but player witnessed X alive 5 minutes ago | Witness store query (Doc #15 §6.2 / Doc #17 §9); reject |
| **Resource exhaustion** | "Gather 20 mandrake" but the region holds 3 mandrake nodes total | Resource node availability (Doc #18 §4); reject if `available < count * 1.5` |

### 7.2 Coherence pipeline

```
coherence_check(skeleton, bound) -> Ok | Reject(reason):
  for check in skeleton.coherence_hints + STANDARD_CHECKS:
    if check.fails(bound):
      return Reject(check.kind, check.diagnostic)
  return Ok
```

`STANDARD_CHECKS` is the list in §7.1; designer-supplied `coherence_hints` add skeleton-specific rules ("the betrayal target must not be a quest-critical NPC for any active hand-authored quest of any party member in the region").

### 7.3 Reject behavior

A reject is **not** an error in the player's view — it never reaches the player. The procedural generator simply moves to the next skeleton in its candidate ladder (§5.4 / §11.2) and tries again. If three skeletons reject in a row for a region+slot, the slot is flagged for live-team review (§10.5 telemetry) and the binder exits gracefully without filling the slot. This region simply has fewer side quests today than it might have had — the world doesn't break.

### 7.4 Anti-duplication

The active-quest registry (§7.1 row 4) is normative. Two players in the same region cannot both be "fetch the same lost heirloom" simultaneously unless the skeleton declares `cooperative: true` (most do not). When the registry has the `(item_archetype, location, kind)` triple in flight, the binder must pick a different `item` and `location` or skip.

`Prerequisite.NoActiveQuest { skeleton }` (§3.5) provides per-skeleton uniqueness: a skeleton may declare itself rare ("only one `betrayal_at_empath_abbey` may be active per shard at a time").

### 7.5 Drift detection during play

Coherence holds at bind time, but the world keeps moving. A bound quest's referenced NPC may die mid-quest. The checker runs again at every stage advance (`StageEntered` event) — if a now-required reference has become invalid, the quest auto-fails with a `coherence_drift` reason and an apologetic journal entry uses the skeleton's `journal_fail` template.

```
on_stage_entered(quest, stage):
  if not coherence_check(quest.skeleton, quest.bindings):
    fail_quest(quest, reason="coherence_drift", template=quest.journal_fail)
    increment_telemetry "skeleton.coherence_drift" by 1
```

---

## 8. Reward Resolution & Virtue Plumbing

### 8.1 Reward composition

A `RewardSpec[]` is authored per skeleton; tier resolution (§6.3) produces a concrete `RewardEffect[]` (Doc #19 §3.1). Rewards may include:

- `Gold` — converted to `currency.gp` GiveItem
- `Item` — pool-based pick; archetype validated against the skeleton's allowed archetypes
- `Virtue` — `ChangeVirtue` routed through Virtue Engine (Doc #5 §4); never written direct
- `Reputation` — faction reputation delta (Doc #6 §5)
- `Flag` — `SetFlag` with declared scope (`PlayerInventory` for personal advancement, `WorldState` for shared)
- `Title` — `Avatar` title or rumor seed; routes through Doc #15 §7.3 / Doc #17 §9

### 8.2 Reward signage

Bound quests pre-sign their reward Virtue impact at bind time and write it to the journal entry that the player sees on offer (visible only to the player; the offer dialogue does not show all eight axes — it shows up to two emphasized virtues that the skeleton expects to move). This matches the BG/SI offer pattern of "this seems an honourable task" framing.

### 8.3 Cancellation / abandonment

The `QuestAbandoned` fail condition (§3.4) routes to the standard quest-abandon path (Doc #19 §3.1 stage `end: "abandoned"`). Skeleton-bound quests abandoned by the player do **not** apply reward Virtue deltas, but **may** apply a small Honor penalty if the skeleton declares `abandon_honor_penalty: int` (most do not; this is reserved for "I gave my word" framings).

---

## 9. Chaining

A skeleton binding may compose other skeleton bindings. Composition is the mechanism by which `courier_chain`, `betrayal`, and `mediate` work, and it is also the mechanism by which §6.3 `length: long` skeletons add sub-stages.

### 9.1 Chain hooks

```ts
type ChainHook = {
  id:                ChainHookId
  trigger_stage:     StageId                          // hook fires when this stage of the parent enters
  child_skeleton:    SkeletonId                       // sub-skeleton to bind
  inherit_slots:     Record<SlotName, SlotName>       // map parent's slots → child's slots
  inherit_seed:      "fork" | "share"                 // fork: child gets fresh time_seed; share: child uses parent's
  on_child_outcome:
    | { outcome: "success"; advance_parent_to: StageId }
    | { outcome: "fail";    advance_parent_to: StageId }
    | { outcome: "success"; merge_journal: true }     // child stages appear inline in parent's journal
}
```

A `courier_chain` is implemented as a parent skeleton whose `ACTIVE` stage carries 3 chain hooks (one per hop), each binding a `deliver` sub-skeleton with `inherit_slots: { recipient: "next_recipient" }`.

### 9.2 Chain composition rules

1. **Depth cap.** Chain depth ≤ 3. Beyond that becomes an `Arc` (Doc #26 §2). Enforced at binding.
2. **Cycle prevention.** A child skeleton cannot be `parent_skeleton.id` or any ancestor. Static check in §10.2.
3. **Slot inheritance.** Inherited slots skip resolution; they reuse the parent's bound entity. Non-inherited slots resolve normally for the child's region/seed.
4. **Reward composition.** A chain emits each child's rewards plus the parent's rewards. Total reward is bounded — the parent's `rewards` may declare `cap_total_with_chain: bool`; if true, the parent's rewards are reduced proportionally.
5. **Coherence cascading.** Coherence rejection at any level rejects the entire chain; the parent skips and the binder tries another candidate.

### 9.3 Reproducibility under chain

Given `(parent_skeleton.id, region_seed, time_seed)`, every child binding's seed is derived by `child_seed = mix(parent_seed, hook.id, child_skeleton.id)`. This means the entire chain is reproducible from the root request — load-bearing for moderation review (Doc #29) and bug repro.

### 9.4 Chain to Arc promotion

When a chain reaches depth 3 *or* `length: epic`, the binder emits an `Arc` (Doc #26 §2) instead of a deeply-nested quest. The Arc's `stages` are the parent + chain stages flattened, and the bound quests become `stage_quests[]`. This is the formal bridge between this document and Doc #26.

---

## 10. Authoring Tooling

### 10.1 Editor surface

Skeleton authoring extends Doc #19's "Trigger & Dialogue Editor" with a new "Skeleton" tab. Per the Doc #41 Engine & Stack ADR, the authoring editor is a **web/TypeScript application** (the same TS/PixiJS-family stack that powers the web prototype client); designers work in a browser, the editor calls the authoritative Rust server's compile/playtest tools (§10.2, §10.5, §15) over the Protobuf wire protocol, and the binder remains server-side. UE5 has no role in skeleton authoring. The tab is a forked variant of the visual node editor with skeleton-aware affordances:

- **Slot panel** — table of declared slots; each row shows `name`, `type`, `resolver`, `validate[]`. Drag a slot reference (`{slot}`) into any template field to wire it.
- **Template editor** — text-area per template field with live-preview using a sample binding (sample bindings drawn from a fixture region, §10.3).
- **Stage graph** — same node graph as Doc #19, but with a constrained palette (only nodes that compile under skeleton context).
- **Variation preview** — slider per knob in §6 produces a live re-binding against the fixture; designer sees the journal text update.
- **Coherence sandbox** — designer can manually fail an entity (kill a fixture NPC, destroy an item) and confirm coherence drift fires correctly.

### 10.2 Skeleton compiler

Compiles a skeleton to an immutable bytecode-ish representation that the binder consumes.

| Pass | Check |
|---|---|
| 1. Parse | YAML/JSON syntax; required top-level fields |
| 2. Slot graph | Topo-sort slots; reject on cycle |
| 3. Type check | Every `{slot.field}` reference's field exists on the slot's type |
| 4. Template completeness | Every `LocalizedTemplate` populated for at least the shard's required locales |
| 5. Stage graph | Same Doc #19 §2.4 type-check on `entry_effects` and `predicate`s |
| 6. Reward bounds | Rewards stay within author's sandbox-level reward ceiling (§10.6) |
| 7. Chain validity | Chain depth ≤ 3; no cycles |
| 8. Virtue validator | Same Doc #19 §8 pass; Virtue alignment scored |
| 9. Coherence-hint sanity | Hints are well-formed predicate nodes |

Failure produces structured diagnostics (`{ severity, slot_or_node, message }`), surfaced in editor.

### 10.3 Fixture regions

Designers test skeletons against a **fixture region** — a frozen synthetic shard with known NPCs, items, factions, and a stable seed. Fixture regions live in version control alongside skeleton files and are loaded into a sandboxed binder for the editor's preview pane and for the auto-test step (§10.5).

The launch fixture set:

| Fixture | Purpose |
|---|---|
| `fixture.britain_baseline` | Standard civic region; many NPCs, mid resource availability |
| `fixture.frontier_sparse` | Frontier region with few NPCs and resources; tests resource-exhaustion handling |
| `fixture.dungeon` | Pocket realm; tests `forbid_pocket_realm` and reachability |
| `fixture.mid_arc` | Region mid-Arc; tests prior-resolved-arc coherence |
| `fixture.alternate_avermere` | Alt-avermere opt-in fixture; tests canonical-NPC slot resolution under opt-in |

### 10.4 Hot reload

Edits to a skeleton in the editor produce a new immutable compiled blob. The skeleton registry is versioned per-skeleton; existing bound quests reference the version they were bound from and are unaffected. New bindings after the edit pick up the new version.

A `Retired` skeleton remains in the registry but is excluded from new bindings; existing bound quests continue to completion against their bound version.

### 10.5 Auto-test

Per Doc #19 §9 step 4, every submitted skeleton is auto-tested:

1. Bind the skeleton against each fixture region.
2. Force every stage to enter at least once (synthetic event injection).
3. Force fail conditions to fire at least once each.
4. Force every chain hook to fire.
5. Drift-test: kill or destroy each slot's bound entity and assert coherence drift fires correctly.
6. Record state diffs and Virtue deltas; reject if diff differs across two identical-seed runs (determinism violation).

Test runs are bounded (max 60 seconds per skeleton); a skeleton that does not converge is rejected with `ERR_SKELETON_AUTOTEST_TIMEOUT`.

### 10.6 Author sandbox levels

Maps to Doc #19 §5 sandbox levels:

| Sandbox | May author skeletons of kinds | Max length | Max reward tier | Cross-region scope |
|---|---|---|---|---|
| `Restricted` | none (cannot author skeletons) | n/a | n/a | n/a |
| `Standard` | none (skeletons require `Trusted`+) | n/a | n/a | n/a |
| `Trusted` | all primary kinds (§2.1) | `long` | `fine` | `Local` and `Regional` |
| `Official` | all + canonical-NPC slots under Alt-Avermere | `epic` | `legendary` | any |

Phase 1 does not include UGC skeleton authoring (matches Doc #19 §13); the launch library is Origin-authored.

---

## 11. Anti-Monotony

### 11.1 The boredom problem

A region with one binding loop will produce visibly similar quests if the binder runs unconstrained. Anti-monotony is the suite of policies that bias variety into the binder.

### 11.2 Rotation and cooldown

```ts
type RotationPolicy = {
  per_skeleton_cooldown_seconds:    int        // default 86400 (1 real day) per region
  per_kind_cooldown_seconds:        int        // default 3600 per region
  shard_concurrent_quota:           Record<SkeletonKind, int>   // e.g. { betrayal: 3, escort: 8 }
  region_concurrent_quota:          Record<SkeletonKind, int>   // e.g. { fetch: 4, slay: 3 }
  retire_after_n_completions:       int        // skeleton retired after N completions until refreshed
}
```

The binder's candidate set is filtered by rotation policy: a skeleton on cooldown is excluded; a kind that has hit its concurrent quota is excluded; a skeleton retired after N completions is excluded until a refresh interval.

### 11.3 Bias against repetition

Within candidate ranking (§5.5), skeletons that have been bound recently in the same region carry an additive penalty. Skeletons whose authoring tag set is heavily represented in active quests get a smaller penalty. The penalty is logarithmic in count — the first repeat is mildly discouraged; the fifth repeat is strongly discouraged.

### 11.4 Shard-wide quota

`shard_concurrent_quota` is a hard cap per shard. The Guardian-influenced incursion arc (Doc #26) uses this to ensure that during an active incursion, the `betrayal` and `slay` kinds are over-represented but never to the point of crowding out the rest of the kind taxonomy. The cap is enforced at bind time.

### 11.5 Per-Avatar exposure

A bound quest may be in flight in a region and offered to multiple Avatars in succession; once an Avatar has *completed* (success or fail) a binding of skeleton X, that Avatar will not see the same skeleton X re-offered for `per_avatar_repeat_cooldown_seconds` (default 7 days game-time). This is a per-Avatar journal-level filter, not a binding-level filter — the same binding may still be live for other Avatars.

---

## 12. LLM-Assisted Variation

### 12.1 Why optional, not load-bearing

Templates with named-author tone (§6.4) cover the common case; LLM assistance is offered for **flavor expansion only** — a small, optional layer that produces tone-faithful variants of journal text. The skeleton system is designed to operate fully without any LLM involvement; LLMs are a polish layer, never a coherence layer.

### 12.2 What LLMs may do

| Allowed | Forbidden |
|---|---|
| Rewrite a journal-text template to a tone variant authored designer-tagged | Create or modify a stage graph |
| Generate a `rumor_seed` paraphrase for the same rumor | Change slot bindings |
| Generate alt phrasings of a giver's offer dialogue | Decide which NPC to pick as a slot binding |
| Generate ambient flavor prose for a `journal_per_stage` template | Determine fail conditions, prerequisites, or rewards |
| Translate a template to a new locale (deferred to Doc #33) | Score Virtue alignment |

LLM output is **always cached** by `(skeleton_id, version, template_id, knob_signature, locale)` keys. A template's first generation may invoke the LLM; subsequent identical requests hit the cache. Cache eviction is by LRU within a per-shard quota.

### 12.3 Deterministic fallback

Every template has a designer-authored canonical text. If LLM generation is disabled, fails, or the cache is unavailable, the binder uses the canonical text. **Skeleton determinism (§5.1) is preserved by treating the LLM result as a non-load-bearing decoration.** Two binders with the same seeds but different LLM availability produce textually different journal entries but identical quest spines.

### 12.4 Boundaries

- LLM never touches `entry_effects`, `completion_predicate`, `fail_predicate`, `rewards`, or `prerequisites`.
- LLM never sees player names, real-name verification data, chat history, or other PII (Doc #29 boundary).
- LLM output is filtered through the moderation pre-filter (Doc #29) before it reaches a journal page; rejected output falls back to the canonical text.
- A creator's `Trusted`-level skeleton may opt-out of LLM variation entirely with `llm_variation: "disabled"` in the skeleton metadata.

### 12.5 Phase 1 scope

LLM-assisted variation is **deferred to Phase 2**. Phase 1 ships canonical-text-only skeletons.

---

## 13. Telemetry

Every binding emits structured events. Telemetry powers Doc #28 dashboards and §10.5 designer feedback.

### 13.1 Event taxonomy

```
skeleton.bind.attempted     { skeleton_id, region_id, region_seed, time_seed, knobs }
skeleton.bind.succeeded     { skeleton_id, quest_id, region_id, slots: { name → resolved_id }, knobs }
skeleton.bind.skipped       { skeleton_id, region_id, reason: "prereq" | "no_candidates" | "coherence" | "quota" }
skeleton.bind.rejected      { skeleton_id, region_id, reason, diagnostic }
skeleton.offered            { quest_id, player_id, npc_id }
skeleton.accepted           { quest_id, player_id }
skeleton.completed          { quest_id, player_id, outcome: "success" | "fail" | "abandoned", duration_seconds }
skeleton.coherence_drift    { quest_id, slot, drift_kind }
skeleton.chain_resolved     { parent_quest_id, child_quest_id, hook_id, child_outcome }
skeleton.llm_invoked        { skeleton_id, template_id, cache_hit: bool, latency_ms }
```

### 13.2 Per-skeleton dashboard

For each skeleton in the registry, the live-ops dashboard surfaces:

| Metric | Interpretation |
|---|---|
| `bind_success_rate` | bind succeeded / bind attempted; low ⇒ prerequisites or coherence too tight |
| `offer_acceptance_rate` | accepted / offered; low ⇒ template language unappealing or knob mismatch |
| `completion_rate` | completed{success} / accepted; low ⇒ difficulty too high, time window too tight, or coherence drift |
| `abandon_rate` | abandoned / accepted; high ⇒ length too long, content unrewarding |
| `drift_rate` | coherence_drift / completed; high ⇒ slot filters too lax |
| `time_to_complete_p50/p95` | duration distribution; informs length knob calibration |

### 13.3 Broken-quest alerts

A `coherence_drift` rate above a per-skeleton threshold (default 5%) raises a moderation alert (Doc #29). A `bind_success_rate` below 20% over a rolling 24-hour window raises a designer alert.

### 13.4 Privacy

Telemetry events include `player_id` for completion events but are anonymized for any cross-skeleton aggregate dashboard surfaced to UGC creators (§10.6 Hall of Wonders metrics show counts and tier histograms, never individual player ids).

---

## 14. Persistence

References Doc #6 §3 / Doc #13 §3 / Doc #21 §3.

### 14.1 Storage layout

| Artifact | Scope | owner_key | Visibility |
|---|---|---|---|
| Skeleton template (compiled blob) | `WorldState` | `"skeleton:" + skeleton_id` | All shards (cross-shard skeleton library) |
| Skeleton authoring metadata (creator, drafts) | `HousingAndCreations` | `PlayerId` | Creator only |
| Bound quest (the `Quest` instance) | `WorldState` | `RegionId` | All players in region |
| Binding metadata (`bound_from`, slot resolution, knobs) | `WorldState` | `RegionId` (same row) | All; redacted for player capability sets |
| Per-Avatar quest progress | `PlayerInventory` | `PlayerId` | Avatar only |
| Resolution trace | `Telemetry` (off-shard) | n/a | Live-ops/QA only |
| LLM cache | `WorldState` | `"skeleton_llm_cache"` (shard-singleton) | Internal |

### 14.2 SQL (additions to Doc #21 §3)

```sql
-- skeletons — registry of compiled skeleton templates
CREATE TABLE skeletons (
  skeleton_id          TEXT          PRIMARY KEY,
  version              INT           NOT NULL,
  kind                 TEXT          NOT NULL,
  author_kind          TEXT          NOT NULL CHECK (author_kind IN ('official','player')),
  author_avatar_id     BIGINT        NULL REFERENCES player_avatars (avatar_id),
  compiled_blob        BYTEA         NOT NULL,
  publish_state        TEXT          NOT NULL,
  virtue_score         INT           NOT NULL DEFAULT 0,
  llm_variation        TEXT          NOT NULL DEFAULT 'enabled',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  retired_at           TIMESTAMPTZ   NULL
);
CREATE INDEX idx_skeletons_active ON skeletons (publish_state) WHERE retired_at IS NULL;
CREATE INDEX idx_skeletons_kind   ON skeletons (kind);

-- skeleton_bindings — record of every binding produced
CREATE TABLE skeleton_bindings (
  binding_id           BIGSERIAL     PRIMARY KEY,
  skeleton_id          TEXT          NOT NULL REFERENCES skeletons (skeleton_id),
  skeleton_version     INT           NOT NULL,
  shard_id             TEXT          NOT NULL,
  region_id            TEXT          NOT NULL,
  region_seed          BIGINT        NOT NULL,
  time_seed            BIGINT        NOT NULL,
  quest_id             TEXT          NOT NULL,                    -- generated quest id
  knobs                JSONB         NOT NULL,
  slots                JSONB         NOT NULL,                    -- name → resolved id
  bound_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  retired_at           TIMESTAMPTZ   NULL                         -- coherence_drift / completion sets
);
CREATE INDEX idx_bindings_active     ON skeleton_bindings (shard_id, region_id) WHERE retired_at IS NULL;
CREATE INDEX idx_bindings_skeleton   ON skeleton_bindings (skeleton_id, skeleton_version);
CREATE INDEX idx_bindings_quest      ON skeleton_bindings (quest_id);

-- skeleton_active_collisions — anti-duplication index (§7.4)
CREATE TABLE skeleton_active_collisions (
  shard_id      TEXT  NOT NULL,
  region_id     TEXT  NOT NULL,
  collision_key TEXT  NOT NULL,                                    -- e.g. "fetch:item.heirloom.bronze:cave.iron"
  binding_id    BIGINT NOT NULL REFERENCES skeleton_bindings (binding_id) ON DELETE CASCADE,
  PRIMARY KEY (shard_id, region_id, collision_key)
);
```

Migration filename per project rule: `YYYYMMDDHHmmss_add_skeletons.pg.sql` / `.sqlite.sql` (Doc #21 §4).

---

## 15. MCP Surface

Amendments to Doc #14 §5/§6, gated by capabilities defined in Doc #14 §3 and Doc #19 §12.

### 15.1 New tools (capability tier `procgen.author` and `procgen.bind`)

```json
{
  "name": "compile_skeleton",
  "capability": "procgen.author",
  "input": {
    "envelope": "VerbEnvelope",
    "source": { "kind": "skeleton_yaml", "yaml": "string" }
            | { "kind": "skeleton_json", "json": "object" }
  },
  "returns": {
    "ok": "boolean",
    "skeleton_id": "string | null",
    "version": "int | null",
    "diagnostics": [
      { "severity": "error|warning|info", "slot_or_node": "string|null", "message": "string" }
    ],
    "virtue_score": "int | null"
  }
}
```

```json
{
  "name": "bind_skeleton",
  "capability": "procgen.bind",
  "input": {
    "envelope": "VerbEnvelope",
    "skeleton_id": "string",
    "region_id": "string",
    "knob_overrides": "object"
  },
  "returns": {
    "ok": "boolean",
    "quest_id": "string | null",
    "slots": "object",
    "skipped_reason?": "prereq|no_candidates|coherence|quota"
  }
}
```

```json
{
  "name": "playtest_skeleton",
  "capability": "procgen.author",
  "input": {
    "envelope": "VerbEnvelope",
    "skeleton_id": "string",
    "fixture_id": "string"
  },
  "returns": {
    "ok": "boolean",
    "trace_uri": "string | null"
  }
}
```

### 15.2 New resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/skeletons` | `skeleton_list`: live skeletons with kind, tags, version, author | `inspect.read` |
| `forge://shard/{s}/skeletons/{id}` | `skeleton_detail`: redacted for player capability (no internal predicate text); full for designer | designer/QA |
| `forge://shard/{s}/skeletons/{id}/metrics` | dashboard metrics from §13.2 | `live_ops.read` |
| `forge://shard/{s}/region/{r}/active_bindings` | bound quests in flight; redacted slot metadata for player capability | `inspect.read` |
| `forge://shard/{s}/skeletons/library/templates` | fixture-region preview bindings for the editor | `procgen.author` |

All `procgen.*` tools resolve to verbs that flow through `PlayerInputDispatcher` → `VerbDispatcher` per Doc #14 §4 invariant 1. No new ingress.

---

## 16. Worked Examples

Five fully-resolved bindings. Each shows the skeleton, the binding inputs, the resolved slots, and the resulting journal text.

### 16.1 Example A — `fetch` in the Highmere frontier

**Skeleton:** `official.fetch.lost_heirloom`
**Inputs:** `region_id="highmere.northwood_wilds"`, `region_seed=0x7a3f...`, `time_seed=0x21bc...`, `knobs={ difficulty: standard, length: short, reward_tier: standard, narrative_tone: pastoral, virtue_alignment: +mercy }`

```yaml
id: official.fetch.lost_heirloom
kind: fetch
tags: [solo_friendly, no_combat, short, frontier]
params:
  - { name: giver,       type: { t: NpcRef, filter: { faction: "civic.*", schedule_tag: "shopkeeper", min_age_days: 7 } }, required: true, bind_at: instantiate }
  - { name: item,        type: { t: ItemArchetype, filter: { archetype_pattern: "item.heirloom.*", weight_max: 5.0 } }, required: true, bind_at: instantiate }
  - { name: location,    type: { t: Location, filter: { poi_kind: "ruin", reachable_from: giver, max_distance_tiles: 600 } }, required: true, bind_at: instantiate }
  - { name: time_window, type: { t: TimeWindow, min_seconds: 86400, max_seconds: 259200 }, required: true, bind_at: instantiate }
  - { name: reward,      type: { t: Reward, tier: from_knob }, required: true, bind_at: instantiate }
fail_conditions:
  - { c: Timeout, ref: time_window }
  - { c: TargetDead, ref: giver }
templates:
  journal_intro:
    en-US: "{giver.name} of {giver.home}, the {giver.honorific}, has asked me to recover
            {item.indef_article} {item.name} lost in {location.name}. {giver.pronoun_subject}
            says it was their grandmother's, and that they would have gone themselves if not for
            their failing knees. I have until {time_window.deadline_local} to bring it back."
```

**Resolved slots:**

| Slot | Resolved value |
|---|---|
| `giver` | `npc.commoner.elara` (Elara Mossleaf, baker of Northwood Hamlet, age 67, schedule `Work` 06:00–14:00, `Idle` 14:00–18:00) |
| `item` | `item.heirloom.brass_ladle` (a brass ladle, weight 0.4kg) |
| `location` | `region.highmere.northwood_wilds.ruin.old_well` (the Old Well ruin, 412 tiles from Elara's bakery, walkable via the north road) |
| `time_window` | 2 game-days (172,800 seconds), deadline `Day 47, 06:00` |
| `reward` | `currency.gp × 80`, `Mercy +2` |

**Journal text (after interpolation):**

> Elara Mossleaf of Northwood Hamlet, the baker, has asked me to recover a brass ladle lost in the Old Well. She says it was her grandmother's, and that she would have gone herself if not for her failing knees. I have until Day 47, 06:00 to bring it back.

**Coherence checks passed:** Elara is alive (drift check OK), the brass ladle archetype exists and an instance was placed at the Old Well during region generation (Doc #8 §3.2 POI population), the Old Well is reachable by foot from Elara's bakery (~7 game-minute walk), the Northwood Hamlet faction is at peace, no other active quest claims this ladle.

---

### 16.2 Example B — `slay` with misidentification dilemma

**Skeleton:** `official.slay.local_terror`
**Inputs:** `region_id="highmere.eastern_fens"`, `region_seed=0xe7a1...`, `time_seed=0x44df...`, `knobs={ difficulty: hard, length: standard, reward_tier: fine, narrative_tone: ominous, virtue_alignment: +justice }`

```yaml
id: official.slay.local_terror
kind: slay
tags: [combat_heavy, moral_choice, standard, wild]
params:
  - { name: giver,    type: { t: NpcRef, filter: { faction: "civic.*", schedule_tag: "elder|guard" } }, required: true }
  - { name: location, type: { t: Location, filter: { biome: ["swamp","forest"], reachable_from: giver, max_distance_tiles: 1200 } }, required: true }
  - { name: target,   type: { t: NpcRef, filter: { archetype_pattern: "npc.creature.*|npc.brigand.*", proximity_to: location, proximity_tiles: 64 } }, required: true }
  - { name: dilemma,  type: { t: VirtueDilemma, axes: [Justice, Mercy], polarity: either }, required: true }
  - { name: reward,   type: { t: Reward, tier: from_knob }, required: true }
fail_conditions:
  - { c: TargetDead, ref: giver }
  - { c: ItemDestroyed, ref: location }     # no-op for Location, but defensive
coherence_hints:
  - { hint: "target.faction must not be allied with giver.faction" }
chain_hooks:
  - id: reveal_misidentification
    trigger_stage: ACTIVE
    child_skeleton: official.investigate.who_is_the_terror
    inherit_slots: { suspect_set: target_neighbors }
    inherit_seed: fork
    on_child_outcome: { outcome: success, advance_parent_to: DILEMMA }
```

**Resolved slots:**

| Slot | Resolved value |
|---|---|
| `giver` | `npc.elder.fenswick.oren` (Elder Oren of Fenswick) |
| `location` | `region.highmere.eastern_fens.bog.willowmere` (Willowmere Bog) |
| `target` | `npc.creature.bog_lurker.0xa3f1` (a bog lurker; specifically: `is_innocent = false`, faction `wildlife.bog`) |
| `dilemma` | `dilemma.justice_compassion.04` — "The 'lurker' is a transformed missing villager; killing it ends the curse but kills the villager" |
| `reward` | `currency.gp × 250`, `item.weapon.silvered_dagger × 1`, `Justice +3` (success), `Mercy +5` (mercy branch) |

**Branched outcome:** the chain hook `reveal_misidentification` fires when the player examines the lurker mid-combat (`OnUse` trigger on the lurker entity reveals a curse-bound amulet). On reveal, the `DILEMMA` stage offers two terminal branches:

- **Slay** — finish the kill; Justice +3, Mercy −2; the village is safe, the villager is gone.
- **Spare** — leave; chain into `official.cleanse.curse_bound` for the cleanse path; Mercy +5, Devotion +2.

**Coherence checks passed:** Elder Oren is alive and his schedule is interruptible during 18:00–22:00, the bog lurker exists, Willowmere is walkable, no allied-faction contradiction, the dilemma is appropriate to the slay kind under `+justice` alignment.

---

### 16.3 Example C — `courier_chain`, three-hop

**Skeleton:** `official.courier_chain.sealed_letter`
**Inputs:** `region_id="highmere.stonereach"`, `region_seed=0x13ab...`, `time_seed=0x99e2...`, `knobs={ difficulty: easy, length: long, reward_tier: standard, narrative_tone: earnest, virtue_alignment: +honor }`

```yaml
id: official.courier_chain.sealed_letter
kind: courier_chain
tags: [social, no_combat, long, civic]
params:
  - { name: start_giver,     type: { t: NpcRef, filter: { faction: "civic.*", schedule_tag: "scribe|noble" } }, required: true }
  - { name: package,         type: { t: ItemArchetype, filter: { archetype_pattern: "item.letter.sealed.*" } }, required: true }
  - { name: hop_b,           type: { t: NpcRef, filter: { faction: "civic.*", proximity_to: start_giver, proximity_tiles: 1500 } }, required: true }
  - { name: hop_c,           type: { t: NpcRef, filter: { faction: "civic.*", proximity_to: hop_b, proximity_tiles: 1500 } }, required: true }
  - { name: final_recipient, type: { t: NpcRef, filter: { faction: "civic.*", proximity_to: hop_c, proximity_tiles: 1500 } }, required: true }
  - { name: reward,          type: { t: Reward, tier: from_knob }, required: true }
chain_hooks:
  - id: hop_b_delivery
    trigger_stage: HOP_A_TO_B
    child_skeleton: official.deliver.basic
    inherit_slots: { giver: start_giver, recipient: hop_b, package: package }
    inherit_seed: fork
    on_child_outcome: { outcome: success, advance_parent_to: HOP_B_TO_C, merge_journal: true }
  - id: hop_c_delivery
    trigger_stage: HOP_B_TO_C
    child_skeleton: official.deliver.basic
    inherit_slots: { giver: hop_b, recipient: hop_c, package: package }
    inherit_seed: fork
    on_child_outcome: { outcome: success, advance_parent_to: HOP_C_TO_FINAL, merge_journal: true }
  - id: final_delivery
    trigger_stage: HOP_C_TO_FINAL
    child_skeleton: official.deliver.basic
    inherit_slots: { giver: hop_c, recipient: final_recipient, package: package }
    inherit_seed: fork
    on_child_outcome: { outcome: success, advance_parent_to: COMPLETE, merge_journal: true }
```

**Resolved slots:**

| Slot | Resolved value |
|---|---|
| `start_giver` | `npc.scribe.stonereach.danil` (Danil the Scribe) |
| `package` | `item.letter.sealed.bronze_seal` (a letter bearing a bronze seal) |
| `hop_b` | `npc.merchant.cove.merielle` (Merielle of Cove) |
| `hop_c` | `npc.guard.highmere.captain.thane` (Captain Thane of Highmere) |
| `final_recipient` | `npc.noble.highmere.lady.harriet` (Lady Harriet) |
| `reward` | `currency.gp × 220`, `Honor +4`, faction reputation `civic.highmere +5` |

The journal merges all three child quest journals inline; the player sees one continuous quest with milestones at each hop. Each hop's giver dialogue is generated from `official.deliver.basic`'s templates, retoned by the parent's `narrative_tone: earnest`.

**Anti-monotony:** `start_giver`, `hop_b`, `hop_c`, `final_recipient` are required to be distinct (validator rule); the `proximity_to` chain forces the route to traverse the world rather than circling.

---

### 16.4 Example D — `betrayal` with shadowed alignment

**Skeleton:** `official.betrayal.fellowship_recruiter`
**Inputs:** `region_id="highmere"`, `region_seed=0x5ca1...`, `time_seed=0x7711...`, `knobs={ difficulty: standard, length: standard, reward_tier: fine, narrative_tone: ominous, virtue_alignment: shadowed }`

```yaml
id: official.betrayal.fellowship_recruiter
kind: betrayal
tags: [moral_choice, social, medium, civic, trickster]
params:
  - { name: apparent_giver,     type: { t: NpcRef, filter: { faction: "fellowship", schedule_tag: "recruiter" } }, required: true }
  - { name: apparent_quest,     type: { t: ItemArchetype, filter: { archetype_pattern: "item.scroll.fellowship.*" } }, required: true }
  - { name: true_objective,     type: { t: NpcRef, filter: { faction: "fellowship.inner", excludes_canonical: true } }, required: true }
  - { name: reveal_trigger,     type: { t: Free, kind: string }, required: true }
  - { name: reward_truth,       type: { t: Reward, tier: from_knob }, required: true }
  - { name: reward_complicity,  type: { t: Reward, tier: from_knob }, required: true }
fail_conditions:
  - { c: VirtueFloor, virtue: Truth, value: 5 }
prerequisites:
  - { p: ShardAge, min_days: 14 }
  - { p: PlayerVirtueRange, virtue: Truth, min: 30, max: 100 }
```

**Resolved slots:**

| Slot | Resolved value |
|---|---|
| `apparent_giver` | `npc.fellowship.recruiter.morton` (Morton, recruiter at the Highmere Fellowship hall) |
| `apparent_quest` | `item.scroll.fellowship.recruitment` |
| `true_objective` | `npc.fellowship.inner.batlin_acolyte.virela` (Virela, an inner-circle acolyte) |
| `reveal_trigger` | `"on_dialogue_keyword:trinity"` (when the player asks about "trinity" in dialogue with Morton) |
| `reward_truth` | `Truth +6`, `Honor +3`, `currency.gp × 180`, faction `civic.highmere +5` |
| `reward_complicity` | `currency.gp × 600`, faction `fellowship.inner +10`, `Truth −4`, `Justice −3` |

**Branch:** Morton recruits the Avatar to "deliver a recruitment scroll" to a target town. Mid-quest, on the `trinity` keyword, the truth surfaces: the scroll contains coded instructions to identify a Resistance sympathizer for elimination. The Avatar may **report Morton to the Highmere town guard** (truth branch — high Virtue rewards, Fellowship faction loss) or **complete the delivery to Virela** (complicity branch — large gold and Fellowship inner-circle access, Virtue cost, world-state flags propagated to the Guardian Incursion arc per Doc #26).

The shadowed alignment knob biases the dilemma library (§5.6) toward this betrayal; the prerequisite floors prevent it from being offered to low-Truth Avatars (who would not provide the moral tension the skeleton exists to create).

---

### 16.5 Example E — `gather` with resource constraint

**Skeleton:** `official.gather.healer_supplies`
**Inputs:** `region_id="highmere.blackford"`, `region_seed=0x88f1...`, `time_seed=0x33a0...`, `knobs={ difficulty: easy, length: short, reward_tier: minor, narrative_tone: pastoral, virtue_alignment: +humility }`

```yaml
id: official.gather.healer_supplies
kind: gather
tags: [no_combat, short, civic, solo_friendly]
params:
  - { name: recipient,    type: { t: NpcRef, filter: { archetype_pattern: "npc.healer.*|npc.druid.*" } }, required: true }
  - { name: resource,     type: { t: ResourceNode, filter: { kind: "herb", region: blackford } }, required: true }
  - { name: count,        type: { t: Count, min: 5, max: 12 }, required: true }
  - { name: biome_or_region, type: { t: Location, filter: { biome: ["forest"], reachable_from: recipient, max_distance_tiles: 800 } }, required: true }
  - { name: reward,       type: { t: Reward, tier: from_knob }, required: true }
prerequisites:
  - { p: ResourceAvailable, resource_kind: "herb.silverleaf", region: "highmere.blackford", min_count: 18 }
fail_conditions:
  - { c: TargetDead, ref: recipient }
```

**Resolved slots:**

| Slot | Resolved value |
|---|---|
| `recipient` | `npc.druid.blackford.brendel` (Brendel the druid) |
| `resource` | `resource.herb.silverleaf` (a forest herb cluster, 18 nodes available in the region) |
| `count` | 8 |
| `biome_or_region` | `region.highmere.blackford.silverwood` (the Silverwood) |
| `reward` | `currency.gp × 30`, `Humility +2`, `item.potion.minor_heal × 2` |

**Coherence:** the prerequisite `ResourceAvailable` ensured the Silverwood actually has enough silverleaf to support an 8-pick quest with 1.5× safety margin (per §7.1 row "resource exhaustion"). If a competing player completes another silverleaf gather quest concurrently and node count drops below the threshold, this binding's drift check at next stage entry will succeed (the count is locked at bind time from the player's perspective; the world-side resource check is for binder availability, not quest validity once accepted).

---

## 17. Phase 1 Prototype Scope

Per Doc #11. Deliberately minimal; proves the skeleton-bind-coherence loop end-to-end on a small library.

| Feature | Phase 1 status |
|---|---|
| Skeleton library | **3 skeletons:** `fetch`, `slay`, `gather` (matches the Doc #8 §6 "Cave of Trials" minimum and adds two civic skeletons for Highmere) |
| Slot types | `NpcRef`, `ItemArchetype`, `Location`, `Count`, `Reward` only |
| Variation knobs | `difficulty` and `reward_tier` only; tone defaults to `earnest`, length to `standard`, alignment to `neutral` |
| Coherence checks | Standard checks §7.1 rows 1–4 (dead reference, reachability, ownership, active-quest collision); rows 5+ deferred |
| Drift detection during play | yes (§7.5) |
| Chaining | **deferred to Phase 2** |
| Authoring tools | YAML-only authoring; no in-game editor (Phase 2) |
| Compiler | yes; passes 1–6, 8 from §10.2; chain validity (pass 7) trivial since no chains |
| Auto-test | yes against the `fixture.britain_baseline` fixture only |
| Hot reload | yes (skeleton registry is versioned) |
| LLM variation | **off** in Phase 1 |
| Telemetry | `bind.attempted/succeeded/skipped`, `offered`, `accepted`, `completed`, `coherence_drift`; no dashboards in P1 |
| Anti-monotony | per-skeleton cooldown only; no shard-wide quota |
| MCP tools | `compile_skeleton` and `playtest_skeleton`; `bind_skeleton` not exposed (binder runs server-internal) |
| Dilemma library | **none in Phase 1**; the `slay` skeleton uses a hard-authored deterministic dilemma rather than a library lookup |
| Persistence | `skeletons` and `skeleton_bindings` tables created; `skeleton_active_collisions` deferred |

**Phase 1 success metric:** A player walks into Highmere, talks to the baker (Garritt, per Doc #17 §13), is offered a procedurally-bound `gather` quest ("Fetch me 5 silverleaf from the Silverwood") whose slots resolve from live world state; on completion, the binder retires the binding and after the per-skeleton cooldown a new `gather` binding for the same skeleton produces a *different* item, location, or count. The player perceives "Garritt asks me for things" as a reactive feature rather than a fixed script.

---

## 18. Open Questions

1. `[OPEN]` **Resolver perf at scale.** §5.2 per-region per-tick binding cost on a populated shard with 10K+ NPCs. Naive O(N) faction filters become hot. Need an indexed query layer (likely in-memory bitmap by faction × archetype × region) before Phase 2 expansion. Affects Doc #21 §3 indexing strategy.
2. `[OPEN]` **Per-Avatar offered-quest aging.** §11.5 introduces a per-Avatar repeat cooldown but does not specify whether *offered-but-declined* quests carry the same cooldown as *accepted-and-completed* ones. Likely shorter cooldown for declined; tuning needed.
3. `[OPEN]` **Dilemma library curation cost.** §5.6 cites ~60 fragments at launch. Authoring 60 worked-Virtue dilemmas is a real designer cost; whether this is a ship-blocking dependency for the launch skeleton library or whether the launch ships with 20 fragments and accepts repetition is undecided.
4. `[OPEN]` **LLM variation on user-authored skeletons.** §12 specifies caching by skeleton id + version. UGC creators may iterate quickly; cache hit rate for `Trusted` UGC skeletons may be very low. Whether to offer LLM variation only for Origin-authored skeletons in Phase 2 is undecided.
5. `[OPEN]` **Slot proximity vs travel time.** §3.2 `proximity_tiles` is straight-line; pathfinder distance can be much greater across rivers and mountains. Whether to use straight-line or path-distance (and whether to amortize a path-distance query across slot resolution) is undecided. Path-distance is more correct but expensive; straight-line is cheap but produces accidental long quests.
6. `[OPEN]` **Determinism vs live world state.** §5.1 says binding is deterministic given seeds; live world state is non-deterministic. Two replays with the same seeds but different living NPC populations bind differently. Whether to additionally hash the world state into the seed (full determinism, but breaks reproducibility-from-seed for moderation) or leave as-is (current plan) is TBD.
7. `[OPEN]` **Chain failure cascade.** §9.2 says coherence rejection rejects the entire chain. If a chain's hop-2 child becomes incoherent during play (after binding succeeded), should the parent fail entirely, or skip the failed child and continue? Current plan: fail entirely. Alternative: graceful-degrade with reduced reward.
8. `[OPEN]` **Offer-time Virtue gates and discoverability.** §3.5 `PlayerVirtueRange` prevents skeletons from being offered to unsuitable Avatars. From the Avatar's perspective, they will not know a quest existed they didn't qualify for. Matches Doc #17 §4 invariant 2 (hidden gates give no hint), but creates a "hidden side-quests" suspicion from players. Whether to surface a generic "the recruiter eyes you skeptically" hint without revealing the gate is undecided.
9. `[OPEN]` **Skeleton retirement vs in-flight quests.** §10.4 says retired skeletons continue serving in-flight quests against their bound version. What happens if a `Retired` skeleton is *also* found to be exploit-buggy during a live incident — do in-flight quests forcibly auto-fail with refund, or are they grandfathered? Ties to Doc #29 emergency-rollback procedures.
10. `[OPEN]` **Cross-shard skeleton library.** §14.1 stores skeleton templates in `WorldState` shard-local. Whether the skeleton *library* (the templates) is per-shard or shared across all shards is undecided. Most arguments favor shared (designer-authored templates have no reason to differ per-shard); UGC skeletons and Alternate Avermere variants argue for per-shard. Likely answer: Origin templates are shard-shared, UGC templates are shard-local until promoted.
11. `[OPEN]` **Quest density target.** No explicit target for "how many simultaneous bound quests should a region carry." Affects shard concurrent quota tuning (§11.4). A frontier region with 12 active side quests feels alive; with 60 it feels like a job board.
12. `[OPEN]` **Anti-grief on `mediate` skeletons.** A Trusted creator could author a `mediate` skeleton whose stake creates a faction conflict in a region (e.g., "broker between two innocent NPCs over a stolen-item accusation that is fictional"). The Virtue validator (§10.2 pass 8) will catch flat negative-Virtue scripts but may not catch slow-burn social engineering. Whether to add a "social-claim integrity" hint to coherence checks is undecided.

---

## 19. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #8 §1 "Guided Discovery"; **resolves Doc #8 §3.3** |
| §2 Taxonomy | Doc #5 §2 (Virtues), Doc #15 §3 (party affordances) |
| §3 Schema | Doc #19 §3 (Quest schema), **resolves Doc #19 §10** (skeleton param spec) |
| §4 Stages | Doc #19 §3 (QuestStage), Doc #19 §2.2 (ActionNode/ConditionNode) |
| §5 Slot resolution | Doc #6 §5 (faction registry), Doc #8 §3 (POI/resource indexes), Doc #14 §6 (resource queries) |
| §6 Variation knobs | Doc #5 §3 (Virtue tone), Doc #18 §2 (economy tier mapping), Doc #33 (localization, deferred) |
| §7 Coherence | Doc #14 §5.11 (pathfinder), Doc #15 §6.2 (witness store), Doc #17 §6 (schedules), Doc #6 §5 (factions) |
| §8 Rewards | Doc #5 §4 (Virtue Engine), Doc #18 §2 (economy), Doc #15 §7.3 (titles) |
| §9 Chaining | Doc #26 §2 (Arc promotion path), Doc #19 §3 (multi-stage Quest) |
| §10 Authoring | Doc #19 §2 (visual editor), Doc #19 §9 (publishing pipeline), Doc #19 §5 (sandbox) |
| §11 Anti-monotony | Doc #28 §3 (live-ops dashboards), Doc #6 §3 (persistence) |
| §12 LLM variation | Doc #29 (moderation pre-filter), Doc #14 §3 (capabilities) |
| §13 Telemetry | Doc #28 (analytics) |
| §14 Persistence | Doc #21 §3 (shard DB), Doc #6 §3 (persistence scopes), Doc #13 §3 (scope tags) |
| §15 MCP | Doc #14 §3 (capabilities), Doc #14 §5 (tools), Doc #14 §6 (resources), Doc #19 §12 (UGC MCP surface) |
| §16 Worked examples | Doc #3 (World Bible — region/NPC names), Doc #17 §13 (Phase 1 NPC roster) |
| §17 Phase 1 | Doc #11 (milestones), Doc #19 §13 |
| §18 Open Questions | various; cross-references in each item |
| Engine / stack authority | **Doc #41 (Engine & Stack ADR)** — binder + resolver run on Rust server; web/TS authoring tools; UE5 + TS/PixiJS clients consume bound quests via Protobuf wire protocol |

---

End of Document #36.
