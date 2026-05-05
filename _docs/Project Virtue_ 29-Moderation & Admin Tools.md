Document #29: Moderation & Admin Tools
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Live Ops & Trust-and-Safety Lead]
Status: Living Technical Reference — Normative spec for the staff-side moderation, GM intervention, and shard-administration surface. Distinct from Doc #26 (player-as-GM hosted sessions); this document is staff-as-referee.

Depends on: #6 Persistent World §5 (Virtue Watch + live GMs), #7 UGC Modding §3 (moderation pipeline), #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface (capability tiers, dispatcher invariants), #21 Save Format & Shard DB (`replication_log` for forensics, snapshot rollback per §7.3), #26 Long-range Arcs & Hosted GM Sessions (player GM — distinct concept; §13 below), #28 Telemetry, Analytics & Live Ops (anomaly feed surfaces tickets here).

---

## 1. Admin Philosophy

Staff admins (paid moderators, community managers, live-ops engineers) hold powers above any player, including player GMs (Doc #26). All admin actions are audit-logged (§9) and reversible where the underlying state model permits. Admins do not bypass the dispatcher invariants of Doc #14 §4: every admin verb still flows through `PlayerInputDispatcher` → `VerbDispatcher`, with `Caller = Admin(staff_id, session_id, capability_tier)`. What changes for admins is the capability surface — they are advertised privileged tools and resources unavailable to any player tier. Reversibility, audit, and dispatcher conformance are the three non-negotiables.

### 1.1 Out of scope: guild Discord servers

Guild-owned Discord servers are **outside our moderation jurisdiction**. We do not operate them, we do not have admin access to them, and we do not enforce against Discord-side behavior. Discord is a third-party community-augmentation layer (Doc #37 §Discord-interop) and is never authoritative, never required, and never inside the game perimeter.

We DO provide a **reporting bridge**: a player who experiences harassment that originated in a guild Discord and was carried into the game (chat, in-game stalking, retaliatory griefing) can flag the in-game manifestation via the normal `PlayerReport` flow (§3.2), and may attach Discord-side context (screenshots, message links) as evidence. Our moderators act on the in-game behavior; they do not act on the Discord-side speech. Discord-only conduct (no in-game manifestation) is a "report to Discord, report to the guild leader" matter, not a Project Virtue moderation matter. See Doc #37 §Discord-interop for the full policy context.

---

## 2. Admin Capability Tiers

Extends Doc #14 §3's capability table. Tiers are strictly inclusive (each tier subsumes everything in the tier below it). Tier inheritance is **not** automatic on grant; explicit grant required per §16 (recommended posture).

| Tier | Includes | Adds | Typical staff role |
|---|---|---|---|
| `admin.viewer` | (read-only) | Read all shards' resources, queues, telemetry. No mutating verbs. | Junior analyst, on-call observer |
| `admin.mod` | `admin.viewer` | UGC moderation actions (approve/reject/takedown/promote-to-Hall), Avatar warnings, mute (chat-scope), temp-ban up to 30d. | Community moderator |
| `admin.gm` | `admin.mod` | Live in-game intervention (`admin_freeze`, `admin_invisible`, `admin_spawn`, `admin_revoke`, `admin_teleport`); permanent bans (with 2-`admin.gm` co-sign per §5); Hall of Wonders curation; Featured promotion. | Live-ops GM, senior moderator |
| `admin.engineer` | `admin.gm` | Direct DB read access; `replication_log` forensic queries; schema migration approval; shard rollback authority (`shard_rollback`); region restart; live cap adjustment. | Live-ops engineer |
| `admin.root` | `admin.engineer` | Capability/role grants and revocations (`grant_capability`, `revoke_capability`); `admin_audit_log` read access; account termination. | Trust-and-safety lead, head of live ops |

| Capability | Tools advertised (cumulative) | Resources advertised (cumulative) |
|---|---|---|
| `admin.viewer` | none mutating | `forge://admin/queue/{p}`, `forge://admin/shard/{s}/health`, `forge://admin/avatar/{id}/timeline`, all `forge://shard/{s}/*` resources cross-shard |
| `admin.mod` | `mod_action`, `warn`, `mute`, `temp_ban`, `restore_virtue` (bug class only) | + `forge://admin/queue/{p}/ticket/{tid}` |
| `admin.gm` | + `admin_freeze`, `admin_invisible`, `admin_spawn`, `admin_revoke`, `admin_teleport`, `permanent_ban`, `avatar_reset` | + `forge://admin/incident/{iid}` |
| `admin.engineer` | + `shard_rollback`, `shard_restart`, `migration_approve`, `cap_adjust` | + `forge://shard/{s}/replication_log` (already in Doc #21 §14.1, gated to `inspect.designer` for designers; `admin.engineer` is its production counterpart), `forge://admin/shard/{s}/snapshots` |
| `admin.root` | + `grant_capability`, `revoke_capability`, `account_terminate` | + `forge://admin/audit_log?since={ts}` (READ ONLY — see §9) |

Capability gating is enforced at the dispatcher's `validate(inv)` step (Doc #13 §4 step 1) and at MCP tool advertisement (Doc #14 §3). A tool not in a session's capability set is **not advertised** and **not callable**. No mid-session escalation is possible; promotion requires session close + new handshake.

`community.mod` (recommended addition; see §16): a tier between player and `admin.mod`, restricted to UGC-only powers (rate-limited approve/reject of low-priority `UGCSubmission` tickets, no enforcement actions, no live-shard verbs). Volunteer power-users.

---

## 3. Moderation Queue

Formalises Doc #7 §3 ("Moderation System") into a single ranked queue served across all shards.

### 3.1 Queue Model

```ts
type TicketId = u64
type TicketKind = "UGCSubmission" | "PlayerReport" | "AnomalyDetection" | "VirtueWatch"
type TicketPriority = "P0" | "P1" | "P2"

type Ticket = {
  ticket_id:      TicketId
  shard_id:       ShardId
  kind:           TicketKind
  priority:       TicketPriority           // derived; see §3.3
  subject_kind:   "Avatar" | "UGC" | "Region" | "Shard"
  subject_id:     string                   // AvatarId | ugc_id | RegionId | ShardId
  reporter_id:    AvatarId | "system"      // "system" for AnomalyDetection / VirtueWatch
  severity:       int                      // 0..100; raw input to priority calculation
  community_votes:int                      // signed; high-Virtue players weighted (Doc #7 §3)
  evidence:       Evidence[]               // links to replication_log slices, telemetry events, screenshots
  state:          "open" | "claimed" | "resolved" | "appealed" | "reopened"
  claimed_by:     StaffId | null
  created_at:     TimestampTZ
  sla_due_at:     TimestampTZ              // derived from priority (§3.4)
  resolution:     Resolution | null        // populated on close
}
```

### 3.2 Ticket Sources

| Kind | Created by | Subject | Carries |
|---|---|---|---|
| `UGCSubmission` | Creator pressing "Submit" (Doc #7 §3 step 4) | `ugc_id` | Virtue+canon scan output, perf-budget result, creator history |
| `PlayerReport` | Avatar in-game report verb (`/report <avatar> <reason>` or NPC-mediated) | `AvatarId` or `ugc_id` | Reason category, free-text, recent context window (last 60 s `replication_log` for reporter+subject) |
| `AnomalyDetection` | Doc #28 telemetry anomaly feed | `AvatarId` \| `RegionId` \| `ShardId` | Anomaly class, statistical signal, baseline deviation |
| `VirtueWatch` | §10 background scorer | `AvatarId` | Rolling Virtue trend, recent low-Virtue verb sequence, witness counts |

### 3.3 Priority Derivation

```
priority(t):
  base   = severity_to_priority(t.severity)         // 0..30=P2, 31..70=P1, 71..100=P0
  bump_creator = -1 if creator.history.score >= 80 else 0   // trusted creators float down (lower priority bucket)
                +1 if creator.history.score <= 20 else 0   // bad-actor history floats up
  bump_votes   = clamp(round(community_votes / 25), -1, +1)
  return clamp(base + bump_creator + bump_votes, P0, P2)
```

Bumps are bounded so community brigading cannot push a P2 directly to P0; only severity does.

### 3.4 SLAs

| Priority | Examples | SLA target |
|---|---|---|
| P0 | Active severe griefing, shard-wide exploit, RTBH (real-time-broken-hostile) anomaly, child-safety report | < 1 hour to claim + initial action |
| P1 | UGC review, individual `PlayerReport` of moderate severity, repeated minor violations | < 24 hours to first action |
| P2 | Low-priority UGC iteration, `VirtueWatch` informational, community feedback | < 7 days |

SLA breaches are themselves telemetry events (Doc #28) and bubble up to `admin.engineer` health dashboards (`forge://admin/shard/{s}/health`).

### 3.5 Actions per Ticket Kind

| Kind | Allowed actions |
|---|---|
| `UGCSubmission` | `approve` \| `approve_with_edit` \| `reject(reason_code)` \| `takedown` \| `promote(featured)` \| `hall_of_wonders` |
| `PlayerReport` | `dismiss(reason)` \| `warn` \| `mute` \| `temp_ban` \| `permanent_ban` (co-sign) \| `escalate(to=admin.gm)` |
| `AnomalyDetection` | `dismiss(false_positive)` \| `silent_observe` \| `auto_warn` \| `auto_temp_ban` \| `escalate` |
| `VirtueWatch` | `dismiss` \| `warn` \| `restore_virtue` (if false-flag) \| `temp_ban` \| `escalate` |

---

## 4. UGC Moderation Actions

Per Doc #7 §3 publishing pipeline. Each action writes to `admin_audit_log` (§9) and updates `ugc_creations.review_state` (Doc #21 §3.7) inside a single transaction with the ticket close.

| Action | Effect | Capability | Reason taxonomy |
|---|---|---|---|
| `approve` | `review_state = approved`; published per submission `visibility` (private/friends/public). | `admin.mod` | none |
| `approve_with_edit` | `review_state = pending`; sends DM to creator with moderator suggestion; awaits creator resubmit. | `admin.mod` | structured edit-suggestion fields |
| `reject(reason_code)` | `review_state = rejected`; reason categorised. | `admin.mod` | `canon_violation` (Doc #3 §7), `tone_violation`, `perf_budget_breach`, `copyright`, `hate_or_harassment`, `csam` (auto-escalates to `admin.root`), `other_with_text` |
| `takedown` | Post-publish removal; `review_state = retired`. Removed from in-game listings; players who already downloaded retain local copy until next sync. | `admin.mod` | mandatory free-text + reason_code |
| `promote(featured)` | Sets `featured = true`; surfaces in Doc #7 §3 "Featured" placement. | `admin.gm` | none |
| `hall_of_wonders` | Curates into Hall of Wonders browser entry (Doc #7 §3). | `admin.gm` | curator note |

**Local-copy semantics on takedown**: takedown is non-destructive on already-downloaded content (Avatars who pulled the UGC into a private instance retain it locally); it only removes the listing and refuses new fetches. Engine refuses to instantiate it on next sync if `review_state = retired` AND the takedown reason is in the hard-block set (`csam`, `copyright`, `hate_or_harassment`).

---

## 5. Player Enforcement Actions

Each writes to `admin_audit_log` and to a player-visible portal entry (per §12 appeal infrastructure).

| Action | Mechanism | Scope | Capability | Reversible? |
|---|---|---|---|---|
| `warn(avatar_id, message)` | In-fiction private message from "Lord Avermere"; visible only to the warned Avatar; creates a record. | Account-wide | `admin.mod` | Yes (record annotation) |
| `mute(avatar_id, scope, duration)` | Blocks chat verbs only; gameplay unaffected. | `shard` \| `global` | `admin.mod` | Yes (early unmute) |
| `temp_ban(avatar_id, duration)` | Avatar cannot log into the bound shard for `duration`. Account survives. | `shard` only | `admin.mod` (1h, 24h, 7d, 30d) | Yes (lift) |
| `permanent_ban(avatar_id)` | Account-wide ban. Avatar cannot log into any shard. | Account-wide | `admin.gm` × 2 (mandatory two-`admin.gm` co-sign; second signer cannot be the originator) | Yes (lift) |
| `avatar_reset(avatar_id)` | Avatar wiped (`player_avatars` row deleted, `player_inventory` cascades per Doc #21 §11.3); account survives, can re-roll. | Account-wide | `admin.gm` | No (data destroyed; restorable only from snapshot if within RPO) |
| `account_terminate(account_id)` | Full account wipe, GDPR-style cascade per Doc #21 §11.3. | Account-wide | `admin.root` | No |
| `restore_virtue(avatar_id, virtue, delta, reason)` | Manual Virtue restoration; bypasses normal Virtue-engine scoring; written as a `restore` row to `player_virtue_log` (Doc #21 §3.4) tagged with `staff_id`. | Per-Virtue | `admin.mod` for bug-class restorations; `admin.gm` for false-flag restorations | Yes (further `restore_virtue` with negated delta) |

Two-signer co-sign for `permanent_ban`: implemented as a two-phase verb. First `admin.gm` calls `permanent_ban(...)` → returns `pending_cosign(co_sign_id)`. Second `admin.gm` calls `permanent_ban_cosign(co_sign_id)` within 24 hours; on co-sign the ban commits. Both signers' staff IDs are recorded in `admin_audit_log`.

---

## 6. Forensics Workflow

For any incident, the forensic flow is a query against `replication_log` (Doc #21 §3.11) keyed by `(actor_id, time_range)`, joined to `player_virtue_log` and the relevant snapshot tables, presented as a replay-able timeline.

### 6.1 Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://admin/avatar/{id}/timeline?since={ts}&until={ts}` | Ordered list of `replication_log` rows for actor `id` in window, joined with `player_virtue_log` deltas, telemetry events (Doc #28), and any GM-session participation rows (Doc #26 §12). | `admin.viewer` |
| `forge://admin/incident/{iid}` | Bundle: original ticket, evidence, timeline window, applied actions, current state. | `admin.mod` |
| `forge://shard/{s}/replication_log?since={tick}` | Raw paged log rows (already in Doc #21 §14.1 for `inspect.designer`); `admin.engineer` is the production counterpart. | `admin.engineer` |

### 6.2 Cross-Linking

- Timeline entries that overlap a Doc #26 player-GM session render with a "GM session" badge and link to the session audit (Doc #26 §12).
- Telemetry-derived rows (anomaly events) link to the source detector (Doc #28 §7).
- Virtue rollback events from §11 (auto-temp-ban reversal, etc.) appear as `restore` rows in `player_virtue_log` with the originating ticket id.

The timeline is replayable: an `admin.engineer` can scrub back to any tick in the visible window and inspect snapshot state via `shard_rollback` against a sandbox shard for repro purposes (never against prod without §8 co-sign).

---

## 7. Live In-Game Intervention (`admin.gm`)

Admin Avatars are first-class Avatars in the dispatcher: same Entity row in `player_avatars`, marked with a `staff_role` flag in `components`. Visual presentation:

- **Halo / sigil**: rendered above the Admin Avatar's sprite, visible to other Admins always; visibility to non-Admin players is shard-configurable (`shard_metadata.feature_flags.admin_visible_to_players`). Defaults vary: Virtue/Beginner shards `true` (trust-via-visibility), Chaos shard `false` (avoid griefer evasion).
- **Name decoration**: `[GM]` prefix, color-distinct from player tags.

### 7.1 Special Verbs

All admin verbs flow through `VerbDispatcher` with `Caller = Admin(staff_id, session_id, capability_tier)` (extending the `Caller` union from Doc #13 §4). Each verb's mutation set is declared and validated by the dispatcher; admin verbs are not exempt from `apply_writes` ordering or `replication_log` writes.

| Verb | Args | Effect | Capability | Reversible? |
|---|---|---|---|---|
| `admin_teleport` | `target_avatar_id?: AvatarId` (self if null), `to: {region_id, x, y, z}` | Repositions Avatar across regions without moongate. Issues a region-handoff in the same way as a moongate verb (Doc #22). | `admin.gm` | Yes (re-teleport) |
| `admin_freeze` | `player_id: AvatarId`, `duration: seconds` | Pauses the target Avatar's input dispatcher (verbs queued but not advanced); used for griefer containment pending §5 action. | `admin.gm` | Yes (early unfreeze) |
| `admin_invisible` | `enabled: bool` | Hides the calling Admin Avatar from non-Admin clients (replication-channel filter); other Admins still see it (with a "stealth" badge). | `admin.gm` | Yes (toggle off) |
| `admin_spawn` | `template_id: ArchetypeId`, `location: {region_id, x, y, z}`, `count?: int` | Debug spawn of an entity from any archetype. Spawned entity carries `acquired_via = "Spawn"` and `spawned_by = staff_id` in `components.audit`. | `admin.gm` | Yes (`admin_revoke`) |
| `admin_revoke` | `player_id: AvatarId`, `item_id: EntityId`, `reason: string` | Removes an illegitimate item from a player's inventory. Item is moved to a quarantine container (per-shard) for evidence. | `admin.gm` | Yes (manual restore from quarantine) |

### 7.2 Dispatcher Treatment

Admin verbs participate in:
- `validate(inv)` — capability check; co-sign check for `permanent_ban`
- `preconditions(inv)` — admin verbs skip distance and ownership preconditions; they do **not** skip LOS-of-replication (`admin_invisible` is the explicit opt-out)
- `score_virtues` — admin verbs do **not** move Virtues for the actor; they may move Virtues for the *target* if the underlying simulation effect would (e.g., `admin_revoke` of a stolen item does not restore the original steal's Virtue penalty automatically; that requires explicit `restore_virtue`)
- `apply_writes` — full participation; writes to `replication_log` with `caller_kind = 'Admin'` and `params.staff_id` populated
- All side-effect channels in Doc #13 §4

---

## 8. Shard-Level Operations (`admin.engineer`)

| Verb | Args | Effect | Capability | Co-sign? |
|---|---|---|---|---|
| `shard_restart` | `shard_id`, `region_id?`, `mode: "graceful" \| "fast"` | Drains players from region (graceful) or signals immediate process restart (fast). Region's interest set is rebound on rejoin. | `admin.engineer` | No, but mandatory reason field |
| `shard_rollback` | `shard_id`, `to_tick: BIGINT`, `reason: string` | Performs Doc #21 §7.3 strategy 2 (snapshot restore + forward replay to `to_tick`). Blast-radius UI surfaces affected Avatars/regions/in-flight trades pre-confirm. | `admin.engineer` | YES — second `admin.engineer` co-sign mandatory |
| `migration_approve` | `migration_id` | Force-approves a queued migration outside scheduled deploy window. Rare; used for emergency hotfix migrations. | `admin.engineer` | YES — second `admin.engineer` co-sign mandatory |
| `cap_adjust` | `shard_id`, `region_id`, `new_cap: int` | Adjusts concurrent-player cap per region in real time. Honored at next region admission check. | `admin.engineer` | No, but bounded ±25% per call from current cap |

`shard_rollback` blast-radius UI: pre-confirm shows count of (a) Avatars that will lose state since `to_tick`, (b) trades in the Doc #18 atomic two-phase trade window crossing the rollback boundary, (c) UGC publishes since `to_tick`, (d) housing changes since `to_tick`. In-flight trades crossing the boundary are resolved per §16 [OPEN]; current default is "abort and refund both sides to pre-trade state, write a `restore` audit row".

---

## 9. Audit Log

### 9.1 Schema

```sql
-- admin_audit_log — append-only, hash-chained record of every admin action.
-- Writes only via the dispatcher post-commit hook. No DELETE or UPDATE permitted at the role level.
CREATE TABLE admin_audit_log (
  audit_id            BIGSERIAL    PRIMARY KEY,
  ts                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  staff_id            TEXT         NOT NULL,
  capability_tier     TEXT         NOT NULL CHECK (capability_tier IN
                        ('admin.viewer','admin.mod','admin.gm','admin.engineer','admin.root','community.mod')),
  action              TEXT         NOT NULL,                          -- verb / mod_action name
  target_kind         TEXT         NOT NULL CHECK (target_kind IN
                        ('Avatar','UGC','Region','Shard','Account','Ticket','Capability','Other')),
  target_id           TEXT         NOT NULL,
  reason              TEXT         NOT NULL,                          -- mandatory; free text
  before_state_hash   TEXT         NOT NULL,                          -- SHA-256 of pre-action subject snapshot
  after_state_hash    TEXT         NOT NULL,                          -- SHA-256 of post-action subject snapshot
  cosigner_staff_id   TEXT         NULL,                              -- for two-signer actions (§5, §8)
  related_ticket_id   BIGINT       NULL,
  related_replog_id   BIGINT       NULL,                              -- replication_log row, if dispatcher-routed
  prev_chain_hash     TEXT         NOT NULL,                          -- SHA-256 of previous row's row_hash
  row_hash            TEXT         NOT NULL                           -- SHA-256(canonical_json(this_row_minus_hash) || prev_chain_hash)
);
CREATE INDEX idx_audit_staff_ts   ON admin_audit_log (staff_id, ts DESC);
CREATE INDEX idx_audit_target     ON admin_audit_log (target_kind, target_id, ts DESC);
CREATE INDEX idx_audit_action_ts  ON admin_audit_log (action, ts DESC);
```

(Migration filename: `YYYYMMDDHHmmss_add_admin_audit_log.{pg,sqlite}.sql` per Doc #21 §4.)

### 9.2 Properties

| Property | Value |
|---|---|
| Mutability | Append-only at the role level (DB role grants INSERT only; SELECT for `admin.root`; no UPDATE / DELETE for any role including superuser in production cluster — enforced via row-level security policy + grant revocation) |
| Read access | `admin.root` only |
| Retention | Indefinite (regulatory + IP-defense rationale) |
| Tamper detection | Hash chain across rows. Each row's `row_hash` covers its own canonical JSON plus `prev_chain_hash`. A break (mismatch on any row's `prev_chain_hash`) triggers a P0 telemetry alert (Doc #28). |
| Hash algorithm | SHA-256, canonical JSON serialization |
| Co-sign rows | Two-signer actions emit two rows (one per signer) sharing a `cosign_group_id` (computed from cosigner-staff-pair + ts-floor); both rows reference the same `related_ticket_id` |
| Snapshot hashes | Computed against the subject's row in the relevant snapshot table at the dispatcher's pre-commit and post-commit boundaries |

The chain-broken alert is itself a P0 ticket of kind `AnomalyDetection` and bypasses the normal SLA queue (escalates directly to all `admin.root` staff).

### 9.3 Even Root Cannot Edit

DB role `admin_root` is granted `SELECT` on `admin_audit_log` and nothing else. The `INSERT` privilege belongs to the engine's dispatcher role only. There is no migration path that grants `UPDATE` or `DELETE` on this table to any role; attempts to author such a migration are rejected by the migration runner via a hard-coded denylist (enforced in the same pass as the timestamp-prefix rule, Doc #21 §4.1).

---

## 10. Virtue Watch Automation

Per Doc #6 §5 ("Virtue Watch System: Automated + community reporting"). Implemented as a background scorer running per-shard.

### 10.1 Rolling Scorer

```
for each Avatar with recent activity in window W (default 7d):
  trend = weighted_sum(player_virtue_log deltas in W)        // recent deltas weighted higher
  if trend.severe_negative_drop >= shard.threshold_severe:
    create_ticket(VirtueWatch, P0, evidence=[timeline(W)])
  elif trend.repeated_low_virtue_actions >= shard.threshold_repeated AND shard.pvp_disabled:
    auto_warn(avatar)
    create_ticket(VirtueWatch, P1, evidence=[verb_sequence])
  elif trend.minor_drift >= shard.threshold_drift:
    create_ticket(VirtueWatch, P2, evidence=[trend_summary])
```

### 10.2 Shard-Type Calibration

| Shard | Behavior |
|---|---|
| `Virtue` | Full Virtue Watch active. Repeated low-Virtue actions in PvP-disabled context → auto-warn + P1 ticket. |
| `Beginner` | Tutorial shard; Virtue Watch threshold is generous; first offenses always trigger only `P2 informational` (no auto-action) — onboarding charity per Doc #24. |
| `Chaos` | Per Doc #6 §2, Virtue penalties for combat are reduced; Watch only triggers on out-of-zone griefing (PvP outside designated arenas, theft of housing-instance contents, harassment via chat). In-zone PvP does not feed the Watch. |
| `Classic` | Single-player + small co-op; Watch effectively disabled (no ticket queue for offline play). |

Thresholds live in `data/moderation/virtue_watch.toml` (one section per shard kind) and are hot-reloadable.

---

## 11. Anti-Cheat Hooks

Suspicious-pattern detectors from Doc #22 §9 (network-protocol-level checks) and Doc #28 §7 (telemetry-level pattern detectors) feed both `VirtueWatch` and the moderation queue.

### 11.1 Common Patterns

| Pattern | Detector source | Default escalation |
|---|---|---|
| Impossible verb rate (player exceeding dispatcher rate-limit caps via timing manipulation) | Doc #22 §9 | Silent observe → auto-warn → auto-temp-ban (24h) |
| Teleport-without-spell (position delta exceeding pathfinding bound without `cast_spell` verb) | Doc #22 §9 + Doc #23 | Auto-temp-ban (1h) on first detection (high-confidence) |
| Infinite reagents (reagent inventory decrement skipped after `cast_spell`) | Doc #22 §9 | Auto-temp-ban (24h) on first detection (deterministic) |
| Packet manipulation (signature mismatch on verb envelope) | Doc #22 §9 | Auto-temp-ban (7d) on first detection |
| Statistical outlier on Virtue trajectory (suspiciously perfect Virtue scores after suspiciously bad ones) | Doc #28 §7 | Silent observe → manual review |

### 11.2 Three-Strike Default

```
on detection(avatar_id, pattern):
  history = anti_cheat_history(avatar_id, pattern, window=30d)
  if history.count == 0 and confidence < 0.9:
    silent_observe(avatar_id, pattern)        // boost telemetry sampling
  elif history.count == 1:
    auto_warn(avatar_id, pattern)
  else:
    auto_temp_ban(avatar_id, duration_for(pattern))
    create_ticket(AnomalyDetection, P0, subject=avatar_id, evidence=full_window)
```

Deterministic patterns (infinite reagents, teleport-without-spell, packet manipulation) bypass the strike count and ban on first detection because they admit no false-positive interpretation.

---

## 12. Player Appeal Process

### 12.1 Flow

1. Banned/warned player sees an in-game notice on next login attempt (or in their account portal if perma-banned). Notice cites the specific action, reason category, and links to the appeal form.
2. Player submits appeal via in-game form (account portal). Appeal carries a free-text statement (≤ 2000 chars) and may attach context.
3. Appeal becomes a `PlayerReport`-kind ticket on the `admin.gm` queue with the original incident attached as evidence and the original moderator as a notify-target (informational, not blocking).
4. `admin.gm` reviews; possible outcomes: `uphold`, `reduce`, `lift`. All write to `admin_audit_log`.
5. SLA: 7 days to first action (hard cap; breach is a P0 telemetry alert).

### 12.2 State Restoration

When an action is `lift`-ed:
- `temp_ban` / `permanent_ban` / `mute`: reversed immediately; player can log in / chat next session.
- `warn`: record annotated with "appealed-and-lifted"; warn count for §10 thresholds is decremented.
- `avatar_reset`: only restorable from snapshot if within Doc #21 §11.1 RPO window; otherwise irreversible (and engineering must approve).
- `restore_virtue`: applied as a counter-`restore_virtue` row in `player_virtue_log`.

### 12.3 No-Appeal Cases

`csam` and confirmed `account_terminate` actions are not appealable through this flow; they route directly to legal escalation.

---

## 13. Distinction from Doc #26 Hosted GM

| Property | Player GM (Doc #26) | Staff Admin (this doc) |
|---|---|---|
| Who | Any Avatar with `gm.host` capability for a hosted session | Paid staff with `admin.*` tier |
| Scope | Per-session, pocket realm, only over participants who joined | Shard-wide, persistent across login |
| Capability binding | `gm.host` granted at session creation, revoked at session close | `admin.*` granted by `admin.root`, persists until explicit revoke |
| Effect on non-participants | None; cannot reach the public shard | Full reach across the bound shard (and across shards for `admin.viewer` reads) |
| Audit | Doc #26 §12 session audit; per-session, retention per session policy | `admin_audit_log` (§9); indefinite retention, hash-chained |
| Dispatcher caller kind | `Caller = GM(host_avatar_id, session_id)` | `Caller = Admin(staff_id, session_id, capability_tier)` |

The two systems share the dispatcher and the verb registry; they do not share capability sets, and `admin.*` cannot be obtained through any in-game progression or hosted-session mechanic. Conversely, an admin running their personal `gm.host` session for friends operates under `gm.host` for that session, not `admin.*` — the two binders are independent. An incident timeline (§6) joining both surfaces clarifies which capability was active for each verb.

---

## 14. MCP Surface Additions

Amends Doc #14 §3 (capabilities), §5 (tools), §6 (resources). Capability gating is strict per §2; no escalation possible mid-session.

### 14.1 New Tools

| Tool | Capability | Notes |
|---|---|---|
| `mod_action(ticket_id, action, reason, params?)` | `admin.mod` (+) | Single entry point for ticket actions in §3.5; specific actions gated by tier and by ticket kind. |
| `warn(avatar_id, message)` | `admin.mod` | §5; in-fiction Lord Avermere DM. |
| `mute(avatar_id, scope, duration)` | `admin.mod` | §5. |
| `temp_ban(avatar_id, duration)` | `admin.mod` (1h, 24h, 7d, 30d) | §5. |
| `permanent_ban(avatar_id, reason)` | `admin.gm` | §5; returns `pending_cosign(co_sign_id)` on first call. |
| `permanent_ban_cosign(co_sign_id)` | `admin.gm` (different staff) | §5; commits the ban. |
| `avatar_reset(avatar_id, reason)` | `admin.gm` | §5; destructive. |
| `account_terminate(account_id, reason)` | `admin.root` | §5; GDPR-style cascade. |
| `restore_virtue(avatar_id, virtue, delta, reason)` | `admin.mod` (bug-class) / `admin.gm` (false-flag) | §5. |
| `admin_freeze(player_id, duration)` | `admin.gm` | §7.1. |
| `admin_invisible(enabled)` | `admin.gm` | §7.1. |
| `admin_spawn(template_id, location, count?)` | `admin.gm` | §7.1. |
| `admin_revoke(player_id, item_id, reason)` | `admin.gm` | §7.1. |
| `admin_teleport(target_avatar_id?, to)` | `admin.gm` | §7.1. |
| `shard_rollback(shard_id, to_tick, reason)` | `admin.engineer` × 2 (co-sign) | §8. |
| `shard_restart(shard_id, region_id?, mode)` | `admin.engineer` | §8. |
| `migration_approve(migration_id)` | `admin.engineer` × 2 (co-sign) | §8. |
| `cap_adjust(shard_id, region_id, new_cap)` | `admin.engineer` | §8; bounded ±25% per call. |
| `grant_capability(staff_id, tier)` | `admin.root` | §2; explicit grant model. |
| `revoke_capability(staff_id, tier)` | `admin.root` | §2. |

### 14.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://admin/queue/{priority}` | Paged tickets at the given priority bucket (`P0` \| `P1` \| `P2`); sortable, filterable by kind/shard/state. | `admin.viewer` |
| `forge://admin/queue/{priority}/ticket/{tid}` | Single ticket with full evidence bundle. | `admin.mod` |
| `forge://admin/incident/{iid}` | Incident bundle (§6.1). | `admin.mod` |
| `forge://admin/avatar/{id}/timeline?since={ts}&until={ts}` | Replay-able Avatar timeline (§6.1). | `admin.viewer` |
| `forge://admin/shard/{s}/health` | Real-time shard health: SLA breach counts, queue depth by priority, anomaly rate, region CCU vs cap, Redis hit rate, dispatcher commit latency. | `admin.viewer` |
| `forge://admin/shard/{s}/snapshots` | Available snapshots and RPO window (overlaps Doc #21 §14.1 `inspect.admin` resource; this is the unified production surface). | `admin.engineer` |
| `forge://admin/audit_log?since={ts}` | Paged `admin_audit_log` rows; READ-ONLY. | `admin.root` |

All admin resources are cross-shard accessible (no `ERR_SHARD_BINDING` for `admin.*` sessions); cross-shard write tools are explicitly forbidden — every mutating tool in §14.1 binds to a single shard at call time.

---

## 15. Phase 1 Prototype Scope

Per Doc #11 (Highmere-only, 8-player, 12 weeks) and Doc #20 prioritisation.

| Subsystem | In scope (Phase 1) | Deferred |
|---|---|---|
| Capability tiers | One `admin.gm` capability for the dev team — full intervention powers in test shard. | `admin.viewer` / `admin.mod` / `admin.engineer` / `admin.root` separation; `community.mod` |
| Moderation queue UI | **None.** Single-player vertical slice has no live ticket flow. | Full queue and SLA infrastructure (Phase 2 multiplayer) |
| Audit log | `admin_audit_log` infrastructure deployed; writes go to a flat-file sink (one JSON line per row) instead of PostgreSQL. Hash chain still computed on every write. | DB-backed audit log + role grants + tamper alerts |
| Appeal process | None (no real players to appeal yet). | Full §12 flow |
| Forensics | `replication_log` is **not** present in Phase 1 (Doc #21 §12). Forensics in Phase 1 is "reload save and inspect". | §6 timeline + incident bundles |
| UGC moderation | Manual approve/reject for the single example UGC creation (Doc #11 success criteria; Doc #7 §6 prototype scope). | Full §4 action set + reason taxonomy |
| Live intervention | `admin_teleport`, `admin_spawn`, `admin_revoke` functional in test shard. | `admin_freeze`, `admin_invisible` (deferred — single-player has no other clients to hide from) |
| Anti-cheat | None (single-player). | §11 detectors (Phase 2) |
| Virtue Watch | None (single-player). | §10 background scorer (Phase 2) |

The Phase 1 audit-log file is a stop-gap; the schema and hash-chain logic ship in Phase 1 so the Phase 2 swap to PostgreSQL is a backend swap behind the same write contract (mirrors the Doc #21 §12 SQLite→PostgreSQL pattern).

---

## 16. Open Questions

1. `[OPEN]` **24/7 staffing model.** Region-by-region rotating coverage (follow-the-sun across geographies) vs. a single global staff pool with timezone-skew tolerance. Affects hiring plan and the SLA realism for P0 outside business hours.
2. `[OPEN]` **`admin.gm` halo visibility default per shard.** Some players want admins visible (trust-via-presence); some want them invisible to preserve role-play immersion. Current default: visible on Virtue/Beginner, invisible on Chaos. Needs Design ratification and possibly a per-Avatar opt-in/out for the viewer.
3. `[OPEN]` **Capability tier inheritance vs. explicit grant.** §2 currently asserts inclusive tiers but recommends explicit grant for actual roles (so a junior `admin.viewer` does not silently become an `admin.mod` because someone reorganised the table). Recommend explicit grant; ratify.
4. `[OPEN]` **`shard_rollback` handling of in-flight Doc #18 atomic two-phase trades.** Default proposed in §8: abort and refund both sides to pre-trade state, write a `restore` audit row. Needs Doc #18 owner sign-off — alternative is "preserve trade outcome, rollback only non-trade state" which complicates the rollback transaction.
5. `[OPEN]` **`community.mod` tier definition.** Volunteer power-users between player and `admin.mod`, restricted to UGC-only powers. Recommended yes; needs scoping of exact action set, reputation gating for promotion, and revocation triggers.
6. `[OPEN]` **Restoring `avatar_reset` from snapshot.** §12.2 says "only restorable if within RPO." The mechanism (hand-extracted SQL from a snapshot vs. a first-class `avatar_restore` admin verb) is not specified. Engineering owner.
7. `[OPEN]` **Cross-shard ban semantics for account-wide actions.** `permanent_ban` is account-wide, but `admin_audit_log` lives per-shard in the multi-shard deployment. Whether the audit row is replicated to all shards or kept on the originating shard with only the ban flag replicated is `[OPEN]`; affects forensics joinability.
8. `[OPEN]` **Hash-chain rotation on partition.** `replication_log` is partitioned daily (Doc #21 §3.11). `admin_audit_log` is unpartitioned and indefinite-retention; chain length grows monotonically. At what point (size, time) does the chain get a checkpoint with a rotation key? Cryptographic-engineering call.
9. `[OPEN]` **Community-guidelines doc for guild Discord servers.** Per §1.1, guild Discord servers are out of our moderation jurisdiction. Should we maintain a non-binding "Avermere Community Guidelines" document that guild leaders are *encouraged* (not required) to adopt for their own Discord servers, modeled on the in-game virtues taxonomy? Trade-off: gives a shared cultural floor and a reference for our reporting-bridge moderators, but creates an implicit expectation that we enforce it (we don't, and won't). Owner: Trust-and-Safety + Community Lead.

---

## 17. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #14 §4 (dispatcher invariants) |
| §2 Capability tiers | Doc #14 §3 (capability sets) |
| §3 Moderation queue | Doc #7 §3 (publishing pipeline), Doc #28 (anomaly feed source) |
| §4 UGC actions | Doc #7 §3, Doc #21 §3.7 (`ugc_creations.review_state`) |
| §5 Player enforcement | Doc #21 §11.3 (account deletion cascade), Doc #21 §3.4 (`player_virtue_log`) |
| §6 Forensics | Doc #21 §3.11 (`replication_log`), Doc #26 §12 (player-GM audit), Doc #28 §7 (telemetry) |
| §7 Live intervention | Doc #13 §4 (dispatcher contract — `Caller` extension), Doc #22 (region handoff for `admin_teleport`) |
| §8 Shard ops | Doc #21 §7.3 (rollback strategies), Doc #21 §4 (migration runner), Doc #18 (in-flight trade handling) |
| §9 Audit log | Doc #21 §4 (migration timestamp rule), Doc #28 (chain-broken alert) |
| §10 Virtue Watch | Doc #6 §5, Doc #6 §2 (Chaos shard PvP-zone semantics), Doc #21 §3.4 |
| §11 Anti-cheat | Doc #22 §9 (network detectors), Doc #28 §7 (telemetry detectors), Doc #23 (pathfinding bound for teleport check) |
| §12 Appeals | Doc #21 §11.1 (RPO window for `avatar_reset` restore) |
| §13 vs Doc #26 | Doc #26 §12 (player-GM session audit) |
| §14 MCP additions | Doc #14 §3, §5, §6 |
| §15 Phase 1 scope | Doc #11, Doc #20, Doc #21 §12 (matching backend-swap pattern) |

---

End of Document #29.
