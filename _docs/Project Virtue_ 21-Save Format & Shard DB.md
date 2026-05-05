Document #21: Save Format & Shard Database Schema
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Persistence & Live Ops Lead]
Status: Living Technical Reference — Normative spec for save-file format, shard database schema, migration policy, and rollback protection. Implements Doc #6 §3 persistence rules against the Doc #13 Entity model.

Depends on: #4 Simulation, #6 Persistent World, #9 Tooling, #11 Prototype Scope, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface, #15 Character & Inventory, #19 Quest & UGC Scripting, #20 Phase 1 OPEN Triage.

Resolves: Doc #13 §5 [OPEN] item 15 (procedurally-generated entity persistence scope) — see §13.

> **Updated 2026-05-04 per Doc #41.** Save FORMAT is defined in Rust and is canonical. On console, the actual file write/read goes through UE5's platform save APIs (PSN / Xbox cloud save) — this is a cert requirement, not a design choice.

---

## 1. Persistence Philosophy

Project Virtue supports two storage backends sharing one logical model. The **local save file** (single-file SQLite per Avatar) backs single-player and the Classic Shard's offline mode (Doc #6 §2). The **shard database** (PostgreSQL primary plus Redis hot-cache) backs Virtue, Chaos, and Beginner shards. Both backends round-trip the full Entity component bag from Doc #13 §1 with no information loss; a Classic-shard Avatar may export to a `.fdsave` file and re-import, and (subject to economy reconciliation `[OPEN]`) the reverse. The shard DB is authoritative when an Avatar is bound to a non-Classic shard; the save file is a self-contained snapshot with embedded schema version. There is exactly one entity model, one set of `PersistenceScope` rules (Doc #13 §3), and one verb dispatcher writing into both backends through the same write contract (§9).

---

## 2. Storage Backend Choice

### 2.1 Local Save (single-player + Classic shard)

**SQLite, single file per Avatar, embedded in UE5** via the established `SQLiteCore` plugin.

Rationale:
- ACID transactions match the dispatcher's all-or-nothing write contract (Doc #13 §4, step 5).
- Single-file portability — `.fdsave` is a copy/email/cloud-sync unit. No directory tree to corrupt.
- Migrations are first-class via the same DDL as PostgreSQL (mostly — see §5).
- JSON1 extension provides JSONB-equivalent storage for the component bag.
- Zero server dependencies; offline play works verbatim.

### 2.2 Shard DB (Virtue, Chaos, Beginner shards)

**PostgreSQL 16+ primary** for durable, relational, ACID storage of all `PersistenceScope` rows. **Redis 7+** as hot-cache layer for region-active entities and presence pub/sub.

Rationale (PostgreSQL):
- ACID + streaming replication + point-in-time recovery cover the 30-second rollback requirement (Doc #6 §3, §4) without bespoke engine code.
- `JSONB` columns flex with the Entity component bag (Doc #13 §1), avoiding schema migration on every new component.
- Mature partitioning and indexing handle the 2,000-CCU launch target and 10,000-CCU stretch (Doc #6 §2).
- Logical decoding feeds the `replication_log` (§7) without write-path overhead.

Rationale (Redis):
- Sub-millisecond reads for region-active entities; PostgreSQL is the source of truth, Redis is write-through cache (§10).
- Pub/sub channel for presence and region-handoff events (Doc #22 territory).

### 2.3 Rejected Alternatives

| Option | Reason rejected |
|---|---|
| Pure flat files (JSON / TOML per entity) | No transactional story; corruption on crash; no incremental migration path; no concurrent multi-writer safety. |
| Proprietary binary blob (UE `SaveGame` only) | Not introspectable; opaque to QA, modders, GMs, MCP `inspect.read`; no SQL-level migration; lossless round-trip with shard DB requires re-implementing JSONB encoding by hand. |
| MongoDB / pure document store | No relational integrity for Ownership / Container references; weaker ACID guarantees in clustered config; single-table-bag pattern loses query power compared with PostgreSQL `JSONB` + GIN indexes. |
| Cassandra / wide-column | Tunable consistency wrong for Virtue / inventory writes; eventual consistency would violate the dispatcher contract (Doc #13 §4). |

UE5 `USaveGame` is used **only** for engine-level transient (graphics options, keybinds, last-shard pick). It is not a persistence target for Entity state.

---

## 3. PostgreSQL Schema (DDL)

Tables map one-to-one with `PersistenceScope` values (Doc #13 §3) plus operational tables (`replication_log`, `migration_history`, `shard_metadata`).

### 3.1 World State

```sql
-- world_entities — PersistenceScope.WorldState (Doc #13 §3)
-- Owner key: RegionId. Persists NPC schedules, fires, placed objects.
CREATE TABLE world_entities (
  entity_id            BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  archetype_id         TEXT         NOT NULL,
  region_id            TEXT         NOT NULL,
  position             JSONB        NOT NULL,                    -- {x, y, z, facing}
  components           JSONB        NOT NULL,                    -- full Entity component bag (Doc #13 §1)
  scope                TEXT         NOT NULL DEFAULT 'WorldState',
  scope_owner_key      TEXT         NULL,                        -- RegionId for WorldState; instance_id for Procedural-in-pocket
  procedural_origin    TEXT         NULL,                        -- generator id; NULL for hand-authored
  last_modified_tick   BIGINT       NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_scope CHECK (scope IN ('WorldState', 'Procedural'))
);
CREATE INDEX idx_world_entities_shard_region   ON world_entities (shard_id, region_id);
CREATE INDEX idx_world_entities_archetype       ON world_entities (shard_id, archetype_id);
CREATE INDEX idx_world_entities_components_gin  ON world_entities USING GIN (components jsonb_path_ops);
CREATE INDEX idx_world_entities_modified_tick   ON world_entities (shard_id, last_modified_tick);
```

### 3.2 Player Avatars

```sql
-- player_avatars — PersistenceScope.VirtueReputation (Doc #13 §3, Doc #15 §1.5)
-- Owner key: PlayerId. Global, permanent, cross-shard semantics deferred to Doc #13 §5 [OPEN] 7.
CREATE TABLE player_avatars (
  avatar_id            BIGSERIAL    PRIMARY KEY,
  player_account_id    TEXT         NOT NULL,                     -- external account; one Avatar per shard per account
  shard_id             TEXT         NOT NULL,
  display_name         TEXT         NOT NULL,
  portrait_id          TEXT         NOT NULL,
  gender               TEXT         NOT NULL CHECK (gender IN ('male', 'female')),
  class_skew           TEXT         NOT NULL,                     -- one of the 8 U4 classes (Doc #15 §1.2)
  stats                JSONB        NOT NULL,                     -- Stats record (Doc #15 §2.1)
  level                INT          NOT NULL DEFAULT 1,
  xp                   INT          NOT NULL DEFAULT 0,
  hits                 INT          NOT NULL,
  hits_max             INT          NOT NULL,
  mana                 INT          NOT NULL,
  mana_max             INT          NOT NULL,
  virtues              JSONB        NOT NULL,                     -- {Honesty: int, Compassion: int, ...} 8 keys
  paperdoll            JSONB        NOT NULL,                     -- Partial<Record<EquipSlot, EntityId>> (Doc #15 §5.1)
  current_region       TEXT         NOT NULL,
  current_position     JSONB        NOT NULL,
  last_login_at        TIMESTAMPTZ  NULL,
  last_logout_at       TIMESTAMPTZ  NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_avatar_name_per_shard UNIQUE (shard_id, display_name),
  CONSTRAINT uq_account_per_shard      UNIQUE (shard_id, player_account_id)
);
CREATE INDEX idx_player_avatars_account ON player_avatars (player_account_id);
CREATE INDEX idx_player_avatars_region  ON player_avatars (shard_id, current_region);
```

### 3.3 Player Inventory

```sql
-- player_inventory — PersistenceScope.PlayerInventory (Doc #13 §3, Doc #15 §5)
-- Each row is one entity owned by an Avatar, including paperdoll items, backpack items, and nested container contents.
CREATE TABLE player_inventory (
  entity_id            BIGSERIAL    PRIMARY KEY,
  avatar_id            BIGINT       NOT NULL REFERENCES player_avatars (avatar_id) ON DELETE CASCADE,
  shard_id             TEXT         NOT NULL,
  archetype_id         TEXT         NOT NULL,
  contained_by         BIGINT       NULL,                          -- self-ref for nested containers; NULL = paperdoll-equipped or top-level backpack
  equip_slot           TEXT         NULL,                          -- EquipSlot if equipped on paperdoll; NULL otherwise
  components           JSONB        NOT NULL,                      -- full Entity component bag
  acquired_via         TEXT         NOT NULL,                      -- OwnershipComponent.acquired_via (Doc #13 §1.3)
  bound                BOOLEAN      NOT NULL DEFAULT false,
  stack_count          INT          NOT NULL DEFAULT 1,
  last_modified_tick   BIGINT       NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT fk_contained_by FOREIGN KEY (contained_by) REFERENCES player_inventory (entity_id) ON DELETE CASCADE,
  CONSTRAINT chk_equip_slot CHECK (
    equip_slot IS NULL
    OR equip_slot IN ('head','neck','earrings','torso','cloak','back','belt',
                      'left_hand','right_hand','hands','rings','legs','feet','quiver')
  ),
  CONSTRAINT chk_slot_xor_container CHECK (
    NOT (equip_slot IS NOT NULL AND contained_by IS NOT NULL)
  )
);
CREATE INDEX idx_player_inventory_avatar       ON player_inventory (avatar_id);
CREATE INDEX idx_player_inventory_container    ON player_inventory (contained_by);
CREATE INDEX idx_player_inventory_archetype    ON player_inventory (avatar_id, archetype_id);
CREATE INDEX idx_player_inventory_equipped     ON player_inventory (avatar_id, equip_slot) WHERE equip_slot IS NOT NULL;
```

### 3.4 Virtue Log (audit trail)

```sql
-- player_virtue_log — append-only audit of every VirtueDelta the dispatcher applied
-- Required for redemption-quest UI (Doc #15 §4.4) and Avatar Score archaeology (Doc #5 §3).
CREATE TABLE player_virtue_log (
  log_id               BIGSERIAL    PRIMARY KEY,
  avatar_id            BIGINT       NOT NULL REFERENCES player_avatars (avatar_id) ON DELETE CASCADE,
  shard_id             TEXT         NOT NULL,
  tick                 BIGINT       NOT NULL,
  verb                 TEXT         NOT NULL,                      -- VerbId from Doc #13 §2
  target_entity        BIGINT       NULL,
  target_archetype     TEXT         NULL,
  delta                JSONB        NOT NULL,                      -- VirtueDelta (Doc #13 §1.7)
  witnessed            BOOLEAN      NOT NULL,                      -- per Doc #15 §6.2 witness model
  witness_count        INT          NOT NULL DEFAULT 0,
  region_id            TEXT         NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_virtue_log_avatar_tick   ON player_virtue_log (avatar_id, tick DESC);
CREATE INDEX idx_virtue_log_avatar_verb   ON player_virtue_log (avatar_id, verb);
```

### 3.5 Quest Journal

```sql
-- player_quest_journal — quest progression per Avatar. Single-stage in Phase 1 (Doc #19 §13).
CREATE TABLE player_quest_journal (
  journal_id           BIGSERIAL    PRIMARY KEY,
  avatar_id            BIGINT       NOT NULL REFERENCES player_avatars (avatar_id) ON DELETE CASCADE,
  shard_id             TEXT         NOT NULL,
  quest_id             TEXT         NOT NULL,                      -- archetype-equivalent id
  status               TEXT         NOT NULL CHECK (status IN ('available','active','completed','failed','abandoned')),
  current_stage        INT          NOT NULL DEFAULT 0,
  flags                JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- per-quest progress flags
  rumors_known         JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- [str] (Doc #17 deferred infrastructure)
  started_at           TIMESTAMPTZ  NULL,
  completed_at         TIMESTAMPTZ  NULL,
  CONSTRAINT uq_avatar_quest UNIQUE (avatar_id, quest_id)
);
CREATE INDEX idx_quest_journal_avatar_status ON player_quest_journal (avatar_id, status);
```

### 3.6 Housing & Creations

```sql
-- housing_instances — PersistenceScope.HousingAndCreations (Doc #13 §3)
-- Owner key: PlayerId | GuildId. Per Doc #6 §3, inactivity reset rule still [OPEN] (Doc #13 §5 item 8).
CREATE TABLE housing_instances (
  instance_id          BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  owner_kind           TEXT         NOT NULL CHECK (owner_kind IN ('Player','Guild')),
  owner_key            TEXT         NOT NULL,                       -- avatar_id or guild_id
  region_anchor        TEXT         NOT NULL,                       -- which town/region the housing plot belongs to
  plot_coords          JSONB        NOT NULL,                       -- world plot footprint
  building_blob        JSONB        NOT NULL,                       -- placed entities, walls, floors
  visibility           TEXT         NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','friends','public')),
  last_visit_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_housing_owner ON housing_instances (shard_id, owner_kind, owner_key);
CREATE INDEX idx_housing_region ON housing_instances (shard_id, region_anchor);
```

### 3.7 UGC Creations

```sql
-- ugc_creations — published UGC dungeons, quests, recipes (Doc #7, Doc #19)
-- Carries an INDEPENDENT ugc_schema_version per §6.
CREATE TABLE ugc_creations (
  ugc_id               BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  author_avatar_id     BIGINT       NOT NULL REFERENCES player_avatars (avatar_id),
  ugc_kind             TEXT         NOT NULL CHECK (ugc_kind IN ('dungeon','quest','recipe','dialogue','script')),
  title                TEXT         NOT NULL,
  payload              JSONB        NOT NULL,                       -- Doc #19 visual-node graph or sandboxed Lua
  ugc_schema_version   INT          NOT NULL,                       -- evolves independently of engine schema (§6)
  sandbox_level        TEXT         NOT NULL DEFAULT 'Restricted',  -- Doc #19 §5
  review_state         TEXT         NOT NULL DEFAULT 'pending'
                       CHECK (review_state IN ('pending','approved','rejected','retired')),
  virtue_audit         JSONB        NULL,                            -- review-pipeline output (Doc #18 §15.8 deferred)
  published_at         TIMESTAMPTZ  NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_ugc_author     ON ugc_creations (author_avatar_id);
CREATE INDEX idx_ugc_kind_state ON ugc_creations (shard_id, ugc_kind, review_state);
```

### 3.8 Economy

```sql
-- economy_ledger — PersistenceScope.Economy (Doc #13 §3, Doc #18)
-- Region-keyed scarcity, prices, restock counters. Weekly balancing pass writes here.
CREATE TABLE economy_ledger (
  ledger_id            BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  region_id            TEXT         NOT NULL,
  archetype_id         TEXT         NOT NULL,
  base_price           INT          NOT NULL,                       -- from data/prices/base.toml (Doc #18 §15.1)
  scarcity_mod         REAL         NOT NULL DEFAULT 1.0,
  current_stock        INT          NOT NULL DEFAULT 0,
  last_restock_tick    BIGINT       NOT NULL,
  weekly_balance_seq   INT          NOT NULL DEFAULT 0,
  CONSTRAINT uq_economy_row UNIQUE (shard_id, region_id, archetype_id)
);
CREATE INDEX idx_economy_region ON economy_ledger (shard_id, region_id);
```

### 3.9 Market Stalls

```sql
-- market_stalls — player-driven marketplace (Doc #6 §4, Doc #18 §8)
-- Phase 2 deferred per Doc #18 §13; schema present for forward-compat.
CREATE TABLE market_stalls (
  stall_id             BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  owner_avatar_id      BIGINT       NOT NULL REFERENCES player_avatars (avatar_id) ON DELETE CASCADE,
  region_id            TEXT         NOT NULL,
  position             JSONB        NOT NULL,
  listings             JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- [{entity_id, ask_price, qty, ...}]
  reputation_score     REAL         NOT NULL DEFAULT 0.0,
  last_sale_at         TIMESTAMPTZ  NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_stalls_region ON market_stalls (shard_id, region_id);
CREATE INDEX idx_market_stalls_owner  ON market_stalls (owner_avatar_id);
```

### 3.10 Story Events

```sql
-- story_event_state — PersistenceScope.StoryEvents (Doc #13 §3)
-- Server-wide phased state for Guardian incursions, Virtue trials, etc.
CREATE TABLE story_event_state (
  event_id             TEXT         PRIMARY KEY,                     -- canonical id, e.g. "guardian.incursion.britain.s1"
  shard_id             TEXT         NOT NULL,
  phase                TEXT         NOT NULL,                        -- active phase token
  participants         JSONB        NOT NULL DEFAULT '[]'::jsonb,    -- [avatar_id]
  flags                JSONB        NOT NULL DEFAULT '{}'::jsonb,
  resolved_by          TEXT         NULL CHECK (resolved_by IN (NULL,'community_vote','timeout','gm')),
  started_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ  NULL
);
CREATE INDEX idx_story_event_shard_phase ON story_event_state (shard_id, phase);
```

### 3.11 Replication Log (rollback substrate)

```sql
-- replication_log — append-only record of every committed verb invocation per §7.
-- Backs the 30-second rollback guarantee in Doc #6 §3.
CREATE TABLE replication_log (
  log_id               BIGSERIAL    PRIMARY KEY,
  shard_id             TEXT         NOT NULL,
  tick                 BIGINT       NOT NULL,
  actor_id             BIGINT       NOT NULL,                        -- EntityId of acting player or NPC
  caller_kind          TEXT         NOT NULL,                        -- Caller.kind (Doc #13 §4)
  verb                 TEXT         NOT NULL,                        -- VerbId
  target_id            BIGINT       NULL,
  region_id            TEXT         NOT NULL,
  params               JSONB        NOT NULL,                        -- VerbInvocation.args
  result               JSONB        NOT NULL,                        -- VerbResult envelope
  affected_entities    BIGINT[]     NOT NULL,                        -- for fast rollback diffing
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
)
PARTITION BY RANGE (tick);
CREATE INDEX idx_replog_shard_tick   ON replication_log (shard_id, tick DESC);
CREATE INDEX idx_replog_actor        ON replication_log (actor_id, tick DESC);
CREATE INDEX idx_replog_region_tick  ON replication_log (shard_id, region_id, tick DESC);
```

Partitioning by `tick` range allows trivial drop of partitions older than the retention window (§7).

### 3.12 Migration History

```sql
-- migration_history — applied migration ledger; see §4.
CREATE TABLE migration_history (
  migration_id         TEXT         PRIMARY KEY,                     -- the YYYYMMDDHHmmss_description filename without .sql
  applied_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  applied_by           TEXT         NOT NULL,                        -- 'system' | operator name
  checksum_sha256      TEXT         NOT NULL,                        -- of the migration file body
  duration_ms          INT          NOT NULL,
  success              BOOLEAN      NOT NULL
);
CREATE INDEX idx_migration_applied_at ON migration_history (applied_at);
```

### 3.13 Shard Metadata

```sql
-- shard_metadata — per-shard config and runtime metadata.
CREATE TABLE shard_metadata (
  shard_id             TEXT         PRIMARY KEY,
  shard_kind           TEXT         NOT NULL CHECK (shard_kind IN ('Classic','Virtue','Chaos','Beginner')),
  schema_version       INT          NOT NULL,                        -- engine schema version this shard expects
  engine_version       TEXT         NOT NULL,                        -- semver of last engine to write
  region_list          JSONB        NOT NULL,                        -- [RegionId]
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_snapshot_at     TIMESTAMPTZ  NULL,
  current_tick         BIGINT       NOT NULL DEFAULT 0,
  feature_flags        JSONB        NOT NULL DEFAULT '{}'::jsonb
);
```

---

## 4. Migration Strategy

Migrations are SQL files under `db/migrations/`. **Per the user's project-wide rule, every migration filename carries a date timestamp prefix so files list alphabetically in chronological order.** Format:

```
YYYYMMDDHHmmss_short_snake_case_description.sql
```

Example: `20260518093000_add_market_stalls.sql`.

### 4.1 Rules

1. **Timestamp prefix is mandatory.** A migration file without the `YYYYMMDDHHmmss_` prefix is rejected by the migration runner. This rule is normative and originates in the project's global engineering policy.
2. **Forward-only.** No down-scripts. A bad migration is corrected by a *new* migration with a later timestamp. This makes prod rollback semantics explicit (you can't accidentally re-run a destructive down-script) and matches the append-only `migration_history` table (§3.12).
3. **Idempotent header.** Each migration begins with `BEGIN;` and ends with `COMMIT;`. The runner wraps the file in a savepoint and inserts a `migration_history` row in the same transaction.
4. **Checksum-locked.** The runner records SHA-256 of the file body. If a migration file's content changes after it was applied, deploy fails with `ERR_MIGRATION_TAMPERED`. Fix forward via a new migration.
5. **Schema-version bump.** Migrations that change the engine-readable schema bump `shard_metadata.schema_version` in the same transaction.
6. **PostgreSQL and SQLite parity.** Each migration ships with a `.pg.sql` and a `.sqlite.sql` variant under `db/migrations/postgres/` and `db/migrations/sqlite/` respectively. Both must increment the same logical version. Filenames otherwise identical.
7. **Phase 1 only ships `00000000000000_initial.sql`** — the bootstrap migration containing the full §3 DDL (PostgreSQL) and §5 DDL (SQLite). The all-zero timestamp is the documented sentinel for the bootstrap; every subsequent migration uses real timestamps.

### 4.2 Migration Runner Contract

```ts
runMigrations(backend: "pg" | "sqlite"):
  1. ensure migration_history table exists
  2. list files in db/migrations/<backend>/, sorted alphabetically
  3. for each file:
       a. if migration_history has matching migration_id → verify checksum, skip
       b. else → execute file inside transaction, insert migration_history row
       c. on failure → ROLLBACK, log, abort runner with ERR_MIGRATION_FAILED
  4. emit final shard_metadata.schema_version
```

The migration runner runs at server boot before any verb dispatcher accepts traffic. Single-player clients run the SQLite variant on save-file load.

---

## 5. Local Save File Format

### 5.1 File Naming

```
<avatar_id>_<save_slot>.fdsave
```

`fdsave` = "Forge Data Save". Slot 0 is the auto-save (§8); slots 1–7 are manual campfire saves. `<avatar_id>` is the server-assigned `AvatarId` for shard-bound Avatars or a locally-generated UUID for offline single-player. Files live under `Saved/SaveGames/<account>/`.

### 5.2 SQLite Schema (condensed)

The local schema mirrors PostgreSQL but folds inventory, world state, and procedural entities into a single `entities` table keyed by `scope`:

```sql
-- bootstrap migration: 00000000000000_initial.sqlite.sql
CREATE TABLE metadata (
  key                  TEXT PRIMARY KEY,
  value                TEXT NOT NULL
);
-- seeded rows:
--   schema_version    -> integer as TEXT
--   engine_version    -> semver as TEXT
--   avatar_id         -> bound avatar id (for cross-mode imports)
--   shard_id          -> bound shard id (NULL for pure-offline single-player)
--   shard_kind        -> 'Classic' for offline; the bound shard's kind otherwise
--   save_slot         -> 0..7
--   created_at        -> ISO-8601
--   last_saved_at     -> ISO-8601
--   tick              -> integer as TEXT

CREATE TABLE entities (
  entity_id            INTEGER PRIMARY KEY,
  scope                TEXT    NOT NULL,                              -- PersistenceScope (Doc #13 §3) + 'Procedural'
  scope_owner_key      TEXT    NULL,
  archetype_id         TEXT    NOT NULL,
  region_id            TEXT    NOT NULL,
  contained_by         INTEGER NULL REFERENCES entities (entity_id) ON DELETE CASCADE,
  equip_slot           TEXT    NULL,
  position             TEXT    NOT NULL,                              -- JSON
  components           TEXT    NOT NULL,                              -- JSON (the full Entity component bag, Doc #13 §1)
  last_modified_tick   INTEGER NOT NULL
);
CREATE INDEX idx_entities_scope        ON entities (scope);
CREATE INDEX idx_entities_region       ON entities (region_id);
CREATE INDEX idx_entities_container    ON entities (contained_by);

CREATE TABLE virtue_log (
  log_id               INTEGER PRIMARY KEY,
  tick                 INTEGER NOT NULL,
  verb                 TEXT    NOT NULL,
  delta                TEXT    NOT NULL,                              -- JSON VirtueDelta
  witnessed            INTEGER NOT NULL,
  region_id            TEXT    NOT NULL,
  created_at           TEXT    NOT NULL
);

CREATE TABLE quest_journal (
  quest_id             TEXT    PRIMARY KEY,
  status               TEXT    NOT NULL,
  current_stage        INTEGER NOT NULL DEFAULT 0,
  flags                TEXT    NOT NULL DEFAULT '{}',
  started_at           TEXT    NULL,
  completed_at         TEXT    NULL
);

CREATE TABLE migration_history (
  migration_id         TEXT    PRIMARY KEY,
  applied_at           TEXT    NOT NULL,
  checksum_sha256      TEXT    NOT NULL,
  success              INTEGER NOT NULL
);
```

`replication_log` is **not** present in the SQLite save (single-player has no rollback feature in Phase 1; see §7 and §12). Single-player rollback uses save-slot reload.

### 5.3 Cross-Mode Import

The presence of `metadata.shard_id` plus an `avatar_id` recognized by the shard's `player_avatars` row allows a Classic-shard `.fdsave` to round-trip back to the shard. The reverse — exporting a shard-bound Avatar to `.fdsave` — is supported only for Classic shards in Phase 1; for Virtue/Chaos shards, export is the data-portability-endpoint dump (§11) and is not a re-importable save.

---

## 6. Save Versioning

Every `.fdsave` file's `metadata` table embeds:

```
schema_version  : int      // increments with every breaking schema change
engine_version  : semver   // e.g. "0.4.2"
ugc_schema_version : int   // independent, evolves with Doc #19 visual-node graph format
```

PostgreSQL shards record the same trio in `shard_metadata`. The per-row `ugc_schema_version` on `ugc_creations` allows individual UGC payloads to lag the engine.

### 6.1 Load Behavior

| Save's `schema_version` vs. engine's | Behavior |
|---|---|
| Equal | Load directly. |
| Save older | Run all migrations between `save.schema_version` and engine's, in alphabetical (timestamp) order. Persist new schema_version on next save. |
| Save newer | **Refuse to load**, surface `ERR_SAVE_VERSION_AHEAD` with the engine version required. No partial load, no silent downgrade. |
| `engine_version` major mismatch | Warn; require explicit user confirmation before running migrations across a major boundary. |

UGC payloads carrying `ugc_schema_version` newer than the engine surfaces `ERR_UGC_VERSION_AHEAD` when the world tries to instantiate them; the rest of the save loads, the affected UGC is quarantined.

---

## 7. Continuous Auto-Save & Rollback

Doc #6 §4 mandates continuous auto-save with 30-second rollback protection. The implementation has two layers.

### 7.1 Append-Only Replication Log

Every committed `VerbInvocation` (Doc #13 §4) writes one row to `replication_log` *in the same transaction* as the snapshot tables (`world_entities`, `player_inventory`, etc.). Schema in §3.11.

| Property | Value |
|---|---|
| Write trigger | dispatcher step 5b (Doc #13 §4) |
| Atomicity | Snapshot row writes + log row write commit together |
| Partition cadence | Daily (`replication_log_YYYYMMDD`) |
| Retention | 7 days, then partition drop |
| Indexed for | shard+tick, actor, shard+region+tick |

### 7.2 Snapshot Cadence

| Subject | Cadence | Mechanism |
|---|---|---|
| Snapshot tables (`world_entities`, etc.) | Synchronous on dispatcher commit | Same transaction as `replication_log` write |
| Logical-volume snapshot | Every 5 minutes per shard | PostgreSQL physical replication slot consumer; writes to S3-equivalent object store |
| Snapshot retention | 7 days | Object-store lifecycle policy |
| Streaming replication | Continuous | PostgreSQL hot-standby per §11 |

### 7.3 Rollback

Two strategies, GM-selectable:

1. **Log replay backward.** Walk `replication_log` from current tick back to target tick; for each row, apply inverse of `result.diff` to affected entities. Bounded by 30s window for player-driven rollback (the canonical "I just got disconnected mid-trade" case).
2. **Snapshot restore + forward replay.** Restore most recent 5-minute snapshot earlier than target tick; replay `replication_log` forward until target tick. Used for incident response or larger windows.

Strategy 1 is the default for the 30-second guarantee. Strategy 2 is the GM-only deeper recovery tool.

### 7.4 What Is NOT Rolled Back

- `player_virtue_log`: append-only audit trail; rollback events are themselves auditable as new rows tagged `rollback`.
- `migration_history`: never rewound (forward-only migrations, §4.2).
- `ugc_creations`: separate review-state lifecycle; not subject to verb rollback.

---

## 8. Single-Player "Campfire Save"

Manual save in single-player or private instance, dispatched via the `sleep` verb (Doc #13 §2). The dispatcher checks region eligibility (no campfire saves in a public Virtue-shard town), then writes a full SQLite snapshot to a slot file.

| Property | Value |
|---|---|
| Slots per Avatar | 8 (slot 0 = auto-save; slots 1–7 = manual) |
| Auto-save cadence | Slot 0 overwritten every 30 seconds while the world is unpaused |
| Manual save trigger | `sleep` verb in eligible region OR MCP `save_game` tool (§14) |
| Format | Full SQLite snapshot per §5; not a delta |
| Atomicity | Write to `<id>_<slot>.fdsave.tmp`, fsync, rename over target — never observed half-written |
| Retention | User-managed for slots 1–7; slot 0 always overwritten |

Slots 1–7 may be promoted to a named save (UI-side concept, file rename) without changing the save format.

### 8.1 Platform Save Routing (per Doc #41)

The save FORMAT defined in §5 (SQLite blob, Rust-canonical schema) is identical on every platform; only the *write/read mechanism* varies by platform per the Doc #41 engine boundary:

| Platform | Save write path | Save read path |
|---|---|---|
| PC / Mac / Linux | Rust server (multiplayer) or local Rust binary (single-player) writes the `.fdsave` SQLite file directly to disk via the §8 atomic `tmp + fsync + rename` flow. | Rust opens the SQLite file directly. |
| **PS5** | Rust serializes the save into the canonical `.fdsave` blob (in-memory). UE5 client receives the blob and hands it to PSN's native save API (PlayStation Save Data API) per Doc #39 cert requirements. | UE5 client requests the blob from PSN's save API; passes it back to Rust which opens it as in-memory SQLite. |
| **Xbox** | Same flow as PS5: Rust produces the canonical blob, UE5 client writes via the Xbox Connected Storage / cloud save API per Doc #39. | UE5 fetches the blob from Connected Storage; Rust deserializes. |

This split is a console certification requirement, not a design choice — PS5 and Xbox cert require platform-managed save storage (cloud sync, parental controls, account binding). The Rust-defined format remains canonical and lossless across all three write paths; the UE5 client never inspects, mutates, or re-encodes the blob — it is opaque bytes from the client's perspective ("UE5 client is a dumb view" per Doc #41).

---

## 9. Verb Dispatcher Persistence Write Contract

Formalises the dispatcher contract in Doc #13 §4 step 5b for the persistence layer.

### 9.1 Write Order Within a Single Transaction

Inside `apply_writes()`:

```
BEGIN TRANSACTION
  for each affected entity in effects.diff:
    route to table by PersistenceScope (Doc #13 §3):
      WorldState           -> world_entities
      PlayerInventory      -> player_inventory
      HousingAndCreations  -> housing_instances
      VirtueReputation     -> player_avatars (virtues column) + player_virtue_log
      Economy              -> economy_ledger
      StoryEvents          -> story_event_state
      Procedural           -> world_entities (scope='Procedural')   -- §13
  insert replication_log row
  bump shard_metadata.current_tick
COMMIT
```

### 9.2 Write Batching

| Property | Value |
|---|---|
| Batch window | 100 ms OR 50 dispatcher commits, whichever comes first |
| Batch scope | Per region (region-keyed transactions; cross-region writes split) |
| Backpressure | Dispatcher applies admission control if batch queue > 500 commits |

Sim-tick verbs (`Sim` caller in Doc #13 §4) coalesce more aggressively; player-input verbs commit at the next batch boundary or sooner.

### 9.3 Failure Handling

If `apply_writes` fails (constraint violation, DB unreachable, batch timeout):

1. Transaction `ROLLBACK`.
2. Dispatcher rolls back the verb in-engine: any in-memory component mutations that were staged in step 5a are reverted from the staged diff.
3. Caller receives `ERR_PERSISTENCE` in the `VerbResult` envelope (Doc #14 §5).
4. **Replication does NOT fire.** Step 5c is gated on step 5b success. This guarantees the invariant from Doc #14 §4 ("no MCP can leave inconsistent state") and the equivalent invariant for player-input and AI callers: the server never broadcasts a state delta that wasn't durably persisted.
5. The failed invocation is logged to ops telemetry but does NOT enter `replication_log` (which is post-commit only).

---

## 10. Hot-Cache (Redis) — Multiplayer Only

Single-player skips Redis entirely. Multiplayer shards run Redis between the dispatcher and PostgreSQL for hot reads.

### 10.1 What's Cached

| Key pattern | Value | Source of truth |
|---|---|---|
| `entity:{shard}:{entity_id}` | full Entity component bag (JSON) | `world_entities` / `player_inventory` |
| `region:{shard}:{region_id}:active` | set of active entity IDs | derived from spatial query |
| `avatar:{shard}:{avatar_id}:presence` | `online`/`offline` + last-seen tick | Redis-native, not in PostgreSQL |
| `pubsub: shard:{shard}:region:{region_id}:events` | dispatcher event broadcast | replication channel |

### 10.2 Read Path

1. Read attempts Redis.
2. On miss, read PostgreSQL, populate Redis, return.

### 10.3 Write Path

1. Dispatcher commits to PostgreSQL (per §9).
2. **Write-through**: same dispatcher post-commit hook updates Redis with the new component bag for each affected entity.
3. Eviction: Redis TTL of 1 hour after last access. Subsequent reads return to step 1.

### 10.4 Presence & Region Handoff

Player online/offline transitions write to `avatar:{shard}:{avatar_id}:presence`. Region handoff (player walks from Britain to Yew) publishes a message on the destination region's pubsub channel; the destination simulation node subscribes its interest set accordingly. Doc #22 (Territory & Region Handoff) is the load-bearing reference; this doc commits only the storage shape.

---

## 11. Backup & Recovery

### 11.1 PostgreSQL

| Layer | Mechanism | RPO target | RTO target |
|---|---|---|---|
| Hot standby | Streaming replication, synchronous to one replica | ~0 | < 60 s failover |
| Daily logical dump | `pg_dump --format=custom`, encrypted, retained 30 days | ~24 h | ~30 min restore |
| Point-in-time recovery | WAL archive to object store, retained 7 days | ~5 min | ~1 h restore |

Exact RPO/RTO commitment numbers `[OPEN]` (§15).

### 11.2 Per-Avatar Data Export

GDPR / data-portability endpoint:

```
GET /export/avatar/{avatar_id}    [authenticated as account-holder OR DPA-authorized GM]
```

Returns a `.fdsave`-format SQLite blob containing every row across `player_avatars`, `player_inventory`, `player_virtue_log`, `player_quest_journal`, plus the player's `housing_instances`, `ugc_creations`, and a redacted view of `replication_log` filtered to `actor_id = avatar_id`. Encrypted at rest in transit. Issuance is rate-limited to once per 24 h per Avatar.

### 11.3 Account Deletion

Account deletion cascades through `player_avatars` (FK ON DELETE CASCADE on `player_inventory`, `player_virtue_log`, `player_quest_journal`, `housing_instances`, `market_stalls`, `ugc_creations`). `replication_log` rows are NOT cascade-deleted (audit-trail integrity); instead `actor_id` is rewritten to `0` and `params` redacted in a one-shot migration triggered by the deletion request. SLA: completed within 30 days of request.

---

## 12. Phase 1 Prototype Scope

Per Doc #11 and Doc #20 §5 (Phase 1 critical path).

| Subsystem | In scope (Phase 1) | Deferred |
|---|---|---|
| Storage backend | SQLite local save only | PostgreSQL + Redis (deferred to Phase 2 multiplayer prototype) |
| Save slots | 8 per Avatar, slot 0 = auto-save | UI for naming/promoting saves |
| Auto-save cadence | Every 30 s to slot 0, full SQLite snapshot | Delta-save optimisation |
| Migration framework | Runner + `migration_history` table + `00000000000000_initial.sqlite.sql` | Multi-version migration chain (none yet) |
| `replication_log` | **Not present in Phase 1** (no rollback feature; rollback = reload save) | Full append-only log, snapshot cadence (Phase 2) |
| Versioning | `schema_version`, `engine_version` embedded in metadata; load-side enforcement | UGC payload version quarantine UI |
| Cross-mode import | Single-player only — no shard binding to round-trip yet | Classic-shard ↔ `.fdsave` export/import |
| Backup | Save-file copy via OS file system | PostgreSQL replication, WAL archiving, GDPR export endpoint |

The Phase 1 success metric (Doc #15 §8) — Avatar walks Britain with Iolo and Shamino, equips a sword, drags a torch, steals a loaf — relies on this scope. The dispatcher's persistence write path (§9) ships in Phase 1 against SQLite; the write-batching window is the same; the failure-handling contract (`ERR_PERSISTENCE` rollback) is the same. Switching to PostgreSQL in Phase 2 is a backend swap behind the same dispatcher contract.

---

## 13. Resolves Doc #13 §5 [OPEN] Item 15 — Procedural Entity Persistence

Doc #13 §5 item 15 left the persistence scope of procedurally-generated entities (Doc #8) unresolved. This document closes the question:

### 13.1 Default Rule — Region-Wide Procedural

A procedurally-generated entity defaults to **`PersistenceScope.WorldState`** on the shard in which it spawned, with `world_entities.scope = 'Procedural'` and `world_entities.scope_owner_key = <region_id>`. The `procedural_origin` column records the generator id (e.g. `"cave_of_trials.brigands.v1"`) for debugging and re-roll.

Effect: the entity is durable like any other world entity; it survives server restart; it appears in `replication_log`; it is rolled back by the same machinery as hand-authored content.

### 13.2 Pocket-Realm Rule — Instance-Scoped Procedural

Procedural entities spawned inside a **pocket realm** (e.g. the Phase 1 Cave of Trials per Doc #11 and Doc #20 T-13-15) are scoped to the **instance**, not the parent region:

- `world_entities.scope = 'Procedural'`
- `world_entities.scope_owner_key = <instance_id>` (the housing-instance-equivalent id of the pocket realm)
- On instance unload (no players present + grace period elapsed), all rows with that `scope_owner_key` are deleted in one transaction.
- On instance re-entry, the generator re-rolls and writes new rows.

### 13.3 Drag-Time Scope Promotion

Per Doc #20 T-13-15: the moment a procedural entity is moved into a player's inventory by the `drag` verb, the dispatcher rewrites its persistence row from `world_entities` to `player_inventory` (scope transitions `WorldState`/`Procedural` → `PlayerInventory`). The component bag is preserved verbatim; only routing changes. This guarantees a player who loots a sword from Cave of Trials does not lose it on instance reset.

### 13.4 No New Top-Level Scope

Doc #13 §3's `PersistenceScope` enum is **not** extended. `Procedural` is a sub-tag inside `WorldState` storage, not a peer scope. This keeps the dispatcher's scope-routing switch (Doc #13 §4 step 5b) closed at six values.

---

## 14. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capability sets defined in Doc #14 §3.

### 14.1 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/replication_log?since={tick}` | paged `replication_log` rows newer than `tick` for shard `s` | `inspect.designer` (designer-only; not in default `inspect.read`) |
| `forge://shard/{s}/migration_history` | full `migration_history` table for shard `s` | `inspect.admin` (admin-only) |
| `forge://shard/{s}/snapshots` | list of available snapshot timestamps + RPO window | `inspect.admin` |

### 14.2 New Tools

| Tool | Capability | Envelope Notes | Mutates |
|---|---|---|---|
| `save_game` | `avatar.full`; **single-player or private-instance only** | `slot: int` (0..7); slot 0 reserved for auto-save | Writes a full SQLite snapshot to `<avatar_id>_<slot>.fdsave`. Returns `ERR_INVALID_SHARD` on a public shard. |
| `load_game` | `avatar.full`; **single-player only** | `slot: int` (0..7) | Replaces the running session's state from the save slot. Closes session on success; client must reconnect. Returns `ERR_SAVE_VERSION_AHEAD` per §6.1. |

`save_game` and `load_game` are hard-gated to single-player or private instances at the dispatcher's `validate(inv)` step (Doc #13 §4 step 1). On a public Virtue/Chaos shard the tool is not advertised to the session at all.

---

## 15. Open Questions

1. `[OPEN]` **JSONB schema validation strategy.** Do we (a) keep `components` as opaque JSONB validated only by application code, (b) project a subset of high-traffic fields into typed PostgreSQL columns for index efficiency (e.g. `position` as `geometry`, `owner_kind` as `text`), or (c) use a JSON Schema validator at the DB layer? Affects index design, query performance, and the cost of Doc #13 §1 schema additions.
2. `[OPEN]` **Entity ID collision across UGC + procedural + world content.** PostgreSQL `BIGSERIAL` is shard-monotonic and safe for hand-authored + procedural in one shard. UGC published cross-shard or imported into a fresh shard could collide. Options: (a) UGC entities use a separate ID range (high bits = "UGC"), (b) UGC entities get re-IDed on import, (c) global UUID namespace. Choice TBD.
3. `[OPEN]` **UUID vs BIGSERIAL for `entity_id`.** UUID is portable across shards (eases cross-mode import in §5.3 and the GDPR export in §11.2); BIGSERIAL is smaller (8 vs 16 bytes), faster on join, and matches Doc #13's `EntityId = u64` declaration. Phase 1 ships BIGSERIAL; revisit at Phase 2 multiplayer prototype kickoff.
4. `[OPEN]` **Point-in-time recovery RPO/RTO commitment.** §11.1 lists targets but no SLA. Live-ops needs a number for the launch SLA; depends on hosting choice and budget.
5. `[OPEN]` **Backup encryption keys.** Where do PostgreSQL backup encryption keys live (KMS-managed, HSM-backed, GM-team-rotated)? Affects compliance posture for the GDPR export endpoint (§11.2).
6. `[OPEN]` **Save-file at-rest encryption for `.fdsave`.** Single-player saves currently unencrypted (matches Ultima heritage; saves are user-modifiable). Should shard-bound `.fdsave` exports be encrypted-to-account to discourage cheat-injection on re-import? Decision pending Phase 2 cross-mode import design.
7. `[OPEN]` **Pocket-realm grace period.** §13.2 says "no players present + grace period elapsed" for instance unload, but the grace duration is unspecified. Default proposed: 5 min; ratify with Design.
8. `[OPEN]` **Shard wipe vs. single-Avatar reset semantics for `Procedural` scope.** Doc #6 §3 says only server wipe resets `WorldState`. Procedural sub-scope: does the weekly economy balancing pass (Doc #18) re-roll procedural overworld spawns? Or are procedural overworld spawns durable until next major content drop? Live-ops policy decision.

---

## 16. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #6 §2 (shard types), Doc #13 §1 (Entity model) |
| §2 Backend choice | Doc #6 §2 (UE5 base), Doc #9 (engine selection) |
| §3 PostgreSQL DDL | Doc #6 §3 (persistence table), Doc #13 §3 (PersistenceScope), Doc #15 §1 / §5 (Avatar / Paperdoll), Doc #18 (Economy) |
| §4 Migrations | Project-wide rule from `~/.claude/CLAUDE.md` (timestamp-prefixed migrations) |
| §5 Local save | Doc #13 §1 (Entity), Doc #15 §1 (Avatar identity) |
| §6 Versioning | Doc #19 (UGC payload schema) |
| §7 Auto-save / rollback | Doc #6 §3 (30 s rollback), Doc #6 §4 (continuous auto-save) |
| §8 Campfire save | Doc #13 §2 (`sleep` verb) |
| §9 Dispatcher contract | Doc #13 §4 (verb dispatch invariant), Doc #14 §4 (MCP invariants) |
| §10 Redis | Doc #6 §2 (region partitioning), Doc #22 (territory handoff) |
| §11 Backup / GDPR | Doc #6 §3 (Avatar reset semantics) |
| §12 Phase 1 scope | Doc #11 (roadmap), Doc #20 (OPEN triage) |
| §13 Procedural scope | Doc #13 §5 [OPEN] item 15 (RESOLVED here), Doc #8, Doc #20 T-13-15 |
| §14 MCP additions | Doc #14 §3 (capabilities), §5 (tools), §6 (resources) |

See Doc #41 (Engine & Stack ADR) for the canonical engine/stack decision: Rust owns the save FORMAT and PC/Mac/Linux file I/O; on PS5 and Xbox, UE5 hands the Rust-format blob to the platform's native save API per Doc #39 cert requirements.

---

End of Document #21.
