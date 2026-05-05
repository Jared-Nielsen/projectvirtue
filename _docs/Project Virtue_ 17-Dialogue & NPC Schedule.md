Document #17: Dialogue & NPC Schedule
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Narrative Systems Lead]
Status: Living Technical Reference — Normative spec for the keyword dialogue system, NPC daily schedules, schedule execution, interruption rules, and gossip propagation

> **Updated 2026-05-04 per Doc #41.** NPC dialogue selection, schedule evaluation, and AI behaviors are server-authoritative (Rust). UE5 Behavior Trees and UE5 NavMesh are forbidden for NPCs. NPC pathing, decision-making, and schedule transitions all happen on the Rust shard tick; UE5 is a dumb view that renders the NPC at the position the server reports.

Depends on: #2 GDD §4.6, #3 World Bible §6, #4 Simulation §5, #5 Virtues §3 §4, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface, #15 Character, Party & Inventory, #41 Engine & Stack ADR.

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Project Virtue.

---

## 1. Dialogue Philosophy

Dialogue in Project Virtue is keyword-driven, not branch-tree-driven `[BG]`. The `talk` verb opens a session that surfaces a small set of bold keywords; clicking a keyword yields the NPC's response and may surface new keywords or retire stale ones. This is preserved verbatim from BG/SI; we do not adopt the cinematic-branch pattern from later RPGs. Responses are filtered at every invocation by (a) the Avatar's eight Virtues (Doc #5 §2), (b) world flags (quest progress, Fellowship membership, witnessed events from Doc #15 §6.2), and (c) the NPC's currently-executing schedule slot — an NPC at the forge will speak about iron, the same NPC at the tavern will gossip. SI's scripted "rant" cutscenes (Shamino's lost love, Dupre's drunkenness) are preserved as `TriggerCutscene` side-effects on specific keywords `[SI]`, but the keyword core is non-negotiable. Voice acting (Doc #2 §4.6) attaches per-Response, not per-tree.

---

## 2. Dialogue Tree Schema

```ts
type Keyword     = string                  // e.g. "name", "job", "fellowship"
type ResponseId  = string
type DialogueTreeId = string
type FlagId      = string

type DialogueTree = {
  id:              DialogueTreeId
  npc_id:          EntityId
  opening:         Keyword[]                  // shown immediately on `talk`
  keywords:        Map<Keyword, ResponseId>
  responses:       Map<ResponseId, Response>
  default:         ResponseId                 // unknown keyword → "I know nothing of that"
  virtue_gates:    VirtueGate[]
  state_gates:     StateGate[]
}

type Response = {
  id:              ResponseId
  text:            LocalizedString            // see §14 [OPEN] localization
  voice_clip:      AudioRef | null            // optional VO trigger
  unlocks:         Keyword[]                  // surfaced after this response
  locks:           Keyword[]                  // removed from session set
  side_effects:    DialogueEffect[]
}

type DialogueEffect =
  | { kind: "GiveItem",       archetype: ArchetypeId, qty: int }
  | { kind: "TakeItem",       archetype: ArchetypeId, qty: int, owner_check: bool }
  | { kind: "StartQuest",     quest_id: string }
  | { kind: "UpdateQuest",    quest_id: string, stage: int }
  | { kind: "SetFlag",        flag_id: FlagId, value: bool | int | string }
  | { kind: "ChangeVirtue",   virtue: Virtue, delta: int }       // routed via Virtue dispatcher (Doc #5)
  | { kind: "TriggerCutscene", cutscene_id: string }              // [SI] scripted rants
  | { kind: "OpenShop",       shop_id: string }                   // launches trade dialog (Doc #15 §5.5)
  | { kind: "EndDialogue" }                                       // forced BYE

type VirtueGate = {
  virtue:           Virtue
  op:               "geq" | "leq" | "eq"
  value:            int                       // 0..100
  gated_keywords:   Keyword[]                 // hidden from session set if predicate fails
}

type StateGate = {
  flag_id:          FlagId
  predicate:        FlagPredicate             // present | absent | eq(v) | geq(v)
  gated_keywords:   Keyword[]
}
```

Notes:
- `keywords` is a flat dispatch map. The dynamic surface set (what the player sees) is computed each turn from the union of `opening` plus the cumulative `unlocks` minus `locks`, then filtered by gates.
- `default` exists per-tree so a guard's "I know naught of that" differs from a sage's "An interesting query, but I have no answer." `[BG]`
- `Response.text` is `LocalizedString` so VO and text remain swappable post-launch.

---

## 3. Universal Keywords

Always present in every NPC tree unless explicitly suppressed by `state_gates` (e.g., a hostile NPC suppresses `name` because they will not parley).

| Keyword | Source | Default Behavior | Notes |
|---|---|---|---|
| `name` | `[BG]` | NPC states their name and may unlock contextual keywords | First click on most NPCs |
| `job` | `[BG]` | NPC describes their work; surfaces work-related keywords | Often unlocks shop or quest entry |
| `bye` | `[BG]` | Closes session | Equivalent to range-break or `end_dialogue` tool |

### 3.1 Auto-injected reactive keywords

Injected at session-open time by the dispatcher based on Doc #15 §6.2 witness records and Doc #5 §4 reputation flags. They are not authored per-tree; they short-circuit to global response templates that may be overridden per-NPC.

| Keyword | Trigger | Source | Override |
|---|---|---|---|
| `thief` | NPC (or any NPC sharing faction via gossip §9) has witnessed an Avatar `steal` event in the past 7 game-days | Doc #15 §6.2 `[BG]` | NPC may override with custom response |
| `murderer` | NPC's faction has witnessed Avatar killing an `is_innocent = true` NPC | Doc #15 §6.2, Doc #13 §1.7 `[BG]` | Same |
| `liar` | Avatar has chosen a `ChangeVirtue { virtue: "Honesty", delta: < 0 }` response in this NPC's hearing | `[BR]` (BG only had thief/murderer; BR adds liar to make the Honesty pillar legible) | Same |
| `fellowship` | Avatar is wearing or carrying a Fellowship medallion (`archetype: item.medallion.fellowship`) | `[BG]` | Fellowship NPCs unlock recruitment branch; non-Fellowship NPCs may react warily |
| `avatar` | Avatar's public Virtue title (Doc #15 §7.3) is non-empty | `[U4]` `[BG]` | NPC reacts according to title polarity |

Auto-injected keywords are computed at every `talk` invocation, so reputation is always current.

---

## 4. Virtue-Gated Dialogue

> Formal rule, derived from Doc #5 §3 ("NPC dialogue changes tone based on reputation thresholds") and Doc #5 §4 (Virtue→world consequences).

```
filter_keywords(tree, actor, npc, world_flags) -> Keyword[]:
  visible = tree.opening ∪ session.unlocked - session.locked
  for gate in tree.virtue_gates:
    if not eval_virtue(actor.virtues[gate.virtue], gate.op, gate.value):
      visible = visible - gate.gated_keywords
  for gate in tree.state_gates:
    if not eval_state(world_flags, gate):
      visible = visible - gate.gated_keywords
  return visible
```

Invariants:
1. Gates are **evaluated at every `talk` invocation, not cached**. A Virtue change between two visits changes what is visible. `[BR]`
2. Hidden keywords give **no hint that they exist** — the UI does not render them greyed-out, and the response text never references them. True to BG `[BG]`. The player learns of locked content only through other channels (rumors, hints, prior playthroughs).
3. Gates compose by intersection: a keyword guarded by both a Virtue gate and a state gate requires both to pass.
4. `ChangeVirtue` side-effects route through the Virtue dispatcher (Doc #5), which means a dialogue response that costs Honesty fires the same Virtue Engine path as a stolen apple.

### 4.1 Worked Example

A paladin at Empath Abbey offers a `join_order` keyword only if Honor ≥ 70 AND Valor ≥ 60:

```ts
virtue_gates: [
  { virtue: "Honor", op: "geq", value: 70, gated_keywords: ["join_order"] },
  { virtue: "Valor", op: "geq", value: 60, gated_keywords: ["join_order"] },
]
```

Both gates list `join_order`; both must pass for it to surface. A player at Honor 90, Valor 50 will not see the keyword and will not be told why.

---

## 5. `talk` Verb Dispatch

Formalizes the `talk` verb registered in Doc #13 §2.

### 5.1 Inputs and preconditions

```ts
talk(actor: EntityId, npc: EntityId)

preconditions:
  1. range:        distance(actor.pos, npc.pos) ≤ 2 tiles                  // [BG]
  2. line_of_sight: LOS(actor, npc) == true                                 // Doc #4 §3
  3. npc_state:    npc.State.hp > 0 AND
                   npc.activity ∉ { Sleep, Unconscious } AND
                   npc.combat_state == Idle                                 // not in combat
  4. interrupt:    npc.current_slot.interruptible == true                   // §6, §8
  5. capability:   actor is Player or actor.kind == AI(companion-banter)
```

Failure codes routed back through the dispatcher: `ERR_OUT_OF_RANGE`, `ERR_INVALID_TARGET` (NPC dead), `ERR_BUSY` (sleeping / non-interruptible slot), `ERR_VIRTUE_REJECTED` (NPC is hostile and refuses parley — the verb resolves to `attack` posture instead).

### 5.2 Resolve

```
talk_resolve(actor, npc):
  1. tree = pick_tree(npc, npc.current_slot.dialogue_override)   // §6
  2. session = open_dialogue_session(actor, npc, tree)
  3. inject_reactive_keywords(session)                            // §3.1
  4. visible = filter_keywords(tree, actor, npc, world_flags)     // §4
  5. emit DialogueOpened(session.id, visible)
  6. loop:
       kw = await keyword_input | range_break | timeout
       if kw == "bye" OR range_break OR timeout: break
       resp = lookup_response(tree, kw, default=tree.default)
       apply_side_effects(resp.side_effects, via VerbDispatcher)
       update session.unlocked, session.locked
       visible = filter_keywords(tree, actor, npc, world_flags)
       emit DialogueResponse(session.id, resp.text, visible)
  7. close_dialogue_session(session)
  8. emit DialogueClosed(session.id)
```

### 5.3 Side-effect routing (per Doc #13 §4)

| Effect | Routes Through |
|---|---|
| `SetFlag` | Persistence (scope: `StoryEvents` if quest-related, else `WorldState`); also writes to player's quest journal |
| `GiveItem` / `TakeItem` | Standard `drag` invocation — produces ownership transfer with `acquired_via = Gifted`; takes respect `OwnershipComponent.bound` |
| `ChangeVirtue` | Virtue dispatcher (Doc #5) — **never** writes Virtue scores directly |
| `StartQuest` / `UpdateQuest` | Quest service (Doc #19, in draft); idempotent on quest_id |
| `TriggerCutscene` | Single-player: pauses sim. Multiplayer: instanced scene, see §5.4 |
| `OpenShop` | Closes dialogue, opens trade dialog (Doc #15 §5.5) |
| `EndDialogue` | Forces session close; same path as `bye` |

### 5.4 Multiplayer rules `[BR]`

- Dialogue sessions are **per-player-instanced**. Two Avatars may simultaneously hold a session with the same NPC; each sees their own keyword surface and reactive injections, neither can eavesdrop.
- Other Avatars in the region see the NPC standing still, facing the talking Avatar, with an idle "in conversation" pose. They do not see keywords or response text.
- `TriggerCutscene` in multiplayer runs as an **instanced scene** for the dialoguing Avatar only — the world does not pause for non-participants. (Resolves a multiplayer ambiguity that Doc #4 §7 left for combat; same principle applies here.) `[BR]`
- Companion banter (§10) bypasses session instancing because companions speak aloud in the world; their lines are broadcast to all party members in earshot.

### 5.5 Errors at runtime

| Condition | Resolution |
|---|---|
| Range break mid-session | Dispatcher closes session, emits `DialogueClosed(reason: "range")`. No virtue penalty for "rude exit" — true to BG `[BG]`. |
| NPC enters combat mid-session | Forced close, reason: `"hostile"`. Side-effects of in-flight response complete first. |
| NPC killed mid-session | Forced close, reason: `"target_dead"`. |
| Malformed keyword from MCP | Treated as unknown → `default` response. See §14 [OPEN] for stricter validation. |
| Avatar incapacitated (sleep, paralyze) | Session paused; resumes on recovery if range still satisfied. |

---

## 6. NPC Schedule Schema

Replaces the placeholder `ScheduleComponent` from Doc #13 §1.5 with the full normative form.

```ts
type GameTime = { hour: int /* 0..23 */, minute: int /* 0..59 */ }   // 1-minute resolution
type TileCoord = { region: RegionId, x: int, y: int, z: int }

type Activity =
  | "Sleep"
  | "Eat"
  | "Work"
  | "Walk"          // ambient stroll
  | "Idle"          // stand-around
  | "Pray"
  | "Patrol"        // pre-defined waypoint loop
  | "Socialize"     // gossip/rumor exchange (§9)
  | { kind: "Custom", script_id: ScriptHookRef }

type ScheduleSlot = {
  start_time:        GameTime
  location:          TileCoord | { sit_at: EntityId }
  activity:          Activity
  props:             EntityId[]              // chair, bed, forge, lute, etc.
  interruptible:     bool                    // false = "no-interrupt" (Lord British court session)
  dialogue_override: DialogueTreeId | null   // contextual tree while in this slot
}

type Schedule = {
  npc_id:            EntityId
  slots:             ScheduleSlot[]          // 1..8, max 8 [BG] [BR]
  overrides:         ScheduleSlot[]          // event-driven (funeral, festival)
  current_slot_idx:  int                     // [I*]
}
```

### 6.1 Resolves Doc #13 §5 [OPEN] item 3 — Schedule Slot Granularity

| Question from Doc #13 | Resolution |
|---|---|
| Is the 8-slot cap per archetype, per instance, or per day? | **Per instance, per day.** `slots[]` defines the canonical day; `overrides[]` is per-instance per-event and may temporarily replace the active slot. Cap is **8 base + 8 overrides**, hard-enforced. `[BR]` |
| Time resolution? | **1-minute resolution** in storage; **time-anchored, not duration-anchored**. The next slot's `start_time` defines the previous slot's end. The schedule wraps at 24:00 → 00:00, with the latest-starting slot active until the earliest-starting slot's `start_time` next day. `[BR]` matching SCHEDULE.DAT pattern `[BG]`. |
| Why max 8? | Forces designers to pick **meaningful daily transitions**. The original BG/SI NPC patterns averaged 4–6 slots; 8 is the documented ceiling and we hold it. `[BG]` |

### 6.2 Slot resolution rule

```
current_slot(schedule, now: GameTime) -> ScheduleSlot:
  candidates = schedule.overrides ∪ schedule.slots
  active = candidates.filter(s => s.start_time <= now)
  if active.empty:
    # before today's first slot — use yesterday's last
    return candidates.max_by(start_time)
  return active.max_by(start_time)
```

Override slots take precedence at equal `start_time` ties.

---

## 7. Schedule Execution

> **Server-authoritative NPC AI (per Doc #41).** All NPC decision-making — schedule slot resolution, activity dispatch, dialogue keyword filtering, gossip propagation, hostile-AI mode selection (Doc #16 §9), and pathing — runs deterministically on the Rust shard tick (per Doc #22 network/replication). UE5 Behavior Trees, UE5 NavMesh, and UE5 AIController are forbidden for NPCs. Clients render only the resulting position, animation state, and dialogue text/audio that the server emits over the wire protocol (Protobuf, `/shared/proto`). Pathfinding is the Rust pathfinding system in Doc #23 — not UE5 NavMesh.

`ScheduleSystem` ticks **once per game-second**. One game-day defaults to 12 real-time minutes `[BG]`, configurable per shard (Doc #6 §2); MP shards typically run 30–60 minute days.

```
ScheduleSystem.tick(now: GameTime):
  for npc in active_npcs_in_loaded_regions:
    if npc.combat_state != Idle: continue            // combat AI owns the entity
    if npc.dialogue_session_open: continue           // talking; do not migrate

    slot = current_slot(npc.Schedule, now)
    if slot != npc.last_slot:
      emit SlotChanged(npc, slot)
      npc.last_slot = slot

    target_pos = resolve_location(slot.location)
    if dist(npc.pos, target_pos) > arrival_tolerance:
      VerbDispatcher.submit(move_to(npc, target_pos), caller=AI)   // Doc #14 §5.11
      continue

    # at location → execute activity
    for prop in slot.props:
      if not entity_exists(prop) or not in_range(prop, npc.pos):
        fallback_wander(npc, near=target_pos)                       // §8.4
        return
    activity_verb = activity_to_verb(slot.activity, slot.props)
    VerbDispatcher.submit(activity_verb, caller=AI)
```

### 7.1 Activity → Verb mapping

| Activity | Verb chain |
|---|---|
| `Sleep` | `use(bed)` → sets `State.sleeping = true`; reverses on slot change |
| `Eat` | `use(plate)` ∨ `use(food_item)`; if no food, `move_to(kitchen)` then `combine(ingredients)` |
| `Work` | profession-specific custom script (`forge_iron`, `bake_bread`) registered as Doc #13 §1.6 `ScriptHook.custom` |
| `Walk` | repeated `move_to` along ambient path |
| `Idle` | no verbs; entity stands; faces nearest player if any |
| `Pray` | `use(altar)` ∨ `meditate(shrine)` if within range |
| `Patrol` | `move_to` along authored waypoint loop; engages via standard combat AI on hostile detection |
| `Socialize` | `talk(other_npc)` with random nearby NPC; runs gossip exchange (§9) |
| `Custom` | invokes `ScriptRef` with caller=AI; sandbox per Doc #13 §1.6 |

### 7.2 Invariants

- Every Activity verb flows through `VerbDispatcher` with `caller = { kind: "AI", npc: <id> }` (Doc #13 §4). No bypass paths. Virtue scoring, persistence, and replication all fire normally.
- A schedule that requires an absent prop falls back to `Idle` near `slot.location` rather than failing silently. See §8.4.
- Pathfinder is the same nav system used by `move_to` (Doc #14 §5.11). Specific algorithm is `[OPEN]` (§14).

---

## 8. Schedule Interruption

Formal rules for what happens when external events disrupt a scheduled slot.

### 8.1 Player initiates `talk` mid-walk

| `slot.interruptible` | NPC behavior |
|---|---|
| `true` | NPC stops, faces player, opens dialogue. On `bye`, resumes the slot from current position (re-issues `move_to` if not yet at `location`). `[BG]` |
| `false` | Dispatcher returns `ERR_BUSY`; NPC emits a single one-line refusal ("I am busy. Speak to me later."). The refusal text is `dialogue_override.text` if present, else a generic line. `[BG]` |

Examples of `interruptible = false` slots: Lord British holding court, a cleric mid-ritual, a guard mid-patrol-challenge, a sleeping NPC.

### 8.2 Player initiates `attack` on scheduled NPC

1. Schedule paused, `current_slot_idx` preserved.
2. Combat AI (Doc #16, in draft) takes ownership of the entity.
3. On combat resolution:
   - NPC alive → schedule resumes, NPC walks back to current slot's `location`.
   - NPC dead → schedule disabled until respawn (Doc #15 §4.1) or, for unique NPCs, permanent disable.
4. Witness rules (Doc #15 §6.2) fire normally.

### 8.3 Player steals a scheduled prop `[BR]`

> Sub-rule new in BR. Resolves a gameplay gap implied by Doc #4 §5 ("Interrupting a schedule (stealing their tools) has consequences") that no prior Ultima formalized.

```
on_prop_stolen(npc, prop):
  1. npc.Schedule.overrides.append(SearchForPropSlot {
       start_time: now,
       location:   prop.last_known_pos,
       activity:   "Custom" { script: search_for_missing_prop },
       props:      [],
       interruptible: true,
       dialogue_override: tree.npc_id + ".prop_stolen"   // angry/worried tone
     })
  2. emit Rumor {
       event: "theft", subject: prop.archetype, victim: npc.id,
       severity: prop_value_to_severity(prop), witnessed_at: now
     } into npc's RumorStore
  3. npc broadcasts gossip on next `Socialize` slot (§9)
```

The override expires after 1 game-day if the prop is recovered, else upgrades to a `Wanted` flag against the actor in the NPC's faction (Doc #6 §5).

### 8.4 Missing prop fallback

If the schedule references a prop that is destroyed, in another region, or in a player's inventory:

```
fallback_wander(npc, near):
  Activity = Idle, then occasional Walk within 4 tiles of `near`.
  Once per game-hour, attempt a `Search` sub-routine (look toward last-known-pos of missing prop).
  If prop is restored to within 8 tiles, schedule resumes immediately.
```

### 8.5 Override slot installation

External systems (festival start, funeral, Guardian incursion) push entries to `Schedule.overrides` via the dispatcher. Overrides do not survive server restart unless persisted under `WorldState` scope (Doc #13 §3) with an explicit `expires_at`.

---

## 9. Gossip & Rumor Propagation

> Phase 2 system. Specified here so the data model is stable for designers; not in Phase 1 prototype scope (§13).

```ts
type Rumor = {
  id:            RumorId
  event:         RumorEvent          // theft, murder, miracle, marriage, sighting, etc.
  subject:       EntityId | string   // the wronged party, the wonder, etc.
  actor:         EntityId | null     // the Avatar / perpetrator if known
  severity:      int                 // 1..10
  witnessed_at:  GameTime
  reinforcements: int                // increments each time NPC re-witnesses or re-hears with corroboration
}

type RumorStore = {
  npc_id:   EntityId
  rumors:   Rumor[]                  // capped at 16 per NPC; oldest evicted
}
```

### 9.1 Witness → Rumor

Witnessed events (Doc #15 §6.2) write a `Rumor` into the witnessing NPC's `RumorStore`. Severity formula is `[OPEN]` (§14); placeholder: `severity = clamp(item.value / 10, 1, 10)` for theft.

### 9.2 Propagation

```
on_socialize_tick(npc_a, npc_b):
  # both NPCs in Activity = Socialize, within 24 tiles
  # rate-limited: 1 share per real-minute per NPC pair
  for rumor in npc_a.rumors.where(reinforcements >= 0):
    if rumor.id ∉ npc_b.rumors and faction_trusts(npc_a, npc_b):
      npc_b.rumors.append(rumor.copy(reinforcements = 0))
    else if rumor.id ∈ npc_b.rumors:
      npc_b.rumors.find(rumor.id).reinforcements += 1
```

### 9.3 Decay

Rumors decay over **7 game-days** unless reinforced. A rumor with `reinforcements >= 3` is "common knowledge" and decays over **30 game-days** instead.

### 9.4 Dialogue surface

Rumors expose new keywords on the holding NPC's dialogue tree:

- `rumors` keyword — universal-ish; surfaces if NPC has ≥ 1 active rumor
- Rumor-specific keywords injected dynamically (e.g., `stolen_hammer`, `dead_baker`) and visible only after the player asks `rumors` first (mirrors BG's "ask about RUMORS to learn what to ask next" pattern) `[BG]`

---

## 10. Companion Dialogue

Companions (Doc #15 §3) are NPC entities with `Schedule` (typically a degenerate single-slot `Follow` schedule) plus a personal `DialogueTree`. `talk(companion)` opens that tree, identical to talking to any other NPC.

### 10.1 Idle banter

Triggered by location enter, time of day, or world events. Banter does not open a dialogue session — it broadcasts a single `Response.text` line to all party members in earshot (24 tiles), bypassing keyword input.

```ts
type BanterTrigger =
  | { kind: "EnterRegion",  region_id: RegionId }
  | { kind: "EnterEntity",  archetype_pattern: string }   // e.g. "tavern.*", "shrine.*"
  | { kind: "TimeOfDay",    hour: int }
  | { kind: "EventFlag",    flag_id: FlagId }

type CompanionBanter = {
  companion_id:  EntityId
  triggers:      BanterTrigger[]
  text:          LocalizedString
  cooldown:      Duration                 // default 1 game-day per banter line
  one_shot:      bool                     // some lines fire only the first time
}
```

Examples from BG/SI:
- Iolo at Britain music guild: bardic banter about his lute. `[BG]`
- Shamino in any forest region: ranger nostalgia. `[BG]`
- Dupre on entering any tavern: drinking comment. `[BG]` (graduates to scripted rant on third trigger `[SI]`).

### 10.2 Companion-witness barbs

When a companion's `witness_enabled = true` (Doc #15 §3.2 default `true` in BR `[BR]`) and they witness an Avatar Virtue event below threshold, they fire a barb via the same banter channel. Barbs are not silenceable; this is the design intent of restoring BG's witnessing behavior over SI's silence (Doc #15 §6.3).

### 10.3 Companion-vs-companion dialogue `[OPEN]`

Whether companions ever address each other (e.g., Iolo and Shamino bickering in earshot of the Avatar) is `[OPEN]` (§14). The data model supports it (banter triggered by `EnterEntity` matching another companion), but no Phase 1 commitment.

---

## 11. NPC Reaction Matrix

Recomputed at each `talk` invocation. Inputs: Avatar's eight Virtues, witnessed-event flags from this NPC's `RumorStore`, ownership relationship (is the Avatar a customer / debtor / patron?), and faction reputation.

```ts
type ReactionState = "Friendly" | "Neutral" | "Wary" | "Hostile" | "Fearful"

reaction(npc, actor) -> ReactionState:
  v = actor.virtues
  r = npc.rumors_about(actor)
  f = faction_relation(npc.faction, actor)

  if any rumor in r where event == "murder" and severity >= 8:
    if npc.faction.is_civic: return "Hostile"
    else:                    return "Fearful"
  if f.is_enemy: return "Hostile"
  if v[npc.aligned_virtue] >= 70 and f.is_neutral_or_better: return "Friendly"
  if v[npc.aligned_virtue] <= 20 or any rumor where event in {"theft","liar"}: return "Wary"
  if v[npc.opposed_virtue] >= 80 and v[npc.aligned_virtue] <= 30: return "Fearful"
  return "Neutral"
```

| ReactionState | Effect |
|---|---|
| **Friendly** | Full keyword tree; shop discount −10%; unlocks one optional quest |
| **Neutral** | Standard keyword tree; standard prices; no special quests |
| **Wary** | Standard tree; shop prices **+25%**; refuses quest entries; will not give gifts |
| **Hostile** | `talk` returns `ERR_VIRTUE_REJECTED`; combat AI engages on next tick |
| **Fearful** | `talk` returns one-line "Stay back!" then ends session; NPC flees on sight |

The `aligned_virtue` and `opposed_virtue` per NPC are archetype-level data fields under `VirtueWeightsComponent` (Doc #13 §1.7). Default mapping for civic NPCs: aligned = `Justice`, opposed = none.

---

## 12. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 12.1 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `talk` | `avatar.full` | `npc_entity_id` | `{ dialogue_session_id, opening_keywords[], npc_name }` | Opens session; emits `DialogueOpened`. Verb path identical to mouse-click talk. |
| `say_keyword` | `avatar.full` | `dialogue_session_id`, `keyword` | `{ response_text, voice_clip?, current_keywords[], session_state: "open" \| "closed" }` | Applies `Response.side_effects[]` via dispatcher. May close session if effect = `EndDialogue`. |
| `end_dialogue` | `avatar.full` | `dialogue_session_id` | `{ ok: true }` | Forced BYE; closes session. |

```json
// talk
{
  "name": "talk",
  "input": {
    "envelope": "VerbEnvelope",
    "npc_entity_id": "EntityId"
  },
  "returns": {
    "dialogue_session_id": "string",
    "opening_keywords": ["string"],
    "npc_name": "string",
    "reaction_state": "Friendly | Neutral | Wary | Hostile | Fearful"
  }
}

// say_keyword
{
  "name": "say_keyword",
  "input": {
    "envelope": "VerbEnvelope",
    "dialogue_session_id": "string",
    "keyword": "string"
  },
  "returns": {
    "response_text": "string",
    "voice_clip": "AudioRef | null",
    "current_keywords": ["string"],
    "session_state": "open | closed",
    "virtue_deltas": "{ [virtue: string]: number } | null"
  }
}

// end_dialogue
{
  "name": "end_dialogue",
  "input": {
    "envelope": "VerbEnvelope",
    "dialogue_session_id": "string"
  },
  "returns": { "ok": "boolean" }
}
```

Errors specific to dialogue tools: `ERR_SESSION_NOT_FOUND`, `ERR_SESSION_CLOSED`, `ERR_RANGE_BROKEN` (recompute LOS each `say_keyword`; if range exceeded, session auto-closes), in addition to standard codes from Doc #14 §5.

### 12.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/npc/{id}/schedule` | `Schedule` (§6) — base slots and active overrides; redacted for quest-critical NPCs | `inspect.read` (public NPCs only); designer-elevated capability for full read |
| `forge://shard/{s}/npc/{id}/dialogue_tree` | full `DialogueTree` (§2) including all gates and responses | **`inspect.read` is insufficient** — requires designer/QA capability; player capability sets see only `opening` and previously-discovered keywords (per-session memory) |
| `forge://shard/{s}/region/{id}/rumors` | active `Rumor[]` aggregated across NPCs in region | `inspect.read` for designers; redacted for player-capability sets |

### 12.3 Capability Notes

- `dialogue_tree` is **designer-only by default**. Exposing the full tree to a player-capability MCP client would defeat the BG "discovery" loop (§4 invariant 2). LLM Avatar agents (`avatar.full`) get the same surface as a human player: only what the session has revealed.
- Subscriptions on `npc/{id}/schedule` deliver `SlotChanged` events at the rate the schedule changes (low-frequency).

---

## 13. Phase 1 Prototype Scope (12-Week "Britain Alive")

Per Doc #11. Deliberately minimal; proves the keyword loop and schedule execution end-to-end on a small NPC roster.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Dialogue trees | 15 Britain NPCs (matches Doc #11 milestone, aligns with Doc #4 §8's "20+ NPCs" target as a lower bound); each tree has `name`, `job`, `bye` plus 5–10 contextual keywords | Full `unlocks`/`locks` graph beyond 1 hop; cutscene side-effects |
| Virtue gates | Active on **3 NPCs** (e.g., Britain guard refuses to talk to low-Honor Avatar; Lord British's chamber paladin gates `join_order` on Honor+Valor; one Fellowship recruiter gates `fellowship` keyword on Humility ≤ 30) | Gates on full NPC roster |
| State gates | Quest-flag gates active on the 3 quest-bearing NPCs of the Phase 1 quest line | Multi-flag composition, time-of-day gates |
| Reactive keywords | `name`/`job`/`bye` always; `thief`/`murderer` injected from single-NPC LOS witness only (Doc #15 §8 Phase 1 ownership row) | `liar`, `fellowship`, `avatar` injection; faction-level rumor injection |
| Schedules | 15 Britain NPCs with full daily slots (≥ 4 slots each); `Sleep`/`Eat`/`Work`/`Walk`/`Idle` activities | `Pray`, `Patrol`, `Socialize`, `Custom` script activities |
| Schedule execution | Move-to + activity verbs through dispatcher; missing-prop fallback to `Idle` | Override slot installation by external events |
| Interruption | `talk` interrupts walking NPC (§8.1); `attack` pauses schedule (§8.2) | Prop-theft rescheduling (§8.3) deferred to Phase 2 |
| Gossip / rumors | **None.** No `RumorStore`, no `Socialize` activity, no rumor-derived keywords | Full system per §9 |
| Companion dialogue | Iolo and Shamino (the two Phase 1 companions per Doc #15 §8) have dialogue trees with `name`/`job`/`bye` + 3 contextual keywords each; **no banter triggers** | Banter system, companion-witness barbs, companion-vs-companion |
| Reaction matrix | `Friendly`/`Neutral`/`Wary`/`Hostile` only (no `Fearful`); recomputed on `talk` | `Fearful` state, faction-relation inputs |
| Multiplayer | **Single-player only** for vertical slice (matches Doc #14 §8 Phase 1 transport scope) | Per-player session instancing, instanced cutscenes |
| MCP | None of the §12 tools required for the Phase 1 slice (per Doc #14 §8 — only `examine` and `use` ship as mutating-path proofs) | All §12 tools and resources deferred to Phase 2 |

**Phase 1 success metric:** a player can walk into Britain, talk to the baker (`name` → "I am Garritt." → unlock `bread`; `bread` → "Two gold pieces a loaf."), see the baker switch from `Work` (08:00–12:00 at the oven) to `Eat` (12:00–13:00 at the tavern) and have different `job` responses in each slot, then steal a loaf and on the next `talk` see the auto-injected `thief` keyword surface.

---

## 14. Open Questions

1. `[OPEN]` **Voice acting trigger logic.** Per-Response `voice_clip` is in the schema (§2). Open: do all responses get VO (cost), only opening + critical responses (BG mid-tier), or only named-character responses (BG approach for background NPCs)? Affects audio production budget per Doc #10.
2. `[OPEN]` **Localization layer.** `LocalizedString` is referenced but not defined. ICU MessageFormat vs. a simpler key/locale lookup. Affects modding (Doc #7) — UGC dialogue must localize.
3. `[OPEN]` **Pathfinder algorithm.** §7 specifies "the same nav system used by `move_to`" but Doc #14 §5.11 also defers. A* with dynamic obstacle re-plan is the working assumption; grid-pathfinding tooling per Doc #23 is parallel work (NavMesh forbidden per Doc #41 §4; grid pathfinding per Doc #23 §4.6).
4. `[OPEN]` **Companion-vs-companion dialogue.** §10.3. Authoring cost vs. immersion payoff. SI did this lightly; BG essentially did not.
5. `[OPEN]` **Malformed `say_keyword` input via MCP.** §5.5 routes unknown keywords to `default`. Open: should the MCP surface additionally validate against the *currently visible* keyword set and return `ERR_UNKNOWN_ACTION` on a hidden keyword (preventing LLM clients from probing for gated content)? Trade-off: fidelity to mouse-click UX (which only renders visible keywords anyway) vs. anti-fingerprinting of gates.
6. `[OPEN]` **Rumor severity formula.** §9.1 placeholder is `severity = clamp(item.value / 10, 1, 10)` for theft. Murder severity, miracle severity, and faction-modifier multipliers unspecified. Designer pass needed.
7. `[OPEN]` **Override slot persistence.** §8.5 says overrides persist if `WorldState`-scoped with `expires_at`. Default expiry duration for a `prop_stolen` override and a `funeral` override differ; canonical defaults TBD.
8. `[OPEN]` **Banter cooldown after dialogue.** §10.1 cooldowns are per-banter-line; open: should triggering a real `talk` session with a companion suppress that companion's banter for some window (so they don't barb the Avatar mid-conversation)?

---

## 15. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #2 §4.6 (NPC & Dialogue), Doc #5 §3 (NPC tone) |
| §2 Schema | Doc #13 §1.5 (Schedule), Doc #13 §1.6 (ScriptHook) |
| §3 Universal Keywords | Doc #15 §6.2 (witness model), Doc #5 §4 (reputation flags) |
| §4 Virtue Gates | Doc #5 §3 §4, Doc #13 §1.7 (VirtueWeights) |
| §5 `talk` Dispatch | Doc #13 §2 (verb registry), Doc #13 §4 (dispatch contract), Doc #14 §5 (envelope) |
| §6 Schedule Schema | Doc #4 §5 (SCHEDULE.DAT model), **resolves Doc #13 §5 [OPEN] item 3** |
| §7 Execution | Doc #14 §5.11 (`move_to`), Doc #4 §5 |
| §8 Interruption | Doc #4 §5, Doc #15 §6.2, Doc #6 §5 (Wanted flags) |
| §9 Gossip | Doc #15 §6.2, Doc #5 §4 |
| §10 Companion Dialogue | Doc #15 §3 (party), Doc #15 §6.3 (companion witnesses) |
| §11 Reaction Matrix | Doc #5 §3, Doc #13 §1.7, Doc #6 §5 |
| §12 MCP | Doc #14 §3 (capabilities), Doc #14 §5 (tool envelope), Doc #14 §6 (resources) |
| §13 Phase 1 | Doc #11 (milestones), Doc #14 §8, Doc #15 §8 |
| §7 server-authoritative AI | Doc #41 (Engine & Stack ADR — Rust shard tick owns NPC AI; UE5 Behavior Trees / NavMesh forbidden) |

---

End of Document #17.
