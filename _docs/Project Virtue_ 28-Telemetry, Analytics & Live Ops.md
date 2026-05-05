Document #28: Telemetry, Analytics & Live Ops
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Live Ops & Data Engineering Lead]
Status: Living Design Reference — Normative spec for telemetry pipeline, analytics event taxonomy, KPI dashboards, live-event scheduling, anomaly detection, performance telemetry, A/B testing infrastructure, and MCP telemetry surface

Depends on: #1 Vision §4 (success metrics), #5 Virtues §2–§4, #6 Persistent World §3 (PersistenceScope), #6 §5 (Virtue Watch System, live GMs), #7 UGC §2, #8 Procedural Generation §5 (live service roadmap), #11 Prototype Scope, #13 Core Schema §4 (verb dispatcher), #14 MCP Server Surface §10, #16 Combat & Magic, #21 Save Format & Shard DB §3.11 (`replication_log`), #22 Network Protocol & Replication, #23 Pathfinding & Spatial Systems, #26 Long-range Arcs & Hosted GM Sessions, #29 Moderation & Admin Tools.

> See Doc #41 (Engine & Stack ADR) for the canonical engine boundary.

---

## 1. Telemetry Philosophy

The verb dispatcher (Doc #13 §4) already produces a complete, ordered, schema-bound event log via `replication_log` (Doc #21 §3.11). Every player input, NPC tick, UGC script call, MCP tool invocation, and `Sim`-caller mutation is already recorded with `caller_kind`, `verb`, `actor_id`, `target_id`, `region_id`, `params`, and `result`. Telemetry is therefore **a derivation problem**, not a collection problem: the analytics pipeline aggregates the verb stream into business-relevant `TelemetryEvent`s downstream of the dispatcher, never instrumented inside it. Two rules are non-negotiable. (1) **No PII in the analytics store.** Player IDs are hashed at the pipeline boundary; raw IDs survive only in the operational DB and a separated re-identification service. (2) **Opt-in for non-essential telemetry.** Per-Avatar `telemetry_consent` flag gates engagement, social, UGC, and economy events; opted-out Avatars emit only essential ops events (errors, perf samples, security events) needed to keep the shard running.

---

## 2. Event Taxonomy

```ts
type TelemetryEvent = {
  event_id:        UUID
  event_type:      EventType
  timestamp:       ISO8601                 // server-authoritative, UTC
  shard_id:        ShardId
  region_id?:      RegionId                // null for cross-shard / lifecycle events
  actor_anon_id:   HashedPlayerId          // SHA-256(player_id || shard_salt); never raw
  session_anon_id?: HashedSessionId        // SHA-256(session_id || shard_salt)
  properties:      Record<string, Value>   // typed per EventType (§2.2)
  pii_redacted:    bool                    // true once redaction pass has run
  schema_version:  int                     // event-type schema version; see §6
}

type EventType =
  // Lifecycle
  | "session_start" | "session_end" | "avatar_create" | "avatar_delete"
  // Engagement
  | "quest_start" | "quest_complete" | "quest_fail"
  | "virtue_threshold_crossed"
  // Economy
  | "purchase" | "sale" | "trade_complete"
  | "recipe_success" | "recipe_failure"
  // Social
  | "guild_join" | "trade_initiated" | "dialogue_opened"
  // UGC
  | "creation_published" | "creation_played" | "creation_rated"
  // Anti-griefing signals
  | "virtue_severe_drop" | "report_filed" | "guard_engaged"
  // Live ops
  | "event_participated" | "live_arc_stage_advanced"
  // Performance
  | "client_perf_sample" | "server_perf_sample" | "network_disconnect"
  // MCP (§10)
  | "mcp_invocation"
```

### 2.1 Properties contracts (representative)

| Event | Required `properties` keys | Source verb / system |
|---|---|---|
| `session_start` | `client_version`, `platform`, `region_at_login`, `tutorial_complete: bool` | client handshake |
| `session_end` | `duration_s`, `disconnect_reason: graceful\|timeout\|kicked\|crash` | client / server timeout |
| `avatar_create` | `class`, `gender`, `path: veteran\|beginner\|preview` (Doc #24 §2) | char gen flow |
| `quest_complete` | `quest_id`, `time_to_complete_s`, `outcome: virtue_aligned\|neutral\|virtue_negative`, `is_ugc: bool` | Doc #19 quest engine |
| `virtue_threshold_crossed` | `virtue: VirtueId`, `from_band`, `to_band`, `direction: up\|down`, `cause_verb: VerbId` | Doc #5 §3 |
| `recipe_success` / `recipe_failure` | `recipe_id`, `inputs: ItemId[]`, `output?`, `skill_check_margin?` | Doc #4.1 |
| `trade_complete` | `counterparty_anon_id`, `items_out`, `items_in`, `gold_delta`, `venue: stall\|chat\|barter` | Doc #18 |
| `creation_published` | `creation_id`, `category: quest\|dungeon\|housing\|item`, `moderation_status` | Doc #7 §2 |
| `creation_rated` | `creation_id`, `rating: 1..5`, `rater_anon_id` | UGC marketplace |
| `virtue_severe_drop` | `virtue: VirtueId`, `delta`, `cause_verb`, `witness_count` | Doc #5 §4 |
| `report_filed` | `target_anon_id`, `reason_code`, `evidence_ref` | Doc #29 |
| `guard_engaged` | `town_id`, `crime_verb`, `disposition: warn\|arrest\|kill` | Doc #6 §5 |
| `event_participated` | `live_event_id`, `stage_id?`, `role: player\|gm` | §6, Doc #26 |
| `live_arc_stage_advanced` | `arc_id`, `from_stage`, `to_stage`, `trigger: predicate\|gm\|timeout` | Doc #26 |
| `client_perf_sample` | `fps_avg`, `frame_time_p99_ms`, `rtt_ms`, `packet_loss_pct`, `gpu`, `cpu` | client (sampled, §8) |
| `server_perf_sample` | `tick_duration_ms`, `entity_count`, `pathfind_p99_ms`, `db_write_p99_ms` | server (every tick aggregate) |
| `mcp_invocation` | `tool`, `caller_session_anon_id`, `result_status`, `latency_ms`, `capability_tier` | Doc #14, §10 |

### 2.2 Derivation contract

Events are emitted by the **derivation service**, not by gameplay code. The derivation service tails the `replication_log` (Doc #21 §3.11) via PostgreSQL logical decoding (Doc #21 §2.2) and applies a registered set of `Derivation` rules:

```ts
type Derivation = {
  name:           string                       // e.g., "virtue_threshold_crossed"
  trigger_verbs:  VerbId[]                     // log rows matching these verbs feed this rule
  predicate:     (row: ReplogRow, prior: AvatarState) => bool
  emit:          (row: ReplogRow, prior: AvatarState) => TelemetryEvent | null
}
```

Lifecycle events (`session_start`/`end`, `avatar_create`/`delete`), perf events, and `mcp_invocation` are emitted **directly** by the relevant subsystem (handshake, perf sampler, MCP server) since they have no corresponding `replication_log` row.

---

## 3. Pipeline Architecture

```
                +----------------------+
  game server   |   replication_log    |   (Doc #21 §3.11, append-only)
  -----------> |   (PG logical decode) |
                +----------+-----------+
                           |
                           v
                +----------------------+      direct emits:
                |   Derivation Service |  <-- session lifecycle, perf, MCP
                |   (rule registry §2) |
                +----------+-----------+
                           |  TelemetryEvent
                           v
                +----------------------+
                |   Event Bus (NATS)   |   <-- recommended; Kafka acceptable alt
                +---+-----+-----+------+
                    |     |     |
        +-----------+     |     +---------------------+
        v                 v                           v
  Sink 1: Realtime     Sink 2: Warehouse ETL      Sink 3: Anomaly Feed
  (Prometheus +        (ClickHouse — recommend)   (Rule + ML detector;
   custom KPI cache)   raw 90d, agg daily 5y       moderation queue ticket
                       per §3.3)                   per Doc #29)
```

### 3.1 Recommended stack

| Component | Recommendation | Alternatives | Rationale |
|---|---|---|---|
| Bus | NATS JetStream | Kafka | Lower ops overhead; per-shard subject hierarchy fits PersistenceScope partitioning. |
| Ops metrics | Prometheus | InfluxDB | Universal; PromQL; PagerDuty wires up cleanly. |
| Ops dashboards | Grafana | — | Standard. |
| KPI dashboards | Custom React + ClickHouse SQL | Looker, Metabase | Custom needed for Garriott Review Dashboard layout; Metabase acceptable for internal-only. |
| Warehouse | ClickHouse | BigQuery, Snowflake | Cost + open-source preferred; `[OPEN]` final vendor §14. |

### 3.2 Topology

- **One bus per region** (US, EU, AP) to keep cross-region traffic off the data plane.
- **One ClickHouse cluster per region** with cross-region replication of daily aggregates only (not raw).
- Re-identification service (§4) is a separate process with its own DB; never colocated with the warehouse.

### 3.3 Retention

| Tier | Storage | Retention | Notes |
|---|---|---|---|
| Raw `replication_log` | PostgreSQL partitioned (Doc #21 §3.11) | per Doc #21 §7 (`[OPEN]` §14) | Operational; not analytics. |
| Raw `TelemetryEvent` | ClickHouse | 90 days | Sufficient for cohort joins, A/B readouts, anomaly back-tests. |
| Daily aggregates | ClickHouse | 5 years | DAU/MAU, retention curves, economy series, virtue series. |
| Anomaly tickets | Doc #29 store | per Doc #29 retention | Out of scope here. |
| MCP invocation log | ClickHouse | 30 days raw, 1 year aggregated | Lower retention; debugging-focused. |

---

## 4. Privacy & Anonymization

| Field | Treatment |
|---|---|
| `player_id` | Never present in analytics store. Hashed at derivation boundary as `actor_anon_id = SHA-256(player_id ‖ shard_salt)`. |
| `shard_salt` | Per-shard 256-bit secret. Rotated on shard re-key event (rare). Old salts retained to allow historical join. |
| `session_id` | Hashed as `session_anon_id` with the same salt. |
| `email`, `payment_id`, `chat_text`, `dialogue_text` | Forbidden in `TelemetryEvent.properties`. Derivation rules that touch these MUST scrub before emit. |
| `creation_id`, `quest_id`, `item_id`, `region_id` | Allowed in cleartext (not PII). |
| Free-text in `report_filed.evidence_ref` | Stored as a content-addressed reference into the Doc #29 evidence store, never inlined. |

### 4.1 Re-identification service

```
+------------------+            +-----------------------+
|  Analytics Query | --denied-->|  Re-Id Service        |
|  (no player PII) |            |  - separate DB         |
+------------------+            |  - separate IAM tier   |
                                |  - audit log on every  |
                                |    lookup              |
                                +-----------+-----------+
                                            |
                                            v
                                +-----------------------+
                                | Operational Player DB |
                                | (raw player_id, email)|
                                +-----------------------+
```

Lookups (`anon_id -> player_id`) are permitted only for:

1. **Support** — player-initiated ticket with case ID.
2. **GDPR/CCPA export** — player-initiated data request.
3. **GDPR/CCPA deletion** — player-initiated data deletion.
4. **Law enforcement** — legal-team-approved request.

Every lookup writes an audit row including requester, case ID, and justification. Bulk lookups require a second approver.

### 4.2 GDPR / CCPA endpoints

| Endpoint | Action | Latency SLO |
|---|---|---|
| `POST /privacy/export?avatar_id=...` | Returns all raw data tied to the Avatar across operational DB and analytics store. | 30 days (legal) / 7 days (target) |
| `POST /privacy/delete?avatar_id=...` | Tombstones operational rows; rotates re-id mapping so `anon_id` becomes unresolvable; analytics rows retained anonymized. | 30 days (legal) / 7 days (target) |
| `GET /privacy/policy` | Public privacy policy hash. | Static. |

### 4.3 Opt-out

```ts
type AvatarOnboardingRecord = {  // extends Doc #24 §2 record
  ...
  telemetry_consent: bool        // default false until explicit consent at first launch
}
```

| Consent state | Events emitted |
|---|---|
| `true` | All event types in §2. |
| `false` | Essential only: `session_start` (no `properties` beyond `client_version`/`platform`), `session_end` (reason only), `client_perf_sample`, `server_perf_sample`, `network_disconnect`, security events from Doc #29. |

Opt-out is per-Avatar, not per-account. Granularity (per-event-class? per-feature?) is `[OPEN]` §14.

---

## 5. KPI Dashboards

Cross-link to Doc #1 §4 success metrics (500k active players, 10k+ UGC creations/year, 70%+ retention).

### 5.1 Engagement

| KPI | Definition | Source events |
|---|---|---|
| DAU | Distinct `actor_anon_id` with ≥1 `session_start` per UTC day | `session_start` |
| MAU | Distinct `actor_anon_id` with ≥1 `session_start` per rolling 30 days | `session_start` |
| Session length distribution | p50 / p90 / p99 of `session_end.duration_s` per day | `session_end` |
| Retention curves | D1 / D7 / D30 / D365 cohort retention from `avatar_create` | `avatar_create`, `session_start` |
| Tutorial funnel | `avatar_create` → `tutorial_highmere_complete` flag (Doc #24 §1) | derived from quest events |
| Discord link conversion rate | % of active players (DAU window) who have linked a Discord account via the Doc #37 §Discord-interop OAuth flow. Tracked as a **community-health** metric, NOT a monetization metric, and never gated on. | `account_consents` (Discord-link state) joined to `session_start` |

Telemetry does NOT capture Discord chat content, Discord message metadata, Discord voice activity, or any Discord-side behavior. Discord is outside the in-game perimeter (and outside our GDPR perimeter — see Doc #38); the only Discord-related datum the analytics pipeline observes is the presence/absence of a link record per account. See Doc #37 §Discord-interop.

### 5.2 Economy

| KPI | Definition | Source events |
|---|---|---|
| Gold velocity | Sum of `trade_complete.gold_delta` (abs) per shard per day / total gold supply | `trade_complete`, `purchase`, `sale` |
| Inflation index | EMA of basket-good median price (10 reference items, set by Doc #18 econ team) | `sale` |
| Top-traded items | Top 50 `item_id` by trade volume per shard per week | `trade_complete` |
| Market stall activity | Distinct stalls with ≥1 trade per day | `trade_complete.venue=stall` |
| Recipe success rate | `recipe_success` / (`recipe_success` + `recipe_failure`) per recipe | recipe events |

### 5.3 Virtues

| KPI | Definition | Source events |
|---|---|---|
| Average Virtue per shard | Mean per-Virtue band per active Avatar per day | `virtue_threshold_crossed` (state replay) |
| Redemption arc completion | Avatars who crossed `virtue_severe_drop` then later crossed back up to neutral within 30 days | `virtue_severe_drop`, `virtue_threshold_crossed` |
| Severe-drop frequency | `virtue_severe_drop` per 1k DAU per day | `virtue_severe_drop` |
| Guard engagement rate | `guard_engaged` per 1k actions per shard | `guard_engaged` |

### 5.4 UGC

| KPI | Definition | Source events |
|---|---|---|
| Creations published per week | Count of `creation_published` per week | `creation_published` |
| Top-rated | Top 100 `creation_id` by mean `creation_rated.rating` (≥10 ratings) | `creation_rated` |
| Moderation queue depth | Open tickets in Doc #29 store | direct query, not event-derived |
| Creator earnings distribution | Sum `purchase` revenue routed to creator per `creation_id`, p50/p90/p99 | `purchase` (UGC items) |
| 10k/year tracking | Cumulative `creation_published` rolling 12-month, charted vs. Doc #1 §4 target | `creation_published` |

### 5.5 Combat (Doc #16)

| KPI | Definition | Source events |
|---|---|---|
| Deaths per region | `result.death=true` rows in `replication_log` filtered to `attack`/`cast_spell` verbs, per `region_id` per day | derived |
| Weapon usage distribution | Histogram of `attack.params.weapon_id` per shard | derived from `replication_log` |
| AI-mode adoption | Distinct Avatars using each Doc #16 AI mode per day | derived |

### 5.6 Live Arcs (Doc #26)

| KPI | Definition | Source events |
|---|---|---|
| Stage advancement rate | Mean `live_arc_stage_advanced` per active arc per day | `live_arc_stage_advanced` |
| Arc completion rate | Arcs reaching terminal stage / arcs started | `live_arc_stage_advanced` |
| GM session count | `event_participated.role=gm` distinct per day | `event_participated` |

---

## 6. Live Event Scheduling System

### 6.1 Entity

```ts
type LiveEvent = {
  event_id:                UUID
  name:                    string
  scope:                   "shard" | "region" | "cross_shard"
  shard_ids?:              ShardId[]                         // required if scope=shard or region
  region_ids?:             RegionId[]                        // required if scope=region
  starts_at:               ISO8601
  ends_at:                 ISO8601
  activation_predicate:    PredicateExpr                     // §6.2
  deactivation_predicate:  PredicateExpr
  payload:                 ArcReference                      // Doc #26 Arc; spawned on activation
  capacity?:               int                               // optional concurrent participant cap
  recurrence?:             CronExpr                          // null = one-shot
  created_by:              StaffId
  approval_status:         "draft" | "approved" | "live" | "ended" | "cancelled"
  approval_chain:          StaffId[]                         // who approved; required for shard/cross_shard scope
}
```

### 6.2 Predicates

`PredicateExpr` is a small, audited DSL evaluated server-side each tick window. Reachable predicate functions:

```
shard_player_count(shard_id) >= N
region_active_arc_count(region_id) == 0
calendar_match(cron)
average_virtue(shard_id, virtue_id) op N
ugc_publish_rate_24h(shard_id) op N
manual()                                  // GM toggles activation/deactivation by hand
```

### 6.3 Lifecycle

```
[draft]
   |  staff submit
   v
[approved]  -- approval chain complete; capability tier liveops.schedule (§10.3)
   |  scheduler reaches starts_at AND activation_predicate true
   v
[live]      -- bus message LIVE_EVENT_ACTIVATED; game servers spawn Arc payload
   |  ends_at OR deactivation_predicate true OR cancellation
   v
[ended]
```

### 6.4 Scheduler

Runs on a control-plane process (one per region, leader-elected). Uses the same CronCreate-style scheduler primitive as Doc #26 GM session scheduling. Polls every 10s. On state transitions, publishes:

```
event_bus topic: liveops.events.{shard_id}
payload: { event_id, transition: "activate"|"deactivate", payload_arc: ArcReference }
```

Game servers subscribe to their shard's topic and on activation invoke `Arc.spawn()` from Doc #26.

### 6.5 Examples

| Event | Scope | Recurrence | Activation predicate | Payload |
|---|---|---|---|---|
| Weekly Guardian Incursion (Doc #6 §4) | shard | `0 18 * * SAT` (Saturdays 18:00 local) | `calendar_match(cron) AND shard_player_count >= 20` | `arc:guardian_incursion_v3` |
| Seasonal Virtue Festival | cross_shard | annual | `calendar_match` | `arc:virtue_festival_summer` |
| Double-XP weekend | shard | quarterly | `calendar_match` | `arc:xp_modifier_2x` (game-balance arc) |
| Player-hosted dungeon run | region | one-shot | `manual()` | per-host `arc:gm_session_*` (Doc #26) |

---

## 7. Anomaly Detection

### 7.1 Detector pipeline

```
event bus --> [Rule Detector]   --+
          --> [ML Outlier]        +-->  Anomaly Aggregator  -->  Doc #29 moderation queue
          --> [Velocity Detector] --+      (de-dupe, severity)
```

### 7.2 Rules (initial set)

| Rule | Signal | Severity |
|---|---|---|
| `verb_rate_spike` | Per `actor_anon_id` verb rate > 2σ above 7-day baseline for 60s | medium |
| `virtue_collapse` | `virtue_threshold_crossed` direction=down crossing ≥3 bands within 5 min | high |
| `ugc_publish_spike` | `creation_published` per `actor_anon_id` > 10/hour | medium |
| `trade_loop` | Same item `id` cycling through ≥3 `trade_complete` between same anon pair within 1 hour with monotonic gold | high (RMT signal) |
| `report_cluster` | ≥5 `report_filed` against same `target_anon_id` within 1 hour from distinct reporters | high |
| `guard_evasion` | `guard_engaged` followed by region-change within 10s, repeated ≥3 times | medium |
| `mcp_capability_misuse` | MCP `result_status=ERR_CAPABILITY_DENIED` rate per session > 5/min | medium |

Rule definitions live in a versioned config (`rules.yaml`) reviewed in PR like any other code change.

### 7.3 ML outlier detector

Per-Avatar feature vector (verb mix, region travel, virtue trajectory, social graph degree) scored against a per-shard population model. `[OPEN]` §14: build (in-house Isolation Forest / Autoencoder) vs. buy (third-party fraud-detection service).

### 7.4 Output

```ts
type AnomalyTicket = {                     // delivered to Doc #29
  ticket_id:      UUID
  detector:       "rule:<name>" | "ml:<model_id>"
  severity:       "low" | "medium" | "high" | "critical"
  anon_subject:   HashedPlayerId
  shard_id:       ShardId
  context:        TelemetryEvent[]         // last N events for triage
  signal_payload: Record<string, Value>
  created_at:     ISO8601
}
```

---

## 8. Performance Telemetry

### 8.1 Client

Sampled `client_perf_sample` at **1% of frames**, never adaptive (constant rate keeps statistics unbiased).

| Field | Description |
|---|---|
| `fps_avg` | Mean FPS over the 1s prior to sample. |
| `frame_time_p99_ms` | p99 frame time in the prior 60s. |
| `rtt_ms` | Round-trip to authoritative server (Doc #22). |
| `packet_loss_pct` | Loss over prior 60s. |
| `gpu`, `cpu`, `ram_gb` | Hardware fingerprint (one-time per session). |
| `region_id` | Player's current region (Doc #6). |

### 8.2 Server

`server_perf_sample` emitted **every tick** as an aggregate (one event per region per second, not per tick).

| Field | Source |
|---|---|
| `tick_duration_ms` | Sim loop |
| `entity_count` | Region ECS |
| `pathfind_p99_ms` | Doc #23 hot path |
| `db_write_p99_ms` | Doc #21 write path |
| `replication_bytes_per_s` | Doc #22 |

### 8.3 Alerts (PagerDuty)

| Alert | SLO | Condition |
|---|---|---|
| Region tick saturation | `tick_duration_ms < 75ms p99` | sustained > 75ms for 60s |
| Pathfind tail | `pathfind_p99_ms < 20ms` | sustained > 20ms for 5 min |
| DB write tail | `db_write_p99_ms < 50ms` | sustained > 50ms for 5 min |
| Region disconnect rate | `network_disconnect` rate < baseline + 3σ | sustained for 2 min |
| Realtime sink lag | derivation lag < 10s | > 30s for 1 min |

`[OPEN]` §14: per-jurisdiction tighter SLOs (EU-required uptime reporting).

---

## 9. A/B Testing Infrastructure

### 9.1 Feature flag service

Centralized flag service (LaunchDarkly recommended; OpenFeature + flagd acceptable open-source alt). Flags evaluated server-side at session start and re-evaluated on flag change.

```ts
type FeatureFlag = {
  flag_id:        string
  scope:          "global" | "shard" | "avatar"
  rollout:        | { kind: "all" }
                  | { kind: "percent", pct: number }       // hash on actor_anon_id
                  | { kind: "shard_set", shards: ShardId[] }
                  | { kind: "experiment", arms: ExperimentArm[] }
  default_value:  Value
}

type ExperimentArm = {
  arm_id:    string
  weight:    number       // weights sum to 1.0
  payload:   Value
}
```

### 9.2 Experiment tagging

Events emitted while an Avatar is enrolled in any active experiment carry an additional `properties._experiments: { [flag_id]: arm_id }` map. Cohort analysis joins on this map.

### 9.3 Use cases

- Virtue scoring coefficient tuning (Doc #5).
- Recipe balance (Doc #4.1).
- Procedural generation parameter sweeps (Doc #8).
- Onboarding default selection (Doc #24 §2).
- Combat AI mode default (Doc #16).

### 9.4 Guardrails

- No experiment may modify a Virtue scoring coefficient on a **persistent shard** without sign-off from the design lead and a defined rollback plan; preferred venue is Beginner shard or staging.
- No experiment may alter monetization without legal sign-off.
- All experiments are catalogued in a public-internal experiment registry; arms older than 90 days are auto-archived.

---

## 10. MCP Telemetry Channel

Doc #14 §10 reserves capability extension for moderation/GM tooling and references this channel.

### 10.1 Event emission

Every MCP tool invocation emits one `mcp_invocation` event with:

| Field | Value |
|---|---|
| `tool` | The MCP tool name (e.g., `examine`, `use`, `schedule_live_event`). |
| `caller_session_anon_id` | Hashed MCP session ID. |
| `result_status` | `OK` or one of Doc #14's `ERR_*` codes. |
| `latency_ms` | Server-side handler time. |
| `capability_tier` | The capability tier the call was authorized under (§10.3). |
| `shard_id` | Bound shard from session handshake (Doc #14 §3). |

Emission happens **after** dispatcher completion but before SSE response, so that failed validations are still recorded.

### 10.2 Designer-only debugging resource

Added to Doc #14's resource table:

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{shard}/telemetry/mcp_recent` | Last 1000 `mcp_invocation` events for the bound shard | `telemetry.read` (§10.3) |

### 10.3 Capability tiers (added to Doc #14 §3 capability set)

| Capability | Holders | Powers |
|---|---|---|
| `telemetry.read` | Designers, QA, support engineers | Read KPI resources, recent MCP, anomaly resources (read-only). |
| `telemetry.admin` | Live-ops engineers | Read all telemetry resources; modify retention configs; flag-event-for-review. |
| `liveops.schedule` | Live-ops team only | Create / approve / cancel `LiveEvent` entities at shard or cross-shard scope. |
| `gm.host` (existing per Doc #26) | Approved player GMs | Schedule region-scope `LiveEvent` for their own hosted sessions only. |

### 10.4 Rate limits via telemetry

MCP rate limits (Doc #14 §3 reserves the policy `[OPEN]`) are enforced using the `mcp_invocation` counters: the rate limiter is a sliding-window counter keyed on `caller_session_anon_id` over the last 60s of `mcp_invocation` events. Limit values per capability tier are config, not code.

---

## 11. Dashboards as Spec

Each dashboard below is a normative artifact: the live-ops UI ships these surfaces.

### 11.1 Live Ops Console

| Panel | Source |
|---|---|
| Shard health matrix (CPU, tick, players, errors) | `server_perf_sample`, Prometheus |
| Active live events table | `LiveEvent` registry, `event_participated` |
| Moderation queue depth | Doc #29 store |
| Top emerging issues (anomaly rollup, last 1h) | `AnomalyTicket` |
| Realtime sink lag indicator | derivation service health |

### 11.2 Designer Dashboard

| Panel | Source |
|---|---|
| Combat outcomes by AI mode (Doc #16) | derived combat events |
| Recipe success rates per recipe | `recipe_success` / `recipe_failure` |
| Quest completion funnels | `quest_start` → `quest_complete`/`quest_fail` |
| Virtue band distribution per shard | `virtue_threshold_crossed` state replay |
| Economy snapshot (gold velocity, inflation, top items) | §5.2 |

### 11.3 Community Dashboard (public-facing, anonymized)

| Panel | Source | Notes |
|---|---|---|
| Top creators (by mean rating ≥10 ratings) | `creation_rated` | Display name shown only with creator opt-in `[OPEN]` §14. |
| Popular regions (by distinct visitors per week) | `session_start.region_at_login` aggregated | Region IDs only. |
| Virtue leaderboard per shard | top-N Avatar Score per shard | Display name only with opt-in. |
| New regions added | `[BR]` content release feed | Doc #8 §5. |

### 11.4 Garriott Review Dashboard (Doc #1)

Pillar metrics for Creative Steward review.

| Pillar | Metric | Target |
|---|---|---|
| Virtue depth | Mean band per Virtue across shards; severe-drop redemption rate | trending up over quarters |
| Simulation engagement | Verb diversity per session (Shannon entropy of verb mix) | sustained ≥ 1992 reference baseline |
| UGC growth | Cumulative `creation_published` rolling 12-month | 10,000+/yr (Doc #1 §4) |
| Persistent population | DAU, MAU | 500,000+ active (Doc #1 §4) |
| Retention | D365 retention | 70%+ (Doc #1 §4) |

---

## 12. MCP Additions to Doc #14

### 12.1 New resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{shard}/telemetry/kpi` | KPI snapshot per §5 (current shard, current day) | `telemetry.read` |
| `forge://shard/{shard}/telemetry/anomalies` | Open `AnomalyTicket` list for the shard | `telemetry.read` |
| `forge://shard/{shard}/telemetry/live_events` | Active and scheduled `LiveEvent` list for the shard | `telemetry.read` (own-host filter for `gm.host`) |
| `forge://shard/{shard}/telemetry/mcp_recent` | (per §10.2) | `telemetry.read` |

### 12.2 New tools

| Tool | Caller | Capability | Behavior |
|---|---|---|---|
| `schedule_live_event(event: LiveEvent)` | `gm.host` for region-scope events on host's own session; `liveops.schedule` for shard / cross-shard | `gm.host` ∨ `liveops.schedule` | Creates `LiveEvent` in `draft` (gm.host) or `approved` (liveops admin). Validates `scope` against caller's tier. Returns `event_id`. |
| `flag_event_for_review(event_id, reason)` | Any session | none required (community reporting) | Files a `report_filed` event tagged with `event_id` for moderation review (Doc #29). Rate-limited to 5/hour per session. |
| `cancel_live_event(event_id)` | `liveops.schedule` (any event) or `gm.host` (own events only) | as above | Transitions event to `cancelled`; publishes deactivate to bus. |

### 12.3 Capability tier additions

Per §10.3: `telemetry.read`, `telemetry.admin`, `liveops.schedule`. These extend the capability set Doc #14 §3 reserves as `[OPEN]`. `gm.host` is owned by Doc #26.

### 12.4 Five Invariants compliance (Doc #14 §4)

- **Single ingress.** `schedule_live_event` does not mutate Entity state directly; it writes to the `LiveEvent` registry. Activation publishes a bus message; a game server then calls `Arc.spawn()` which itself flows through `PlayerInputDispatcher` for any entity creation. No new path into the dispatcher.
- **No bypass.** `flag_event_for_review` and `cancel_live_event` are control-plane writes, not simulation writes; no Virtue, persistence, or replication impact except the resulting `report_filed` derivation.
- **Shard binding.** All resources and tools are bound to `session.shard_id`; cross-shard live-event scheduling requires a session bound to the control plane, not a game shard.

---

## 13. Phase 1 Prototype Scope

Per Doc #11, the prototype is single-shard, 8-player, Highmere-only, 12 weeks. Telemetry scope is deliberately minimal.

| Element | Phase 1 | Deferred to Post-Phase 1 |
|---|---|---|
| Sink | Local file (`./telemetry/{date}.jsonl`) | Bus + ClickHouse |
| Events | 6 types: `session_start`, `session_end`, `avatar_create`, `virtue_threshold_crossed`, `recipe_success`, `quest_complete` | All other §2 types |
| Realtime streaming | None | NATS + Prometheus + Grafana |
| Export cadence | Nightly batch (cron at 02:00 UTC) | Realtime |
| Live event scheduler | Out of scope | §6 full system |
| Anomaly detection | Out of scope | §7 |
| MCP telemetry channel | Stub (logs `mcp_invocation` to file; no resource exposure) | Full §10 |
| A/B testing | Out of scope | §9 |
| Anonymization | Placeholder (single dev environment; no hashing) | Full SHA-256 + per-shard salt |
| GDPR/CCPA endpoints | Out of scope (no real users) | §4.2 |
| Dashboards | Single static HTML report generated nightly from JSONL | §11 dashboards |
| Perf sampling | Local logs only (no aggregation) | §8 |

Phase 1 success metric: at end of any prototype play session, the nightly export produces a JSONL file whose row count matches dispatcher-side counters within 1%, and the static report shows correct DAU=N (where N is the day's distinct test accounts), session length distribution, and per-Virtue threshold-crossing counts.

---

## 14. Open Questions

1. `[OPEN]` **Warehouse vendor.** ClickHouse (recommended for cost + open-source) vs. BigQuery (managed, but per-query cost) vs. Snowflake. Decision drives §3 stack and §3.3 retention costs.
2. `[OPEN]` **Retention legal requirements per jurisdiction.** EU, California, Brazil, South Korea each have different mandates. May force per-region warehouse partitioning beyond the §3.2 plan.
3. `[OPEN]` **Opt-in granularity.** Per-event-class (engagement, economy, social, UGC, perf) vs. per-feature (e.g., chat telemetry separate from quest telemetry) vs. binary as currently specced. Affects UX and data quality.
4. `[OPEN]` **Public dashboard transparency vs. creator anonymity.** Does the Community Dashboard (§11.3) show display names by default with opt-out, or anonymize by default with opt-in? Affects creator discovery vs. privacy.
5. `[OPEN]` **ML anomaly model: build vs. buy.** §7.3. In-house Isolation Forest / Autoencoder vs. third-party fraud-detection (Sift, Castle.io). Cost, vendor lock-in, false-positive rate trade-offs.
6. `[OPEN]` **Offline single-player telemetry.** Single-player Classic shard plays offline (Doc #21 §2.1). Does the client buffer events locally and upload on next online session (with consent)? Or is single-player fully untracked? Affects success-metric coverage.
7. `[OPEN]` **GM session sampling rate.** Doc #26 GM-hosted sessions are creative goldmines for arc tuning. Should `event_participated` and `live_arc_stage_advanced` sample at higher granularity (every minor decision, not just stage transitions) for these sessions? Trades data volume for tuning fidelity.
8. `[OPEN]` **Retention asymmetry: raw `replication_log` vs. derived telemetry.** Doc #21 §7 sets `replication_log` retention separately. If they diverge (e.g., replog 7 days, telemetry 90 days raw), back-fill becomes impossible; need an explicit policy that telemetry retention ≤ replog retention OR that derivation is irreversible-by-design.
9. `[OPEN]` **Cross-shard event identity.** When an Avatar plays on multiple shards (Doc #6 §3 says Virtue is global), does the `actor_anon_id` use the same salt across shards (cross-shard analytics possible) or different salts per shard (privacy-preserving but no cross-shard cohort)?
10. `[OPEN]` **Live-event approval chain composition.** §6.1 requires `approval_chain` for shard / cross-shard scope but does not enumerate roles. Two-of-three live-ops? Director sign-off for cross-shard? Needs ops policy doc.
11. `[OPEN]` **Realtime sink failure mode.** If the bus is down, does the derivation service buffer in PostgreSQL and replay (preserves ordering, costs disk) or drop and rely on warehouse re-derivation from `replication_log` (loses realtime KPIs during outage)?
12. `[OPEN]` **Schema evolution.** §2 declares `schema_version` per event but no migration policy. Old events with old schemas in the 5-year aggregate tier — read-side tolerant parsing, or warehouse migrations on schema bump?

---

This document is the contract for Project Virtue telemetry and live-ops infrastructure. Changes to event taxonomy, MCP additions, retention, or anonymization model require an amendment to this file.
