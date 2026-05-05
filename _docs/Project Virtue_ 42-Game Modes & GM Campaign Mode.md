# 42 — Game Modes & GM Campaign Mode

Project Title: Ultima VII: Project Virtue
Document Version: 1.0
Date: 2026-05-04
Author: [Design Lead]
Status: **Normative spec.** Defines the three supported game modes (Single-Player, Persistent MMO, GM Campaign) and locks the GM-as-player primitive set. Resolves the standing ambiguity between Doc #6 (persistent shards) and Doc #26 (hosted GM sessions) by formally separating dev-run sessions from player-run campaigns. Mode A and Mode B are Phase 1; Mode C is Phase 2.

Depends on: #1 Vision, #2 GDD, #6 Persistent World, #13 Core Schema, #14 MCP Server Surface, #16 Combat & Magic, #17 Dialogue & NPC Schedule, #18 Economy, Crafting & Trade, #19 Quest & UGC Scripting, #21 Save Format & Shard DB, #22 Network Protocol & Replication, #24 Onboarding & Tutorial Flow, #26 Long-range Arcs & Hosted GM Sessions, #28 Telemetry, Analytics & Live Ops, #29 Moderation & Admin Tools, #34 Accessibility, #35 PvP Design & Chaos Shard Rules, #36 Procedural Quest Skeletons, #37 Voice Chat, #38 Data Export & GDPR Portability, #39 Console Certification, #41 Engine & Stack ADR.

Source heritage tags: `[U7]` *Ultima VII* party play. `[UO]` *Ultima Online* shard model. `[D&D]` tabletop role-playing convention. `[NWN]` *Neverwinter Nights* DM Client (1.x). `[BR]` original to Project Virtue.

---

## 1. Overview — Three Game Modes

Project Virtue ships three first-class modes. Each is a real product surface — none is a stretch goal, none is a placeholder.

| Mode | Status | Description |
|---|---|---|
| A — Single-Player | DEFAULT | Solo, offline-capable, full game loop, local Rust binary, no economy bleed |
| B — Persistent MMO | Standard | Order + Chaos shards (Doc #35), real economy, real PvP, full social systems |
| C — GM Campaign | OPTIONAL | Instanced "table" — 1 GM + 1–6 PCs, private world slice, D&D-style |

The rationale for offering all three is straightforward. Mode A satisfies the lineage: Ultima VII was a single-player game and the franchise's identity is anchored there; we cannot ship a successor without a real solo experience. Mode B satisfies the persistent-world ambition (Doc #6) and the commercial scale needed to sustain live-ops. Mode C satisfies a third audience that Mode A and Mode B cannot serve at once: groups of friends who want shared narrative authored by one of their own. Crucially, all three modes share the *same* simulation core (Doc #41 §2.1) — one Rust server binary, one wire protocol, one schema. The differences are session shape, persistence policy, and permission model. We pay the engineering cost of three modes once at the design layer; the runtime cost is small and bounded. The mode taxonomy is intentionally closed at three: a fourth mode (e.g., a competitive arena) would be a feature *inside* one of these three, not a peer of them.

### 1.1 Mode comparison — operational differences

| Axis | Mode A | Mode B | Mode C |
|---|---|---|---|
| Network | Local loopback | WSS to authoritative server | WSS to authoritative server |
| Persistence | Local Postgres or SQLite | Sharded Postgres (Doc #21) | Campaign namespace, Postgres |
| Account required | No | Yes | Yes (cross-internet); no (LAN) |
| PvP | N/A | Per-shard (Doc #35) | GM-set (default consent-only) |
| Voice | None | LiveKit shard channels | LiveKit table + GM private |
| Economy | Self-contained | Shared shard economy | Self-contained, isolated |
| Save authority | Local | Server | Server |
| Concurrency target | 1 | 2,000–10,000 / shard | 1 GM + 1–6 PCs / instance |
| Phase available | P1 | P1 (stub) → P2 (full) | P2 |

---

## 2. The GM Campaign Concept

- One player at the table holds the **GM role** for that campaign instance and that instance only.
- The GM has elevated permissions **scoped to the instance**: never to other campaigns, never to persistent shards, never to the platform.
- Sessions persist across sittings. Players close the client; the campaign state suspends. Reopening resumes from the snapshot.
- Modeled on tabletop convention `[D&D]` — session zero, lines & veils, X-card, narrator authority.
- Heritage anchors: Neverwinter Nights' DM Client `[NWN]` is the closest prior art in CRPGs; Ultima VII's *Forge of Virtue*-style authored content `[U7]` is the tonal target.
- Mode C is **not** a substitute for Mode B. Campaigns are private slices, not public worlds. There is no shared economy with Mode B and no leaderboard cross-population.
- The GM is **a player first.** The role is granted at instance creation, not at account creation; there is no "GM account type" and no application process. Anyone with the client can host a campaign.

---

## 3. GM Permissions — Five Primitives

The GM toolkit collapses to exactly five verbs. Anything that does not fit one of these is out of scope for v1 and goes through OQ-resolution before being added. Five is the budget; we hold it.

| Primitive | Verb | Description | Doc ref |
|---|---|---|---|
| Adjudicate | `gm.override_resolution` | Override damage rolls, force outcomes, declare critical | Doc #16 |
| Pause | `gm.pause_instance` | Freeze world clock on this instance | Doc #22 |
| Peek | `gm.peek_player_state` | Scoped read of player state inside campaign | Doc #29 |
| Narrate | `gm.narrate` / `gm.whisper` | Broadcast text/voice; whisper to one | Doc #37 |
| Stage | `gm.spawn_npc` / `gm.drop_skeleton` / `gm.edit_terrain` | Spawn entities, drop skeletons, edit instance terrain | Docs #36, #17, #13 |

### 3.1 Adjudicate

- **Scope:** the next combat resolution event, or a named resolution by id, on the instance only. Never a resolution on a shard.
- **Authorization:** GM role on this instance; rejected by dispatcher otherwise with `ERR_VERB_OUT_OF_SCOPE`.
- **Audit:** every override writes a row to `gm_audit_log` (Doc #29 §6) with original roll, override roll, and a free-text reason.
- **UI surfacing:** the affected player sees a "GM adjudicated this roll" tag in their combat log; the original roll is hidden but the *fact* of the override is visible. Transparency without spoiling narrative tension.
- Designed to feel like a tabletop GM nudging a die behind the screen — sparingly, narratively. Not a god-mode toggle. The verb is rate-limited (server-side cap of 1 per combat round) to discourage abuse.

### 3.2 Pause

- **Scope:** halts the instance tick (Doc #22 §3 fixed-tick scheduler) for this instance only. Other instances and shards keep ticking unaffected.
- **Authorization:** GM role; auto-revoked if GM disconnects for more than 5 minutes, instance auto-resumes.
- **Audit:** pause start, pause end, duration. Long pauses (>30 min) flagged in telemetry (Doc #28).
- **Player effect:** clients render a "GM paused" overlay; input still flows for chat and inventory inspection but combat verbs are queued, not applied.
- Used for narration breaks, snack breaks, and "wait, let me check the rule" moments.

### 3.3 Peek

- **Scope:** read-only inspection of inventory, stats, journal, and active effects of a PC inside this campaign.
- **Authorization:** GM role; PC must be a member of the campaign. Cannot peek players in other instances or on shards.
- **Audit:** every peek logs as a `verb.gm.peek` event per Doc #29; player is **notified in their UI** that the GM peeked (table-stakes consent transparency).
- **Privacy boundary:** peek does not reveal the player's *account-level* data (real name, email, payment status). Only the in-character state of the PC inside this campaign.
- Not a write verb. Mistakes during peek do not edit state; the verb is idempotent and side-effect-free.

### 3.4 Narrate

- **Scope:** push text or voice into the campaign instance channel (Doc #37). Whisper variant pushes to a single PC.
- **Authorization:** GM role; channel scoped to instance; rejected if target PC is not a campaign member.
- **Audit:** narrate transcripts retained per Doc #38 retention rules; whispers retained but flagged private and excluded from default exports.
- **Voice path:** uses the LiveKit GM private sub-channel (§8); text uses the normal chat substrate with a `[GM]` prefix tag.
- **Player consent:** voice narrate requires the same consent flag as voice chat generally (Doc #37 §4); a player who has muted voice in settings does not hear voice narration but receives a transcribed text fallback.

### 3.5 Stage

- **Scope:** spawn NPCs, drop a procedural quest skeleton (Doc #36), or edit terrain on tiles owned by the instance. Terrain edits are bounded by an instance heightmap, not the shard's.
- **Authorization:** GM role; the quest binder validates the skeleton against Doc #36 §4 invariants before instantiation.
- **Audit:** every spawn and terrain edit is a row; terrain edits are also rendered on a "GM diff" overlay visible to the GM only.
- **Resource cap:** instance has a soft cap on entity count (default 256 NPCs) and a hard cap (1024) to prevent DoS via spam-spawn. The dispatcher rejects spawn verbs past the hard cap.
- **Terrain rollback:** every terrain edit is reversible by the same GM; rollback is a single verb (`gm.undo_stage`) operating on the GM's own staged changes.
- Stage is where most session prep happens; it is intentionally the most expressive verb.

### 3.6 What is intentionally NOT a GM primitive

To clarify the boundary, the following are explicitly excluded from the v1 GM verb set:

- Granting items to a player's persistent (Mode B) inventory — blocked by §6 isolation.
- Modifying a player's account-level metadata (name, email, billing).
- Inviting non-campaign players into the instance mid-session without going through the standard invite flow.
- Editing other GMs' campaigns or peeking into shards.
- Bypassing the consent layer (§7) — even the GM cannot override an X-card invocation.
- Authoring new dialogue trees from inside the GM client. Authoring is a Doc #19 (UGC scripting) workflow and runs through the offline tooling chain, not the live verb set.
- Direct database writes. The GM has no SQL surface; every state change goes through the dispatcher.

### 3.7 Verb authorization summary

| Verb | Scope | Audit | Rate-limited | Reversible |
|---|---|---|---|---|
| `gm.override_resolution` | Single resolution event | Yes | 1/round | No (replays would change history) |
| `gm.pause_instance` | Instance tick scheduler | Yes | None | Yes (resume) |
| `gm.peek_player_state` | One PC, read-only | Yes (player notified) | 1/sec/PC | N/A (read-only) |
| `gm.narrate` / `gm.whisper` | Channel | Yes (transcript) | None | N/A (chat) |
| `gm.spawn_npc` | Instance, capped | Yes | Soft cap 256 | Yes (despawn) |
| `gm.drop_skeleton` | Instance | Yes | None | Yes (cancel) |
| `gm.edit_terrain` | Instance heightmap | Yes | None | Yes (`gm.undo_stage`) |

---

## 4. Campaign Instance Lifecycle

The lifecycle is a small state machine: `DRAFT → INVITED → RUNNING ↔ PAUSED → SUSPENDED → ARCHIVED → DELETED`. Each transition is a verb, every verb is logged, and most transitions are GM-initiated.

### 4.1 State transition table

| From | To | Verb | Initiator | Notes |
|---|---|---|---|---|
| — | DRAFT | `campaign.create` | GM | Allocates `campaign_id` |
| DRAFT | INVITED | `campaign.send_invites` | GM | Generates invite tokens |
| INVITED | RUNNING | `campaign.start_session` | GM | Quorum required |
| RUNNING | PAUSED | `gm.pause_instance` | GM | Tick halts |
| PAUSED | RUNNING | `gm.resume_instance` | GM or auto (>5 min DC) | Tick resumes |
| RUNNING | SUSPENDED | `campaign.end_session` | GM | Snapshot durable |
| SUSPENDED | RUNNING | `campaign.start_session` | GM | Resume from snapshot |
| SUSPENDED | ARCHIVED | `campaign.archive` | GM or auto (90 days) | Read-only |
| ARCHIVED | SUSPENDED | `campaign.unarchive` | GM | Within 90 days only |
| any | DELETED | `campaign.delete` | GM | Triggers Doc #38 export |

### 4.2 Lifecycle event details

- **Creation (DRAFT).** GM clicks "Host Campaign" in main menu. Instance is allocated by the matchmaker (Doc #22 §11), receives a `campaign_id`, persists to `campaign_save` rows (Doc #21 §6). DRAFT is private to the GM.
- **Player invitation (INVITED).** GM sends invites by player handle, email, or Discord-link (see OQ-8). Invitees accept; their account picks up a `campaign_membership` row. The instance remains INVITED until quorum (GM-set) joins.
- **Session start (RUNNING).** All members present (or quorum) → instance enters `RUNNING`. Tick resumes. Voice channel goes live (Doc #37). The session-zero questionnaire (§7) is required on first start.
- **Mid-session: pause (PAUSED).** GM invokes `gm.pause_instance`; tick halts; players retain client state.
- **Mid-session: resume (RUNNING).** GM re-invokes; tick resumes from the last frame.
- **Mid-session: snapshot.** Server auto-snapshots every 5 minutes; GM can force-snapshot at any time. Snapshots are stored alongside shard saves (Doc #21 §7) but in the campaign namespace and are independently restorable.
- **Session end (SUSPENDED).** GM ends the session; instance enters `SUSPENDED`; world state freezes; voice channel closes; players disconnect cleanly. Final snapshot is durable.
- **Session resume on next sitting.** Quorum reconvenes; instance lifts from `SUSPENDED` to `RUNNING`; clock resumes from the suspend snapshot point.
- **Player leaves mid-campaign.** Their PC is despawned; their character data retained in the campaign save in case they return; their `campaign_membership` row is marked inactive but not deleted.
- **GM disconnects mid-campaign.** Instance auto-pauses after 5 minutes (§3.2). After 24h with no GM, players are notified the campaign is dormant. After 90 days the campaign auto-archives (subject to OQ-4).
- **Campaign end (ARCHIVED).** GM archives the campaign; final save stored read-only; cosmetic trophies (§6) granted to participants. Archived campaigns are restorable to SUSPENDED on GM request within 90 days; after that, archives are read-only and can be exported via Doc #38 but not re-run.
- **Campaign deletion (DELETED).** GM-initiated deletion follows Doc #38 (data export then purge). Per-participant data is retained or purged per each participant's GDPR preference, independent of GM deletion.

---

## 5. Permission Model

- The GM role is **per-campaign, not per-account.** A player can be GM of campaign X and a regular PC in campaign Y simultaneously. The verb table is keyed on `(account_id, campaign_id)`.
- GM rights **expire on leave.** Quitting a campaign drops all GM verbs scoped to it; rejoining requires a fresh role grant.
- Every GM verb is **audit-logged** per Doc #29 §6. Logs are visible to the GM, the player affected (if any), and platform moderation. Logs are immutable from GM-side.
- Players can **leave a campaign at any time** via menu. No GM consent required. Leave drops their `campaign_membership` row to inactive and triggers a server-side notification to the GM.
- GM **cannot be elevated to global admin.** The role grants instance-scoped verbs only; the dispatcher rejects any GM-issued verb that targets a non-instance entity with `ERR_VERB_OUT_OF_SCOPE`.
- The **permission spaces are disjoint.** `gm.*` verbs are not a superset, subset, or sibling of `admin.*` verbs (Doc #29). They occupy a separate verb namespace and cannot be combined. A platform admin who is also a GM in some campaign uses two different verb sets in two different contexts.
- **Role transfer (`campaign.transfer_gm`).** Mid-campaign GM transfer is supported but requires both old-GM and new-GM consent; it logs as a privileged event and triggers a moderator-visible audit row.
- **Role co-tenure.** Two-GM campaigns are **not supported in v1.** See OQ-2 for the related "GM also a PC" question.

### 5.1 Role matrix

| Role | Granted by | Scope | Verb namespace | Revocable by |
|---|---|---|---|---|
| Player (PC) | Self (account creation) | Global | `verb.player.*` | Self |
| Campaign member | GM invite + accept | One campaign | `verb.player.*` (in-instance) | Self or GM (kick) |
| GM | `campaign.create` or `campaign.transfer_gm` | One campaign | `gm.*` | Self (resign), platform mod |
| Platform admin | Internal HR process | Global | `admin.*` | Internal HR process |

### 5.2 Disjoint namespaces

The verb namespaces `verb.player.*`, `gm.*`, and `admin.*` are mutually exclusive. The dispatcher validates the namespace prefix against the caller's role set on every verb invocation. A GM cannot call `admin.*`; an admin cannot call `gm.*` without first being granted GM role on a specific campaign through the same flow as any player.

---

## 6. Isolation Rules — No Economy Bleed

The campaign mode is firewalled from the persistent economy. The rules are short and blunt:

- **No items, currency, or XP transfer FROM campaign TO persistent shards.** The dispatcher rejects any verb that attempts a cross-namespace transfer with `ERR_NAMESPACE_VIOLATION`.
- **No items FROM persistent shards INTO a campaign.** The GM provides starter gear from the campaign's own item table; players' shard inventories are invisible inside the campaign.
- **Cosmetic-only "campaign trophies" are the only persistent reward.** Titles, portraits, and badges may be granted on campaign-end and surface on a player's account-wide vanity layer. They have no stat impact on Mode B and cannot be sold or traded.
- **Same isolation applies to Mode A.** Single-player saves cannot be uploaded to shards; shard characters cannot be downloaded into single-player.
- **Rationale:** prevents campaigns from being a duping vector. Without strict isolation a GM could spawn 10,000 gold and have a player ferry it to Order — destroying the Doc #18 economy in an evening.

The isolation rule is symmetric, enforced server-side, and load-bearing. It is the single design choice that lets us offer GM staging at all without compromising Mode B's shard economy. Every GM verb that touches inventory or currency carries an implicit `campaign_id` scope, and the dispatcher will not accept the verb without it.

### 6.1 Trophy types

| Trophy | Granted on | Persists where | Stat impact |
|---|---|---|---|
| Title (e.g., "Survivor of the Dark Tower") | Campaign archive | Account vanity | None |
| Portrait frame | Campaign archive | Account vanity | None |
| Badge | Per-campaign milestone | Account vanity | None |
| Codex entry | Per quest skeleton resolved | Per-account codex | None |

### 6.2 Enforcement points

- Dispatcher (Doc #14) rejects any verb with mismatched namespaces.
- Database constraint: `campaign_save.item_id` is in a different sequence space from `shard_save.item_id`; a foreign-key copy is impossible.
- Wire protocol (Doc #22): inventory replication frames are scoped to the connection's current namespace; cross-namespace frames fail validation.
- Audit: any rejected cross-namespace verb logs as a security event for moderation review.

---

## 7. Consent & Safety Tools

Tabletop convention treats safety tooling as table-stakes; we do the same. All six are in v1 and surface in the GM and player UI.

- **X-card.** Any player at the table may invoke the X-card; the current scene fades and the GM is notified to redirect. The X-card invocation is itself never broadcast — only the GM sees who invoked it, and even that is suppressible if the player chooses anonymous mode.
- **Lines & veils.** Session-zero questionnaire captures hard "lines" (never depict) and soft "veils" (fade-to-black). GM UI surfaces these as flags on the staging panel (e.g., "this NPC type is a 'line' for player X").
- **Session-zero questionnaire.** First-session checklist filled by every player; results visible to GM; never visible to other players. Includes lines/veils, content sensitivity, and PvP consent.
- **Kick / mute** with a cooldown. GM can kick a player; the kicked player gets a 24h cooldown before re-invitation is permitted (anti-harassment). Mute is reversible; kick is not (re-invite required).
- **Report-up** to platform moderation (Doc #29). Any participant can escalate; the campaign's audit log is shared with moderators on report. The GM is notified of report-up but cannot block or delete it.
- **Recording with explicit consent.** Voice/text recording requires every participant to opt in per session; opt-out is honored immediately and retroactively (post-session opt-out triggers transcript redaction within 24h per Doc #38).

### 7.1 Session-zero questionnaire fields (default set)

| Field | Type | Visible to |
|---|---|---|
| Hard lines (never depict) | Free text | GM only |
| Soft veils (fade-to-black) | Free text | GM only |
| Combat intensity comfort | 1–5 scale | GM only |
| PvP consent (intra-party) | Boolean | All players |
| Voice chat consent | Boolean | All players |
| Recording consent | Boolean | All players |
| Pronouns | Free text | All players (opt-in) |
| Accessibility needs (Doc #34) | Free text | GM only |

### 7.2 Safety verb invocation

- **X-card** is a global hotkey, configurable, default `F12`. It is intentionally one keypress and does not require menu navigation. Activation is silent client-side; the GM client receives a non-blocking notification.
- **Report-up** routes a snapshot of the last 60 seconds of audit log + a short free-text note to platform moderation. The reporter's identity is visible to moderation but not to the GM.
- **Kick / mute** are GM-only verbs and are themselves audited. A pattern of repeat kicks against a single player triggers a moderation review per Doc #29.

---

## 8. Engine & Stack Mapping (per Doc #41)

Mode C lives on the same stack as Modes A and B; Doc #41 boundary rules apply unmodified. The campaign instance is a small Tokio task group inside the same Rust server process that hosts shards — it does not run on a separate binary or in a separate fleet.

- **Campaign instance runs on Rust server** as a small Tokio task group per active campaign. Each instance carries its own `bevy_ecs` world, scheduled at the same fixed-tick cadence as a shard but with a much smaller entity count (typically <500 vs. a shard's 100,000+).
- **GM verbs are server-side authoritative.** The GM client emits intent; the dispatcher (Doc #14) validates the verb against the campaign's permission set; the simulation applies the effect. No client-side GM authority. A compromised GM client cannot grant items, override rolls, or bypass scope.
- **GM client UI ships in BOTH UE5 and TS web clients** (Doc #41 §2). Feature parity is required at v1; the TS client is the iteration vehicle but the UE5 client must reach parity before public Phase 2 launch.
- **Voice via LiveKit** (Doc #37) with a table channel (all participants) and a GM private channel (whispers + GM scratch). Channel topology is allocated at session start and torn down at session end; LiveKit room IDs are scoped to `campaign_id` and rotated per session.
- **Quest skeleton staging consumes Doc #36 binder.** GM picks a skeleton template; the binder validates and instantiates; the resulting quest scopes to the campaign instance only and is deleted on archive.
- **Persistence** uses the same `sqlx`/Postgres path as shard saves (Doc #21), under a `campaign_*` namespace separate from `shard_*`. Backup, replication, and restore tooling work uniformly across both namespaces.
- **Resource budget per instance:** target <50 MB RAM, <2% of one CPU core at fixed tick. A single Rust server box should host 200+ idle (SUSPENDED) campaigns and 50+ active (RUNNING) campaigns concurrently.

### 8.1 Server-side ownership matrix

| Concern | Owner |
|---|---|
| Instance allocation / matchmaking | Rust server, `campaign_matchmaker` module |
| Tick scheduling | `bevy_ecs` per-instance world |
| Verb dispatch + scope check | Dispatcher (Doc #14) |
| Persistence | `sqlx` with `campaign_*` tables (Doc #21) |
| Voice channels | LiveKit (Doc #37) — token issuance from Rust server |
| Audit log | `gm_audit_log` table (Doc #29) |
| Trophy grant | Rust server on `campaign.archive` verb |

### 8.2 Client-side ownership matrix

| Concern | UE5 client | TS web client |
|---|---|---|
| GM staging panel | Yes (Phase 2.5) | Yes (Phase 2) |
| Audit log viewer | Yes | Yes |
| Player-side X-card | Yes | Yes |
| Voice UI | Yes | Yes (LiveKit web SDK) |
| Console-specific input | Yes | N/A |
| Press-demo / livestream | N/A | Yes (preferred) |

---

## 9. Single-Player Mode Specifics

Mode A is the simplest mode, but it is not a stripped-down Mode B — it is a first-class product target with its own constraints.

- **Local Rust binary.** Same simulation core as the dedicated server, packaged as a single executable. No network listener.
- **No LiveKit**, no voice chat substrate. Audio is local only.
- **No Discord** integration, no rich presence, no friends graph (account-optional).
- **No GDPR perimeter** because no PII leaves the device. Doc #38 export tooling still runs locally and produces the same artifact as a server-side export.
- **Save format identical to shard save** (Doc #21). A single-player save can be inspected with the same tooling; what it cannot do is upload to a shard (§6).
- **Same isolation rule** applies — single-player progress does not cross into Mode B or Mode C.
- **Always offline-available.** No login required, no licence-server check beyond first-run activation.
- **Console parity (Doc #39).** Mode A is the only mode required at console launch; Modes B and C may follow under separate cert tracks.

### 9.1 Mode A subsystem deltas vs. Mode B

| Subsystem | Mode B | Mode A |
|---|---|---|
| Authoritative server | Remote Rust binary | Local Rust binary (same code) |
| Wire transport | WSS over internet | Loopback (in-process channel) |
| Anti-cheat (Doc #32) | Active | Disabled (no opponent) |
| LiveKit voice | Active | Not initialized |
| Telemetry (Doc #28) | Streamed | Buffered locally, opt-in sync |
| Patch cadence | Live ops | Standalone game updates |
| GDPR (Doc #38) | Server-side enforced | Client-side export tool |
| Save backup | Server replicas | User-managed local files |

---

## 10. Mode Selection Flow

- **First-time launch defaults to Mode A tutorial.** New players land in single-player onboarding (Doc #24) with no account prompt; account creation is offered after the tutorial.
- **Main menu** has four options after first-run:
  - Continue Single-Player (Mode A)
  - Join Shard (Mode B)
  - Join Campaign (Mode C, as PC)
  - Host Campaign (Mode C, as GM)
- **Mode A and Mode C work offline** for solo / LAN play. Mode C "Host Campaign — LAN only" is the offline variant; cross-internet campaigns require account login.
- **Mode B requires login.** Order/Chaos selection happens at the shard pick screen (Doc #35 §2.2).
- **Mode switching between sessions is free.** A player can do Mode A in the morning, Mode B at lunch, Mode C in the evening; their characters are namespace-separated.
- The launcher remembers the **last-played mode** and offers it as the primary CTA on next launch.
- **Accessibility (Doc #34):** the four-option menu is fully keyboard-navigable, screen-reader-tagged, and works without colour cues.

### 10.1 First-run flow (new player)

1. Launcher opens → splash → title screen.
2. "Begin" → Mode A tutorial loads (no account prompt).
3. Tutorial completes → "Create account?" optional prompt.
4. Account-skipped path → main menu shows Mode A and Mode C (LAN) only; Mode B and Mode C (online) require login.
5. Account-created path → all four options unlocked.

### 10.2 Returning player flow

- Launcher reads `last_mode` from local config; sets primary CTA accordingly.
- Mode A: shows "Continue" with most-recent save name.
- Mode B: shows last-played shard with a one-line server status (latency, population).
- Mode C: shows campaign list (active + suspended); GM-hosted campaigns marked.

---

## 11. Cross-Doc Integration

| Doc | Note |
|---|---|
| #13 | Campaign instance entities live in a `campaign_*` scope; verbs gated by membership |
| #16 | `gm.override_resolution` is a privileged combat verb; injected before damage application |
| #17 | NPC schedule runs in campaign instances at reduced cadence; GM may override schedule |
| #21 | `campaign_save` rows are a separate table family from `shard_save`; same DDL shape |
| #22 | Campaign instance is a tick group; pause halts only its scheduler, not the shard's |
| #26 | Dev-run hosted GM sessions and player-run campaigns are RELATED but distinct (see OQ-7) |
| #29 | All GM verbs audit-logged; report-up routes campaign incidents to platform moderation |
| #35 | PvP rules in campaigns are GM-set, not Order/Chaos derived; default is consent-only |
| #36 | Quest skeleton binder is the staging substrate for GM-injected content |
| #37 | LiveKit table channel + GM private sub-channel; recording consent enforced |
| #38 | Campaign saves are in scope for GDPR export; per-participant export on request |
| #41 | Mode C runs in the same Rust server binary; no second server fleet |

The relationship to Doc #26 deserves emphasis: Doc #26 describes **dev-run, narrative-tentpole sessions** hosted by the studio (think live "season" events). Mode C is the **player-run, friend-group campaign** primitive. They share infrastructure (the GM verb set, the campaign instance lifecycle, the save format) but differ in social shape and economic effect: Doc #26 events feed back into the Mode B economy by design; Mode C campaigns do not (§6). A consolidation pass on Doc #26 should add a back-reference to this doc and clarify which sections of Doc #26 inherit from §3–§8 here.

---

## 12. Phasing

- **12-week prototype: Mode A only.** Mode B login is stubbed (queue, shard list, no real shards). Mode C is not implemented in Phase 1; the menu entry is hidden behind a feature flag.
- **Phase 2: Mode B production + Mode C v1.** Mode C v1 estimated at **6–8 engineer-weeks** for the GM verb set, the lifecycle state machine, the campaign save namespace, the GM client UI in TS (UE5 parity follows in Phase 2.5), and the safety tooling.
- **Phase 2.5: UE5 GM client parity** plus voice integration (Doc #37) plus recording-consent flow.
- **Phase 3:** advanced staging tools (custom dialogue trees, custom item authoring) — explicitly out of scope for v1.

### 12.1 Phase 2 Mode C v1 task breakdown (rough)

| Week | Work |
|---|---|
| W1 | Campaign save namespace + `campaign_*` schema migration |
| W2 | Lifecycle state machine + matchmaker hooks |
| W3 | Five GM verbs (server-side) + dispatcher gating |
| W4 | TS GM client UI — staging panel + audit viewer |
| W5 | Safety tooling (X-card, session zero, kick/mute) |
| W6 | LiveKit voice channel topology |
| W7 | Playtest hardening + audit log review |
| W8 | Buffer + telemetry wiring (Doc #28) |

### 12.2 Phase 2.5 add-ons (UE5 parity)

| Item | Estimate |
|---|---|
| UE5 GM staging panel parity | 2 weeks |
| UE5 audit viewer parity | 1 week |
| LiveKit voice integration (UE5) | 1.5 weeks |
| Recording-consent flow + retention plumbing | 1 week |
| Console-input mapping for GM verbs | 1 week |
| Cross-client QA matrix | ongoing |

### 12.3 Phase 1 stub scope

For the 12-week prototype, Mode B is stubbed only deeply enough to validate the wire protocol. The Mode C menu entry is hidden behind `feature_flag.campaign_mode = false`. No `campaign_*` schema migration ships in P1; the feature flag prevents the dispatcher from accepting `gm.*` verbs even if a malicious client tries.

---

## 13. Open Questions

1. **#42-OQ-1 — Max party size.** Spec says 1–6 PCs. Is 6 the right cap? Tabletop convention is 4–5; UO parties were 8. Resolution before Phase 2 kickoff.
2. **#42-OQ-2 — Can GM also be PC?** Some tabletop modes (GM-PC, "DMPC") allow it; many do not. v1 default is no; revisit after first playtest cohort.
3. **#42-OQ-3 — Spectator support.** Should non-PC players watch a campaign read-only? Useful for press demos; risky for harassment. Probably opt-in per-campaign, GM-toggled.
4. **#42-OQ-4 — Inactive campaign retention.** How long does a `SUSPENDED` campaign live before auto-archive? Proposed 90 days; needs GDPR check (Doc #38).
5. **#42-OQ-5 — Can GMs charge for sessions?** External monetization (paid GM-as-a-service) raises platform-policy and tax questions. Default in v1: no in-product payments. Revisit.
6. **#42-OQ-6 — Cross-campaign character porting.** Can a player carry a Mode C character from campaign X into campaign Y? Default no (each campaign is closed); demand may force a yes.
7. **#42-OQ-7 — Relationship to Doc #26 hosted GM sessions.** Doc #26 needs an explicit pointer back here; this doc clarifies that they share infrastructure but differ in economic policy. A consolidation pass on both docs is overdue.
8. **#42-OQ-8 — Discord-link OAuth for invites.** Most tabletop groups already have a Discord. Doing OAuth-based invites would cut friction; doing it badly would create a privacy mess. Feasibility study Phase 2.

### 13.1 OQ priority and target resolution

| OQ | Priority | Target |
|---|---|---|
| OQ-1 (party size) | High | Pre-Phase-2 |
| OQ-2 (GM as PC) | Medium | Post-first-playtest |
| OQ-3 (spectators) | Medium | Phase 2 mid |
| OQ-4 (retention) | High (legal) | Pre-Phase-2 |
| OQ-5 (paid GM) | Low | Phase 3 |
| OQ-6 (char porting) | Low | Phase 3 |
| OQ-7 (Doc #26 reconciliation) | High (doc debt) | Pre-Phase-2 |
| OQ-8 (Discord OAuth) | Medium | Phase 2 mid |

---

## 14. Decision Log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-04 | Initial spec. Three-mode taxonomy locked. Mode C scoped Phase 2. |

### 14.1 Locked decisions

- Three modes (A, B, C) are the closed taxonomy.
- Five GM primitives are the closed verb set for v1.
- Strict isolation between campaigns and persistent shards is non-negotiable.
- One Rust server binary serves all three modes (Doc #41 unchanged).
- Mode C ships in Phase 2; not in the 12-week prototype.

### 14.2 Pending reconciliation

- Doc #26 needs a back-pointer to this doc and a clarification of dev-run vs. player-run sessions.
- Doc #21 schema migration plan must add the `campaign_*` table family in Phase 2 W1.
- Doc #29 audit-log surface needs a `gm.*` filter view.
