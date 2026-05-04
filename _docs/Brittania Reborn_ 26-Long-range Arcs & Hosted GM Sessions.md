Document #26: Long-range Arcs & Hosted GM Sessions
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Live Ops & Persistent Story Lead / Tooling]
Status: Living Technical Reference — Normative spec for the layer above per-quest FSMs (Doc #19) and ad-hoc story-event triggers (Doc #21), and for the GM-as-pacing-layer model atop the dispatcher invariant.

Depends on: #3 World Bible, #5 Virtues, #6 Persistent World, #7 UGC, #13 Core Schema (Entity/Verb/Scope), #14 MCP Server Surface, #15 Character/Party/Inventory, #16 Combat & Magic, #17 Dialogue & NPC Schedule, #19 Quest & UGC Scripting, #21 Save Format & Shard DB, #22 Network Protocol & Replication, #24 Onboarding & Tutorial Flow.

Provenance tags: `[BG]` Black Gate (Ultima VII original), `[SI]` Serpent Isle, `[U4]` Ultima IV (Virtues canon), `[BR]` Britannia Reborn (new layer). Most of this document is `[BR]` — Ultima VII shipped no multiplayer, no persistent shard, and no hosted-GM affordance.

---

## 1. Philosophy

### 1.1 Long-range Arcs `[BR]`

Britannia is an avowedly persistent world (Doc #6 §1). A persistent world that only knows quests and ad-hoc story-event triggers cannot actually *evolve* across months and years — it can only accumulate fragments. Per-quest FSMs (Doc #19 §3) describe a single arc of a single questline; the `story_event_state` table (Doc #21 §3.10) describes a single phased flag without composition. The gap between them is where Britannia changes shape: the Guardian's Incursion that proceeds from rumour to siege to occupation to liberation over twelve weeks, the Virtue Festival that runs across all shards once per year, the player-published 8-week mystery campaign whose ending depends on which town's mayor was assassinated in week 3. This document defines **Arc** as the named higher-order container above quests and below the shard's lifetime — the unit of *story shape* that persistent simulation needs in order to be more than the sum of its triggers. `[BR]`

### 1.2 Hosted GM Sessions `[BR]`

Tabletop role-playing has a half-century of evidence that a human pacing-and-narration layer makes simulated worlds livable in ways no scripted system has matched. `[BR]` Britannia Reborn imports the affordance — one Avatar acts as Game Master for a small party, in real time, with the Gandalf-to-Frodo tonality, not the dungeon-crawl-DM tonality. The non-negotiable design rule is that **the GM is a pacing-and-narration layer atop the existing verb dispatcher, never an authority bypass.** Every GM action flows through `VerbDispatcher.dispatch(...)` (Doc #13 §4 / Doc #14 §4 invariant 1), every GM action is Virtue-scored pre-commit (Doc #14 §4 invariant 2), every GM verb is logged for moderation. The GM gets new affordances (puppet, narrate, gather, time-skip) but no new ingress, no escape from Virtue, no privileged write path into ECS. The GM is a player with extra tools, not an admin. `[BR]`

---

## 2. Arc — Typed Schema `[BR]`

```ts
type ArcId        = string
type ArcStageId   = string
type ArcEventId   = string

type Arc = {
  id:                       ArcId
  name:                     string
  description:              string                  // visible in participants' journals
  owner:                    PlayerId | "official"
  scope:                    ArcScope
  stages:                   ArcStage[]
  current_stage:            ArcStageId
  transitions:              ArcTransition[]
  participants:             ParticipantSet
  pacing_policy:            PacingPolicy
  persistence_policy:       ArcPersistencePolicy
  virtue_alignment_score:   int                     // populated by validator §16
  started_at:               Timestamp
  expected_end:             Timestamp | null
  completed_at:             Timestamp | null
}

type ArcStage = {
  id:                       ArcStageId
  name:                     string
  description:              string                  // journal text shown to participants
  entry_effects:            ActionNode[]            // reuses Doc #19 §2.2 ActionNode
  stage_quests:             QuestId[]               // Doc #19 §3 quests active during this stage
  stage_events:             ArcEventId[]            // world / economy / weather changes scheduled this stage
  completion_predicates:    ConditionNode[]         // ANDed; reuses Doc #19 §2.2 ConditionNode
  fail_predicates:          ConditionNode[]         // ORed; any fail predicate ends the stage in fail
  stage_timeout:            GameTime | null         // optional auto-advance
}

type ArcTransition = {
  from_stage:    ArcStageId
  to_stage:      ArcStageId | { ref: "end", outcome: "success" | "fail" | "abandoned" }
  trigger:       PredicateNode
               | { kind: "ManualGM",       gm_avatar_id: AvatarId }
               | { kind: "TimeElapsed",    seconds: int }
               | { kind: "QuestCompleted", quest: QuestId, outcome: "success" | "fail" }
  side_effects:  ActionNode[]
}

type ParticipantSet =
  | { kind: "Open" }                                                    // any Avatar in scope can participate
  | { kind: "Invitation", invited: PlayerId[], max_concurrent: int }
  | { kind: "Faction",    faction_id: FactionId }
  | { kind: "Guild",      guild_id:   GuildId }

type PacingPolicy =
  | { kind: "RealTime" }                                                // arc evolves with world clock
  | { kind: "Sessioned",  min_players: int, gather_required: bool }
  | { kind: "GMHosted",   gm_avatar_id: AvatarId }                       // requires hosted GM session §6

type ArcPersistencePolicy =
  | { kind: "EphemeralPocketRealm" }                                    // arc lives in instance; no live-world commit
  | { kind: "LiveWithRollback", snapshot_interval_seconds: int }
  | { kind: "LiveCanonical",    moderation_required: true }

type ArcScope =
  | { kind: "Local",      region_id: RegionId }
  | { kind: "Regional",   region_ids: RegionId[] }
  | { kind: "Shard" }
  | { kind: "CrossShard" }                                              // official only; uses Doc #22 message bus
```

`ActionNode`, `ConditionNode`, `PredicateNode` are reused verbatim from Doc #19 §2.2 — there is no arc-specific node taxonomy, and arc transitions therefore inherit the same compile path, the same Virtue validator hooks (§16), and the same sandbox enforcement (Doc #19 §5). `[BR]`

---

## 3. Arc Execution Model `[BR]`

| Property | Value |
|---|---|
| Runtime | Server-side `ArcRuntime` system (per shard for Local/Regional/Shard scopes; per-message-bus subscriber for CrossShard) |
| Tick rate | **0.1 Hz** (every 10 seconds) — arcs are slow; per-tick latency below 10 s is irrelevant for week-long pacing |
| Per-tick work | For each `Arc` row where `completed_at IS NULL`: evaluate every `ArcTransition` whose `from_stage == current_stage`; on first triggering transition, apply `side_effects` (each side effect is an `ActionNode`, dispatched through `VerbDispatcher` with `Caller = { kind: "Sim", reason: "arc:<arc_id>" }`); update `current_stage`; broadcast `ArcStageAdvanced` to participants |
| Event ingestion | None special. Arc transitions whose `trigger` is `PredicateNode`, `QuestCompleted`, etc. read the same flags / quest journal / Virtue tables that any other system reads. Quest completions, Avatar deaths, Virtue threshold crossings, time-elapsed all feed in via the standard event bus (Doc #19 §2.2 trigger types). **No arc-only verb exists.** |
| Idempotency | Side-effects use `client_op_id` derived from `(arc_id, transition_id, tick)` so re-evaluation after a server crash does not re-fire transitions |

The dispatcher invariant (Doc #13 §4) is preserved end-to-end: an arc cannot mutate state except by emitting verb invocations through the same dispatcher used by every other caller. `[BR]`

### 3.1 Storage

A dedicated table in the shard DB (cross-link to Doc #21 §3):

```sql
-- arcs — Arc instances. Adds to Doc #21 §3 schema in a future timestamped migration.
CREATE TABLE arcs (
  arc_id                  BIGSERIAL    PRIMARY KEY,
  shard_id                TEXT         NOT NULL,
  arc_template_id         TEXT         NOT NULL,                       -- canonical id, e.g. "official.guardian.incursion.s1"
  owner_kind              TEXT         NOT NULL CHECK (owner_kind IN ('official','player')),
  owner_avatar_id         BIGINT       NULL REFERENCES player_avatars (avatar_id),
  scope_kind              TEXT         NOT NULL CHECK (scope_kind IN ('Local','Regional','Shard','CrossShard')),
  scope_payload           JSONB        NOT NULL,                       -- region_id / region_ids / null
  pacing_policy           JSONB        NOT NULL,
  persistence_policy      JSONB        NOT NULL,
  current_stage_id        TEXT         NOT NULL,
  stages_blob             JSONB        NOT NULL,                       -- compiled stage array
  transitions_blob        JSONB        NOT NULL,
  virtue_alignment_score  INT          NOT NULL DEFAULT 0,
  started_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expected_end            TIMESTAMPTZ  NULL,
  completed_at            TIMESTAMPTZ  NULL
);
CREATE INDEX idx_arcs_shard_active ON arcs (shard_id) WHERE completed_at IS NULL;
CREATE INDEX idx_arcs_owner        ON arcs (owner_avatar_id) WHERE owner_avatar_id IS NOT NULL;

-- arc_participants — junction. An Avatar can be in multiple arcs (§15).
CREATE TABLE arc_participants (
  arc_id        BIGINT      NOT NULL REFERENCES arcs (arc_id) ON DELETE CASCADE,
  avatar_id     BIGINT      NOT NULL REFERENCES player_avatars (avatar_id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at       TIMESTAMPTZ NULL,
  PRIMARY KEY (arc_id, avatar_id)
);
CREATE INDEX idx_arc_participants_avatar ON arc_participants (avatar_id) WHERE left_at IS NULL;
```

Migration filename per the project rule: `YYYYMMDDHHmmss_add_arcs.pg.sql` / `.sqlite.sql` (Doc #21 §4). `[BR]`

---

## 4. Arc Scopes — Table `[BR]`

| Scope | Bound to | Example | Replication path |
|---|---|---|---|
| `Local` | One region | A Trinsic-only mystery | Standard region replication (Doc #22) |
| `Regional` | Multiple adjacent regions | Brigand sweep across Britain + Yew + Cove | Per-region replication; arc state in shard DB |
| `Shard` | Entire shard | Guardian Incursion | Shard-wide broadcast on shard pubsub channel |
| `CrossShard` | All shards (official only) | Virtue Festival | Doc #22 cross-shard message bus; per-shard `ArcRuntime` mirrors a CrossShard arc as a local Shard-scoped child arc with read-only canonical state |

`CrossShard` is forbidden to UGC (§5). `[BR]`

---

## 5. Official vs UGC Arcs `[BR]`

| Property | Official Arc | UGC Arc |
|---|---|---|
| Author | Origin live-ops team | Player creator |
| Sandbox level (Doc #19 §5) | `Official` | up to `Trusted` |
| Scope | any (`Local` → `CrossShard`) | `Local` or `Regional` only |
| Persistence policy | `LiveCanonical` permitted | capped at `EphemeralPocketRealm` or `LiveWithRollback` until Garriott-team approval promotes; promotion path matches Hall of Wonders curation (Doc #7 §3) |
| Authoring tool | Internal pipeline | Doc #19 visual editor + new "Arc" tab; Lua at `Standard+` (Doc #19 §4) |
| Validator (§16) | run; advisory | run; **blocking** for `LiveCanonical` promotion |
| `gm_avatar_id` for `GMHosted` pacing | any official AvatarId | author or invitee |

UGC arcs reuse the publishing pipeline from Doc #19 §9 — save → compile → validator → auto-test → submit → moderation → publish. The auto-test step instantiates the arc in a private pocket realm and forces every transition to fire at least once (or marks transitions as "unreachable" diagnostics). `[BR]`

---

## 6. Hosted GM Session — Model `[BR]`

```ts
type GMSessionId = string

type GMSession = {
  id:                  GMSessionId
  gm_avatar_id:        AvatarId
  arc_id:              ArcId | null                  // GM may run a session inside an arc
  pocket_realm_id:     RegionId                      // session lives in instanced region (Doc #6 §2 instanced housing pattern)
  participants:        PlayerId[]                    // invited Avatars who accepted
  party_role_map:      Record<PlayerId, PartyRole>
  started_at:          Timestamp
  ended_at:            Timestamp | null
  pacing_state:        PacingState
  authority:           GMAuthority                   // capability bag for THIS session
}

type PartyRole =
  | "Player"                                         // standard participant
  | "TrustedNarrator"                                // co-narrator, can call narrate but not the rest of GMAuthority
  | "Spectator"                                      // observer; cannot act, sees session

type PacingState =
  | "InScene"                                        // GM narrating; soft-pause active (§9)
  | "InExploration"                                  // free-play; world clock running
  | "InCombat"                                       // combat sub-state; pause rules per Doc #16
  | "Gathered"                                       // players summoned to GM location

type GMAuthority = {
  can_puppet_npc:       bool
  can_spawn:            SpawnLimits
  can_handout:          HandoutLimits
  can_modify_weather:   bool
  can_advance_time:     bool                         // skip world clock forward; pocket realm only by default
  can_grant_virtue:     VirtueGrantLimits
}

type SpawnLimits = {
  max_concurrent_entities: int                       // default 50 per session
  archetype_allowlist:     ArchetypeId[] | "all_npc_and_creature"
}

type HandoutLimits = {
  max_value_per_handout: int                         // default 1000gp equivalent (Doc #18 base prices)
  max_handouts_per_session: int                      // default 20
  archetype_blocklist:   ArchetypeId[]               // includes legendary uniques by default
}

type VirtueGrantLimits = {
  max_abs_delta_per_session_per_virtue: int          // default 5
  audit_required: true                               // always logged
}
```

Combat in a hosted GM session follows Doc #16: in a single-player `EphemeralPocketRealm`, SP combat pause rules apply; in a `LiveWithRollback` or `LiveCanonical` shard-realm session, persistent shards do **not** pause for combat (Doc #16). The soft-pause mechanism (§9) is the only way to suspend combat-equivalent action in a persistent context. `[BR]`

---

## 7. GM Capability Tier — Extends Doc #14 §3 `[BR]`

A new capability tier is added to Doc #14's table:

| Capability | Tools enabled | Resources enabled | Typical client |
|---|---|---|---|
| `gm.host` | inherits `avatar.full` + `ugc.author`; adds GM verbs (§8) for participants in the active session ONLY | inherits `inspect.read` + `ugc.author` set; adds `forge://session/{id}/...` resources (§17) | An Avatar who has opened a `GMSession` |
| `arc.author` | inherits `ugc.author`; adds `arc_create`, `arc_advance_stage`, `arc_complete` for own arcs | adds `forge://shard/{s}/arcs/...` for own arcs and public arc templates | An Avatar authoring arcs without hosting |

### 7.1 `gm.host` is session-scoped — load-bearing rule

- Granted at `gm_session_open` success.
- Revoked at `gm_session_close` (or session timeout / GM disconnect).
- Cannot affect non-participants under any circumstance — every GM verb takes a participant `PlayerId`/`EntityId` argument and the dispatcher rejects non-participants with `ERR_GM_NOT_PARTICIPANT`.
- Cannot modify shard-level state outside the session's `pocket_realm_id` *unless* the session's `arc.persistence_policy = LiveCanonical` AND moderation has approved the arc; even then, every shard-level write is recorded in `gm_session_audit` and reversible via the standard rollback path (Doc #21 §7).
- Capability is **immutable per-session** — cannot be elevated mid-session; a stricter `GMAuthority` cannot be widened by re-opening; promotion requires session close → arc edit → new session.

This mirrors Doc #14 §4 invariants and Doc #19 §6 sandbox enforcement: same compile-time + runtime double check; same dispatcher path; same Virtue scoring. `[BR]`

---

## 8. GM Verb Additions `[BR]`

All GM verbs flow through `VerbDispatcher.dispatch(invocation)` with `Caller = { kind: "GM", session_id: GMSessionId, gm_avatar_id: AvatarId }`. The `Caller` enum (Doc #19 §6) is extended:

```ts
type Caller =
  | { kind: "Player",  id: PlayerId }
  | { kind: "UGC",     script_id: string, owner: PlayerId, sandbox_level: ScriptSandboxLevel }
  | { kind: "MCP",     tool: string, session: string }
  | { kind: "AI",      npc: EntityId }
  | { kind: "Sim",     reason: string }
  | { kind: "GM",      session_id: GMSessionId, gm_avatar_id: AvatarId }   // <-- added by this doc
```

Every GM verb shares the standard `VerbEnvelope` / `VerbResult` from Doc #14 §5.

| Verb | Mutates | Virtue movable | Notes |
|---|---|---|---|
| `puppet(npc_entity_id, dialogue_override \| action_override)` | Adds a temporary `Puppeted` component to the NPC binding it to the GM until `unpuppet` or session end; preserves the NPC's underlying schedule + state for restoration | none directly (puppet is narration); downstream actions the puppeted NPC takes score normally for the NPC's owner-of-record (the GM, while puppeted) | GM "speaks/acts AS an NPC"; restores NPC schedule on unpuppet per the resumption rule in Doc #17 §6 (`[OPEN]` mid-schedule resumption — see §19) |
| `unpuppet(npc_entity_id)` | Removes `Puppeted`; resumes NPC schedule | none | Inverse of `puppet`; auto-fires on session end |
| `narrate(participants, text)` | None (broadcast only) | none | Narration broadcast to listed participants; flagged in chat as **"GM narration"**; does NOT use NPC dialogue tree, does NOT enter dialogue session |
| `gm_spawn(template_id, location)` | Spawns NPCs/entities into pocket realm; persistence routes through Doc #21 §13.2 instance-scoped procedural | none directly; spawned entities can later move Virtues normally via standard verbs | Bounded by `SpawnLimits.max_concurrent_entities` (default 50); shard-realm spawns require `arc.persistence_policy != EphemeralPocketRealm` AND moderation approval |
| `private_handout(player_id, item_template, qty)` | Gives item to participant; bypasses normal economy (no shop transaction); routes through `drag` semantics into participant inventory | **applies normal Virtue side-effects** — handing out a poisoned weapon scores the GM the same way as if the GM had crafted and given it; handing out a stolen unique scores the GM under Honesty/Justice | Logged for audit; bounded by `HandoutLimits` |
| `gather(participants?, location)` | Teleports consenting participants to `location` | none | Consent must be granted at session start by each participant (`gather_consent: bool` on session join); revocable mid-session |
| `time_skip(hours)` | Advances local clock for the session's region | none directly; downstream NPC schedule effects fire normally | **Legal only in pocket realm OR `LiveWithRollback` arcs.** Forbidden in `LiveCanonical`. Participants see fast-forward UI (matches Doc #24 instanced-region "narrative compression" pattern) |
| `weather_set(weather_type, duration)` | Sets weather in pocket realm region | none | Pocket realm only; live-world weather is governed by simulation, not by the GM |
| `grant_virtue(player_id, virtue, delta)` | Writes through the Virtue Engine (Doc #5 §4); audit-logged in `player_virtue_log` (Doc #21 §3.4) with verb=`gm.grant_virtue` | bounded by `VirtueGrantLimits.max_abs_delta_per_session_per_virtue` (default ±5); fires standard Virtue side-effects | Crossing the bound returns `ERR_GM_VIRTUE_BUDGET` |
| `set_scene(scene_state)` | Moves `GMSession.pacing_state`; `InScene` triggers soft-pause (§9) | none | The single lever for the soft-pause mechanism |
| `leave_session()` | Removes caller from `GMSession.participants`; closes their shared dialogue if any | Honor delta if leaving during `LiveCanonical` (§14) | Available to participants, not the GM (GM uses `gm_session_close`) |

Standard error codes from Doc #14 §5 plus: `ERR_GM_NOT_PARTICIPANT`, `ERR_GM_NOT_IN_POCKET_REALM`, `ERR_GM_VIRTUE_BUDGET`, `ERR_GM_HANDOUT_BUDGET`, `ERR_GM_SPAWN_BUDGET`, `ERR_GM_NOT_HOST` (when a non-GM participant tries to call a GM-only verb), `ERR_GM_PERSISTENCE_POLICY` (e.g., `time_skip` in `LiveCanonical`).

`[BR]`

---

## 9. Soft-Pause Mechanism `[BR]`

The key real-time-without-turns trick — extends Doc #17 §3 single-player-instanced dialogue to a multi-participant shared session.

| Property | Value |
|---|---|
| Triggered by | GM calls `set_scene("InScene")` |
| Effect | All `GMSession.participants` are placed in a **shared dialogue session** keyed by `(GMSessionId, scene_id)`; this is a new dialogue session kind that is multi-participant rather than per-player-instanced |
| Avatar state | Participants' world clocks tick normally; their **Avatars are non-attackable** while inside the shared dialogue (mirrors NPC `busy` state from Doc #17 §6); incoming attacks return `ERR_BUSY` to the attacker |
| Hostile entity AI | Hostile entities in the pocket realm pause their AI tick while the shared dialogue is open; this is the soft-pause |
| Exit | A participant types `BYE` (Doc #17) or calls `leave_session()`; doing so during a scene drops them out of the GM-narrated moment and out of the soft-pause; their Avatar becomes attackable again immediately |
| Ending the scene | GM calls `set_scene("InExploration")` (or `"InCombat"` or `"Gathered"`); the shared dialogue closes for all participants simultaneously |

Combat in `InCombat` PacingState follows Doc #16: persistent shards do not pause for combat in `LiveCanonical`/`LiveWithRollback` arcs; SP / `EphemeralPocketRealm` arcs pause per Doc #16 SP rules. The soft-pause is the *only* tool the GM has to suspend live-shard combat for narration. `[BR]`

---

## 10. Pacing Levers — Table `[BR]`

| Lever | Mechanism | When to use |
|---|---|---|
| Gather | `gather` verb teleports party to GM | Need synchronized presence (start of scene, big reveal, set-piece location) |
| Soft-pause via shared dialogue | `set_scene("InScene")` | Need narration without combat interruption |
| Time skip | `time_skip(hours)` in pocket realm | Compress days of in-fiction time without forcing players to wait through them |

These three are exhaustive — if a GM "wants to slow it down," they soft-pause; if they "want to fast-forward," they time-skip; if they "want everyone to see this," they gather. There is deliberately no fourth lever. `[BR]`

---

## 11. Dice / Randomness Model `[BR]`

A formal rule, separating GM authority from outcome authority.

| Rule | Statement |
|---|---|
| The GM does NOT roll dice | The simulation already produces stochastic outcomes — combat crits and misses (Doc #16 §3), crafting quality (Doc #18 §5), reagent yield, etc. The GM does not introduce a parallel resolution layer. |
| The GM gets a dispatcher log | The resource `forge://session/{id}/dispatcher_log` is a read-only stream of every verb invocation in the session with rolled outcomes, accessible only to the `gm_avatar_id`. The GM uses this to narrate ("the bandit barely missed", "your blade found its mark"). |
| The GM CANNOT fudge rolls | There is no `fudge_roll` or `set_outcome` verb, by design. Adding one would compromise Virtue scoring (Doc #5) and combat balance (Doc #16). |
| Narrative outcome alternative | When the GM wants a particular outcome for narrative reasons, they have two legitimate paths: (a) call `puppet` and have the puppeted NPC take the deterministic action, OR (b) call `private_handout` to give a participant an item that biases the next roll (a +2 sword before the boss fight). Both paths are auditable, both apply Virtue side-effects normally. |

`[BR]`

---

## 12. Authority Invariants `[BR]`

Mirrors Doc #14 §4. These are enforcement contracts in the dispatcher, not guidelines.

1. **Single ingress.** GM verbs flow through `PlayerInputDispatcher.Submit(...)` only; same dispatcher path as players, MCP clients, UGC scripts. Reviewers reject any PR that adds a second.
2. **Pre-commit Virtue evaluation.** Virtue side-effects are evaluated by the Virtue Engine *before* the verb commits. `private_handout` of a stolen item still moves Honesty/Justice for the GM. `puppet`-driven NPC actions score Virtues for the GM Avatar, not the puppeted NPC's archetype. `gm_spawn` of hostile creatures into a participant's path that result in participant deaths does not directly score Virtues but is audit-logged for moderation pattern detection.
3. **Capability immutability.** `gm.host` is granted at session open and revoked at session close; cannot be elevated mid-session.
4. **Non-participant immunity.** GM cannot modify non-participants. Any GM verb with a target outside `GMSession.participants` (for player verbs) or outside `pocket_realm_id` (for spatial verbs) returns `ERR_GM_NOT_PARTICIPANT` / `ERR_GM_NOT_IN_POCKET_REALM`.
5. **Canon preservation.** GM cannot bypass canon rules (Doc #3 §7). Attempting to `puppet` Lord British, Iolo, Shamino, etc. outside an Alternate Britannia opt-in is auto-rejected at validate (matches the Doc #19 §8.3 red flag rule).
6. **Audit log.** Every GM verb invocation is logged to a new `gm_session_audit` table for moderation review:

```sql
-- gm_session_audit — append-only audit of every GM verb invocation. Adds to Doc #21 §3 schema.
CREATE TABLE gm_session_audit (
  audit_id           BIGSERIAL    PRIMARY KEY,
  session_id         BIGINT       NOT NULL,
  gm_avatar_id       BIGINT       NOT NULL REFERENCES player_avatars (avatar_id),
  shard_id           TEXT         NOT NULL,
  tick               BIGINT       NOT NULL,
  verb               TEXT         NOT NULL,                          -- gm.puppet, gm.narrate, gm.spawn, ...
  target_player_id   BIGINT       NULL,
  target_entity_id   BIGINT       NULL,
  params             JSONB        NOT NULL,
  result             JSONB        NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_gm_audit_session ON gm_session_audit (session_id, tick DESC);
CREATE INDEX idx_gm_audit_gm      ON gm_session_audit (gm_avatar_id, tick DESC);
```

Migration filename per the project rule: `YYYYMMDDHHmmss_add_gm_session_audit.pg.sql`. `[BR]`

---

## 13. Persistence Policy Decision `[BR]`

| Session kind | Default policy | Upgrade path |
|---|---|---|
| Player-hosted ad-hoc GM session | `EphemeralPocketRealm` — fun, low-stakes, nothing commits to live world; pocket realm tears down on session close per Doc #21 §13.2 | Player may *request* `LiveWithRollback` for sessions they want to feel consequential; moderation approves; rollback window is the standard 7-day partition retention from Doc #21 §7.1 |
| Player-hosted recurring campaign | `LiveWithRollback` after first 3 sessions logged clean | Continues at `LiveWithRollback` indefinitely; `LiveCanonical` is never granted to player GMs |
| Official live-ops arc with GM session | `LiveCanonical` — moderation-approved at arc creation; survives to live world | n/a |

`LiveCanonical` is the only policy that allows shard-wide write effects from within a session; it is reserved for official arcs. Player GMs at any tier cannot author a `LiveCanonical` session. `[BR]`

---

## 14. Player-Side Experience `[BR]`

| Stage | Player sees |
|---|---|
| Invitation | A chat-channel invitation card with the session name, GM Avatar name, declared persistence policy, expected duration, and `gather_consent` checkbox. Accept / Decline. |
| Join | Accept teleports to `pocket_realm_id` if declared, or holds the player at their current location and notifies the GM (depending on the session's spatial setup) |
| During session | A persistent UI indicator: **"Hosted by [GM name]"** with the current `PacingState` icon. Access to `forge://session/{id}/journal` for shared notes (any participant or the GM may write; append-only). |
| Soft-pause notice | When `set_scene("InScene")` fires, a corner banner reads **"Scene: GM is narrating. Type BYE to exit."** Avatar is non-attackable. |
| Leave | `BYE` from shared dialogue (mid-scene) OR explicit `leave_session()` verb. In a `LiveCanonical` session, leaving mid-scene without GM approval emits a small Honor delta (broke their word to the party); in `EphemeralPocketRealm` and `LiveWithRollback` it does not. |
| Session close | Snapshot of the session journal is delivered to each participant's permanent inventory as a journal page (Doc #19 §3.2 journal entity); the pocket realm is torn down per `ArcPersistencePolicy` |

`[BR]`

---

## 15. Multi-Arc Coordination `[BR]`

- A single Avatar can participate in **multiple arcs simultaneously**. The single-player journal (Doc #19 §3.2) tracks all of them, paginated by arc; quest progress is independent per arc.
- A single Avatar can host **at most one active GM session at a time**. Attempting `gm_session_open` while one is already open returns `ERR_GM_SESSION_ALREADY_OPEN`. (Spectators and participants in other GMs' sessions don't count.)
- Arc-of-arcs composition is forbidden in v1: an `Arc.stage_quests` may reference a quest, but a quest cannot start a child arc. Quests can fire `OnArcStageAdvanced` events as triggers (Doc #19 §2.2 trigger taxonomy gains `OnArcStageAdvanced` in this doc), but composition is one-level. `[BR]`

---

## 16. Arc Validator `[BR]`

Mirrors Doc #19 §8 Virtue validator. Run at arc submission time and on every edit; re-run pre-promotion to `LiveCanonical`.

### 16.1 Inputs

- The compiled `Arc` (stages + transitions + side_effects).
- All referenced `Quest` definitions (recursively static-analyzed via Doc #19 §8.1).
- All referenced `ArcEvent` payloads (world / economy / weather changes).
- The declared `sandbox_level` of the arc author.

### 16.2 Computation

```
ArcVirtueAlignmentScore =
    Σ over QuestId Q in any stage_quests:
        VirtueAlignmentScore(Q)         // from Doc #19 §8.2
  + Σ over ActionNode A in any entry_effects or transition.side_effects:
        same scoring rule as Doc #19 §8.2 for ActionNode
  + Σ over ArcEvent E in any stage_events:
        signed_score(E)                 // weather/economy events default 0; mass-NPC-death events negative
```

`weight(virtue) = 1.0` for v1; tuning hook reserved (matches Doc #19 §8.2). `[BR]`

### 16.3 Red Flags (block `LiveCanonical` promotion)

- Score ≤ −50 on any single Virtue with no positive branch (uniformly anti-Virtue arc).
- Any transition `side_effect` that auto-revokes Avatar items on transition without explicit consent (anti-griefing pattern).
- Any stage with `entry_effects` that target `[BG]` canonical NPCs with `attack`, `TeleportActor`, or `DespawnEntity` outside Alternate Britannia opt-in (matches Doc #19 §8.3).
- Any stage that uses `ManualGM` triggers in a `RealTime` pacing policy (semantic mismatch — `ManualGM` requires `GMHosted`).
- Any cross-shard side-effect from a non-Official arc.

### 16.4 Approval rule

```
arc_publish_allowed_LiveCanonical = (no red flags) AND (ArcVirtueAlignmentScore >= 0) AND (sandbox_level == Official OR moderation_approved)
arc_publish_allowed_LiveWithRollback = (no red flags) AND (ArcVirtueAlignmentScore >= -25)
arc_publish_allowed_EphemeralPocketRealm = (no red flags)
```

`[BR]`

---

## 17. MCP Additions to Doc #14 §7 `[BR]`

### 17.1 New Tools

All reuse the standard `VerbEnvelope` / `VerbResult` from Doc #14 §5. Each tool's required capability is annotated.

| Tool | Capability | Notes |
|---|---|---|
| `arc_create` | `arc.author` | Creates a new `Arc` row in `arcs` (state = Draft); body matches §2 schema |
| `arc_advance_stage` | `arc.author` (own arc) OR `gm.host` (if `pacing_policy.kind == "GMHosted"`) | Force-advances `current_stage` to the named stage; only legal if a transition with `trigger.kind == "ManualGM"` exists |
| `arc_complete` | `arc.author` (own arc) OR `gm.host` | Marks `completed_at = now()`; runs terminal `entry_effects` of the `end` stage |
| `gm_session_open` | `avatar.full` (becomes `gm.host` for the session) | Opens a `GMSession`; allocates pocket realm; sends invitations |
| `gm_session_close` | `gm.host` | Closes session; auto-`unpuppet` all puppeted NPCs; tears down pocket realm per persistence policy |
| `puppet` | `gm.host` | §8 |
| `unpuppet` | `gm.host` | §8 |
| `narrate` | `gm.host` OR `PartyRole == TrustedNarrator` | §8 |
| `gm_spawn` | `gm.host` | §8 |
| `private_handout` | `gm.host` | §8 |
| `gather` | `gm.host` | §8; only consenting participants teleport |
| `time_skip` | `gm.host` | §8; pocket realm or `LiveWithRollback` only |
| `weather_set` | `gm.host` | §8; pocket realm only |
| `grant_virtue` | `gm.host` | §8; bounded |
| `set_scene` | `gm.host` | §8 |
| `leave_session` | `avatar.full` (any session participant) | §8 |

### 17.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/arcs` | paged list of all arcs on shard `s`, with public metadata (name, owner, scope, persistence_policy, current_stage, started_at) | `inspect.read` |
| `forge://shard/{s}/arcs/{id}` | full arc detail including stages and transitions (definition only, no per-participant state) | `inspect.read`; private arcs gated by participant or owner |
| `forge://shard/{s}/sessions/{id}` | session metadata (gm, participants, pacing_state, started_at) | `inspect.read` for participants; full detail for `gm.host` |
| `forge://session/{id}/journal` | shared session journal (append-only notes) | participant or `gm.host` |
| `forge://session/{id}/dispatcher_log` | read-only stream of every verb invocation in the session with rolled outcomes | **GM-only** (`gm.host` for that session) |

### 17.3 New Capabilities (Doc #14 §3 table extension)

| Capability | Tools enabled | Resources enabled | Typical client |
|---|---|---|---|
| `arc.author` | `arc_create`, `arc_advance_stage` (own arcs), `arc_complete` (own arcs) | `forge://shard/{s}/arcs/...` for own arcs | Arc-authoring creator |
| `gm.host` | session-scoped; all GM verbs (§8); inherits `avatar.full` + `ugc.author` | `forge://session/{id}/...` | A hosting Avatar |

Standard error codes apply, plus the GM-specific codes from §8.

`[BR]`

---

## 18. Phase 1 Prototype Scope `[BR]`

| Subsystem | Phase 1 status |
|---|---|
| Arcs | **Deferred to Phase 2 entirely.** Vertical slice does not test multi-session pacing |
| Hosted GM Sessions | **Deferred to Phase 2 entirely.** No GM verbs ship in Phase 1 |
| Dispatcher extensibility | **Required in Phase 1.** The verb dispatcher is built such that adding `Caller.kind = "GM"` and the GM verbs in Phase 2 is **purely additive** — no refactor needed. This preserves the dispatcher invariant and is the only Phase 1 commitment from this doc. |
| `arcs` / `arc_participants` / `gm_session_audit` tables | Deferred; first migration adding them ships in the Phase 2 multiplayer prototype kickoff |
| Soft-pause via shared dialogue | Deferred; depends on Doc #17's per-player-instanced dialogue extension to multi-participant, which is also Phase 2 |

Phase 1 success metric (matches Doc #11 / Doc #15 §8): Avatar walks Britain with Iolo and Shamino. Nothing in this document blocks that. `[BR]`

---

## 19. Open Questions

1. `[OPEN]` **Max simultaneous participants in a GM session.** Proposed 8 to match Doc #15 multiplayer party cap, but a GM session might want **spectators in addition**. Should `Spectator` count against the cap, or is there a separate spectator cap (e.g., 8 active + 16 spectators)?
2. `[OPEN]` **`puppet` × NPC schedule resumption.** When `unpuppet` fires mid-schedule (the NPC was at slot 3 of an 8-slot daily schedule when puppeted; 6 hours of in-fiction time elapsed during the session): does the schedule resume at the original slot, the slot the NPC *would* have been in by current time, or does it skip ahead with a "missed prayers" penalty? Doc #17 §6 is silent on multi-hour schedule interruption.
3. `[OPEN]` **NPC-companion participation.** Can the GM invite NPC companions of participants (Iolo, Shamino — Doc #15 §3) into the session? Default proposal: companions auto-follow their bound Avatar into the session as ambient party, retain their `Schedule` (degenerate `Follow`), are not subject to `gather` (they follow whoever owns them). Edge case: companion banter (Doc #17 §10) inside soft-pause — banter channel suppressed during `InScene`?
4. `[OPEN]` **GM revenue / monetization.** Doc #7 §4 declares a creator economy. Does the GM earn revenue per session-hour? Per attended participant? Tip jar from participants only? Does revenue change if the session is `LiveCanonical`? Affects taxonomy of "professional GM" tier.
5. `[OPEN]` **Group Virtue gating in arc transitions.** An `ArcTransition.trigger` of kind `PredicateNode` can read participant Virtues. Should the predicate evaluate against (a) every participant individually (ALL must qualify), (b) any participant (ANY qualifies), (c) party Virtue average, or (d) a configurable per-transition mode? Affects arc author expressiveness.
6. `[OPEN]` **Session recording / playback.** Should sessions be recordable for asynchronous post-session review (the GM and participants want to look back at the session like a tabletop replay, or the moderation team wants to review a flagged session)? Storage cost is non-trivial — the dispatcher log + chat + narration text per 4-hour session is in the multi-MB range. Decision affects DB schema.
7. `[OPEN]` **Mid-scene participant disconnect.** A participant in `InScene` PacingState disconnects (network drop, app crash). Options: (a) participant auto-leaves session after 60s grace, soft-pause continues for the rest; (b) session pauses entirely until participant reconnects (within grace window); (c) the GM gets a UI prompt to remove or pause. Default proposal: (a) with the leave logged but not Honor-penalised (disconnect is not a "broke their word").
8. `[OPEN]` **GM-role anti-griefing.** What if a "GM" invites participants only to `private_handout` cursed / poisoned / Virtue-tanking items? Validator catches the static pattern (uniformly negative `private_handout` archetype list = red flag) but a clever GM could intersperse one good handout. Run-time pattern detector across multiple sessions of the same GM? Auto-revoke `gm.host` capability on a per-Avatar reputation threshold?
9. `[OPEN]` **Trusted-GM certification tier.** Should there be a "Trusted GM" tier above ad-hoc hosting — promotion ladder analogous to Doc #19 §5.2 (sandbox promotion), unlocking longer sessions, more participants, `LiveWithRollback` by default? Promotion criteria proposed: 10 sessions logged with no abuse flags + community-vouched.
10. `[OPEN]` **Arc completion side-effects on UGC creator economy.** When a UGC arc completes successfully and pays out RewardEffects, does the arc author earn a creator-economy share of those payouts? Cross-references Doc #7 §4 monetization — same `[OPEN]` as #4 above for arcs vs sessions specifically.

---

## 20. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #6 §1 (persistent world rationale) |
| §2 Arc schema | Doc #19 §2.2 (ActionNode, ConditionNode, PredicateNode reuse), Doc #19 §3 (Quest schema reference) |
| §3 Execution model | Doc #13 §4 (verb dispatcher invariant), Doc #21 §3 (storage), Doc #21 §4 (timestamped migration rule) |
| §4 Arc scopes | Doc #22 (region partitioning, cross-shard message bus) |
| §5 Official vs UGC | Doc #19 §5 (sandbox levels), Doc #19 §9 (publishing pipeline), Doc #7 §3 (Hall of Wonders curation) |
| §6 GM session model | Doc #6 §2 (instanced housing as pocket-realm pattern), Doc #16 (combat pause rules), Doc #21 §13.2 (instance-scoped persistence) |
| §7 Capability tier | Doc #14 §3 (capability table), Doc #14 §4 (invariants), Doc #19 §6 (sandbox enforcement) |
| §8 GM verbs | Doc #14 §5 (envelope/result), Doc #19 §6 (Caller enum extension) |
| §9 Soft-pause | Doc #17 §3 (per-player-instanced dialogue, extended to multi-participant), Doc #17 §6 (NPC busy state mirror) |
| §11 Dice model | Doc #5 (Virtue authority), Doc #16 §3 (combat stochasticity), Doc #18 §5 (crafting quality) |
| §12 Authority invariants | Doc #14 §4 (parallel structure), Doc #21 §3.4 (player_virtue_log), Doc #21 §7 (rollback substrate) |
| §13 Persistence policy | Doc #21 §13.2 (instance-scoped procedural), Doc #21 §7.1 (7-day rollback partition) |
| §14 Player experience | Doc #19 §3.2 (journal entity), Doc #17 (BYE keyword) |
| §16 Arc validator | Doc #19 §8 (Virtue validator structural parallel), Doc #19 §8.3 (canon NPC red flags) |
| §17 MCP additions | Doc #14 §3 (capabilities), §5 (tools), §6 (resources), §7 |
| §18 Phase 1 scope | Doc #11 (roadmap), Doc #20 (OPEN triage) |

---

End of Document #26.
