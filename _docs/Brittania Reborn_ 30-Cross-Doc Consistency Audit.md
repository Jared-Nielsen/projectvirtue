Document #30: Cross-Doc Consistency Audit
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0
Date: May 2026
Status: Audit findings against the design doc set Docs #1–#26 (plus the 4_1 crafting addendum) as of audit run.

---

## 1. Audit Philosophy

This is a structural audit, not a design review. As the doc set grew from #1–#12 (the original "Prototype Bible") through the technical-spec wave (#13–#19), the OPEN-triage layer (#20), the persistence/network/spatial/onboarding wave (#21–#24), the BLOCK-P1 resolutions (#25), the Doc #26 long-range arcs/GM extension, and now-stub #26-SpriteAnimation, schema names, capability tiers, scope enums, and verb names risk drifting apart across parallel authoring sessions. Doc #20 already ran a first-pass `[OPEN]` resurrection sweep against #13–#19; this audit closes that loop by extending the same discipline to #21–#26 and explicitly enumerating cross-document terminology, schema-name, and verb-name drift. Where two docs both define the same thing, the audit names a canonical version (most recent, most-referenced, OR most schema-rich) and lists the one-line edits needed to converge.

---

## 2. Schema Name Consistency

| Type | Defined in | Referenced in | Drift detected |
|---|---|---|---|
| `Entity` | #13 §1 | #4, #4.1, #15 §3, #16 §2, #17 §10, #18 §11, #19 §6, #21 §3, #22 §5, #23 §3, #24 §11, #26 §3 | None — single canonical source. |
| `EntityId` | #13 §1 (`u64`) | #14, #15, #16, #17, #18, #19, #21, #22, #23, #24, #26 | Doc #21 §15 [OPEN] 3 explicitly flags `BIGSERIAL` (Postgres) vs `EntityId = u64` mismatch and defers the UUID-vs-BIGSERIAL question to Phase 2 — this is *acknowledged drift*, not silent drift. No action required for Phase 1. |
| `PhysicalComponent` | #13 §1.1 | #4, #15 §5.2, #16 §3.2, #22 §5.2, #23 §3.1 (extends `volume_tile_footprint`), #23 §7 (extends `blocks_los`) | **MINOR drift**: #23 extends two new `[A]` fields onto `PhysicalComponent` — `volume_tile_footprint` and `blocks_los` — but #13 §1.1 has not been amended. Canonical source: #13. Recommended edit: add the two extension rows to #13 §1.1 with a cross-link to #23 §3.1/§7. |
| `StateComponent` | #13 §1.2 | #4, #16 §7 (extends 5 new flags), #21 §5.2, #22 §5.2 | **MINOR drift**: #16 §7 amends `StateComponent` with `paralyzed`, `invisible`, `charmed`, `sleeping`, `bleeding`. #13 §1.2 carries only the original BG flag set plus `hp/durability/decay_timer`. The amendment is documented in #16 §7 narrative but never folded back into #13. Canonical source: #16 §7 (most schema-rich). Recommended edit: append the five new state flags to #13 §1.2 with a cross-link. |
| `OwnershipComponent` | #13 §1.3 | #15 §6, #18 §9, #21 §3.3 | None. |
| `ContainerComponent` | #13 §1.4 | #15 §5, #18 §11 | None. |
| `ScheduleComponent` | #13 §1.5 (placeholder) → fully replaced by `Schedule` in #17 §6 | #4 §5, #15, #16 §9, #17, #21 §3, #23 §10, #26 §8 | **MINOR drift, already self-flagged**: #17 §6 says outright "Replaces the placeholder `ScheduleComponent` from Doc #13 §1.5 with the full normative form" — `ScheduleSlot` activity enum, `Schedule` (vs `ScheduleComponent`) name. Canonical source: #17 §6. Recommended edit: replace the body of #13 §1.5 with a stub that points to #17 §6 (or import #17 §6's schema verbatim into #13 §1.5). |
| `ScriptHookComponent` | #13 §1.6 | #4, #7, #18 §11, #19 §1 §5 §6 | None — sandbox levels resolved per #19 §5. |
| `VirtueWeightsComponent` | #13 §1.7 | #5, #17 §11, #18 §10 | None. |
| `CombatComponent` | #13 §1.8 | #16 §3.2 (extends `resistances`, `armor_pierce`, `stance`), #21 §3, #22 §5.2 | **MINOR drift**: same shape as `PhysicalComponent`/`StateComponent` — #16 §3.2 amends three new fields; #13 §1.8 not updated. Canonical source: #16 §3.2. Recommended edit: append the three fields to #13 §1.8. |
| `MagicComponent` | #13 §1.9 | #4.1, #15 §5.6, #16 §5.6, #18, #22 §5.2 (replication open question) | None for schema; `enchantments` replication visibility is a #22 §16 OPEN. |
| `PerceptionComponent` | **#25 §T-13-4(a)** (introduced inline as edge-case for blind NPCs) | #25 only | **MAJOR drift — undeclared component**: #25's witness-edge-case section invents a `PerceptionComponent` with `sight_blocked`/`hearing_radius`/`hearing_threshold` fields. No prior doc declares this component. It is referenced as if it exists in #13 §1, but does not. Canonical version: #25 §T-13-4(a) (most schema-rich, only definition). Recommended edit: add `PerceptionComponent` as a new §1.11 component in #13 with the three fields. |
| `Verb` / `VerbId` | #13 §2 | #14 §5, #16 §2 §11, #17 §5 §12, #18 §9 §12, #19 §6, #21, #22 §4, #23 §5 §13, #24 §13, #26 §8 | See §5 below for full verb-registry drift table. |
| `PersistenceScope` enum | #13 §3 (canonical 6) + #21 §13 (`Procedural` sub-tag) | #6 §3, #15, #17 §5.3, #18 §7.3 §11, #19 §11, #21 §3 §9 §13, #22 §15, #24, #26 §3 | See §6 below. |
| `Caller` enum | #13 §4 | #14 §3 (rebuilt server-side), #19 §6 (extends `UGC` payload), #25 §T-13-13 (`MCPCaller`), #26 §8 (extends `GM`) | **MINOR drift**: the canonical `Caller` enum in #13 §4 has 5 variants (`Player`, `UGC`, `MCP`, `AI`, `Sim`). #19 §6 expands `UGC` to carry `sandbox_level` (additive — fine). #26 §8 explicitly adds a 6th variant `GM { session_id, gm_avatar_id }`. #13 §4 has not been amended to reflect either. Canonical source: #26 §8 (most recent, most variants). Recommended edit: import #26's full enum into #13 §4 with `[BR]` tags. |
| `MCPCaller` | #25 §T-13-13 | #14 §3 (referenced by name); not declared anywhere else | None — single source of truth in #25. |
| `Quest` / `Stage` / `QuestStage` | #19 §3 | #17 §2 (`StartQuest`/`UpdateQuest` effects), #21 §3.5, #26 §2 (`stage_quests`) | None. |
| `Arc` | #26 §2 | #26 only | New schema; sole reference. |
| `Recipe` / `RecipeInput` / `ToolSpec` | #18 §2 | #4.1 §6, #25 §T-18-INLINE-119 | None. |
| `DialogueTree` / `Response` / `ScheduleSlot` | #17 §2 §6 | #19 §3.1 (`DialogueNode.tree_ref`), #24 §11 (tutor NPCs), #26 §6 (shared dialogue) | None. |
| `MarketStall` | #18 §8.1 | #21 §3.9 | None. |
| `MoveTask` / `MoveTarget` / `MoveOptions` / `MoveResult` | #23 §5 | #14 §5.11 (formalized by #23) | **MINOR drift, self-flagged**: #14 §5.11 has only an envelope stub; #23 §5 fully formalizes it. Canonical source: #23 §5. Recommended edit: replace the #14 §5.11 stub with a one-line cross-link "see Doc #23 §5 for normative spec." |
| `MoverArchetype` / `TileFootprint` / `TerrainCapSet` | #23 §3 | #23 only | None. |
| `Shop` / `Coin` / `TradeOffer` / `TradeSession` | #18 §7 §6 §9 | #15 §5.5 (`TradeOffer` simpler form), #21 §3.8, #22 §4.2 | **MINOR drift**: #15 §5.5 declares a `TradeOffer` with `from_avatar`/`to_avatar`/`items_offered`/`gold_offered`/`status`. #18 §9.1 declares a *different* `TradeOffer` with only `items` and `gold` (the offer payload), with the parties tracked at the enclosing `TradeSession`. Both names collide. Canonical source: #18 §9.1 (more recent, structurally cleaner — the enclosing session carries identities). Recommended edit: rename #15 §5.5's record to `TradeDialogState` or add a one-line note "supplanted by #18 §9.1 `TradeOffer` + `TradeSession`." |
| `Spell` / `SpellbookComponent` / `SpellEffect` / `ReagentId` | #16 §5 | #15 §5.6 (`MagicComponent.is_reagent`), #21 | None. |
| `ScriptGraph` / `Node`-taxonomy / `ScriptSandboxLevel` | #19 §2 §5 | #26 §2 (reuses `ActionNode`/`ConditionNode`/`PredicateNode`) | None. |
| `GMSession` / `GMAuthority` / `PartyRole` / `PacingState` | #26 §6 §7 | #26 only | None. |
| `Tile` / `TileCoord` / `SubTilePos` / `RegionMetadata` | #23 §2 | #15 §6.4 declares an *unrelated* `RegionMetadata` (always_watched, faction, pvp_allowed, chaos_zone). | **MAJOR drift — name collision**: two distinct `RegionMetadata` records exist. #15 §6.4's RegionMetadata is about gameplay rules (always-watched, PvP, chaos); #23 §2's RegionMetadata is about spatial geometry (width, height, z_floors, tile_size_px). Canonical resolution: merge into a single record under #23 §2 (the more recent and most complete spatial doc) by adding the four #15 §6.4 fields, OR rename one of them. Recommended edit: rename #15 §6.4's record to `RegionRulesMetadata`; add a "see also #23 §2 for spatial fields" cross-link. |

---

## 3. [OPEN] Item Resurrection Check (Second Pass — Docs #21–#26)

Doc #20 ran the first-pass for Docs #13–#19. Doc #25 then closed the seven `BLOCK-P1` items but did not extend the cross-link discipline to #21–#26. This audit closes that loop.

| OPEN ID | Source | Status | Where actually resolved (if anywhere) |
|---|---|---|---|
| #13 §5 item 1 (right-click sub-verb taxonomy) | #13 | **resolved** | #25 §T-13-1 — but #13 §5 still carries the `[OPEN]` token. |
| #13 §5 item 2 (NPC ownership transfer on death) | #13 | **partially resolved** | #15 §3.7 (companion case); #20 §4.1 placeholder for non-companion (300s decay → World). #25 cleanup checklist does not touch this. |
| #13 §5 item 3 (schedule slot granularity) | #13 | **resolved** | #17 §6.1 + #25 §T-13-3 ratification. |
| #13 §5 item 4 (witness model for stealing) | #13 | **resolved** | #15 §6.2 + #25 §T-13-4 ratification + edge cases. |
| #13 §5 item 5 (Virtue opposition coupling) | #13 | **deferred-with-placeholder** | #20 T-13-5 placeholder = 0.0 for Phase 1; not formally resolved. |
| #13 §5 item 6 (Avatar Score formula) | #13 | **deferred** | #20 DEFER-P2 placeholder `mean(virtues)`; no doc resolves. |
| #13 §5 item 7 (cross-shard Virtue reputation) | #13 | **still open** | #15 §1.5 explicitly defers; #21 §15 [OPEN] 3 references but doesn't resolve. |
| #13 §5 item 8 (housing inactivity grace period) | #13 | **still open** | #18 §8.3 defers; #21 §3.6 leaves NULL; #26 §13 references EphemeralPocketRealm policy but not housing. |
| #13 §5 item 9 (crafting recipe representation) | #13 | **resolved** | #18 §2. Cross-link not present in #13. |
| #13 §5 item 10 (container weight/volume cascading) | #13 | **resolved** | #15 §5.2 + #25 §T-13-10. Cross-link not present in #13. |
| #13 §5 item 11 (replication interest set for instanced housing) | #13 | **resolved** | #22 §15. Cross-link not present in #13. |
| #13 §5 item 12 (sandbox levels for ScriptHook) | #13 | **resolved** | #19 §5 (non-spell verbs) + #16 §5 (spells not scriptable in Phase 1). Cross-link not present in #13. |
| #13 §5 item 13 (MCP caller authority) | #13 | **resolved** | #25 §T-13-13. |
| #13 §5 item 14 (combat pause semantics in MP) | #13 | **resolved** | #16 §10. Cross-link not present in #13. |
| #13 §5 item 15 (procedurally-generated entity persistence) | #13 | **resolved** | #21 §13 + #25 §T-13-15. |
| #15 §10 item 1 (gypsy questions) | #15 | **partially resolved** | #25 §T-15-1 ships 3 of 7. |
| #15 §10 items 2,3,4,5,7,8 | #15 | various deferrals; #20 covers all; not raised since. |
| #15 §10 item 6 (starting kit data) | #15 | **resolved** | #25 §T-15-6. |
| #16 §13 items 1–12 | #16 | All triaged in #20 §4.3. None raised in #21–#26. |
| #17 §14 item 3 (pathfinder algorithm) | #17 | **resolved** | #23 §4 (A* + octile heuristic + 5ms cap). #17 §14 not amended. |
| #17 §14 items 1,2,4,5,6,7,8 | #17 | All triaged in #20 §4.4. None raised in #21–#26. |
| #18 §15 items 1–10 | #18 | T-18-1 + T-18-INLINE-119 resolved in #25; remaining items follow #20 triage. |
| #19 §14 items 1–7 | #19 | Phase-2 deferrals per #20. |
| **NEW: #21 §15 items 1–8** | #21 | All open; not resolved by any later doc. Buckets: 1,2,3 (entity-id strategy) Phase-2 engineering; 4,5 (RPO/RTO + KMS) live-ops; 6 (save encryption) Phase-2 design; 7 (pocket-realm grace) — proposed default 5 min in source, ratification still pending; 8 (procedural shard wipe) — live-ops policy. |
| **NEW: #22 §16 items 1–8** | #22 | All open; not resolved by any later doc. Notable: item 7 (friends-list persistence scope) intersects with #15 §3 / #6 §4 — adds latent ambiguity; item 5 (server-side LOD) intersects with #23 §4.5 perf budgets; item 4 (`qa.harness` / `inspect.bulk` capability tier) — see capability-drift §4. |
| **NEW: #23 §15 items 1–8** | #23 | All open; not resolved by any later doc. Item 5 (telekinesis projectile passability) intersects with #16 §6. |
| **NEW: #24 §15 items 1–8** | #24 | All open; #24 §15 item 5 (Avatar's Garden region presence) explicitly defers to #23 (Pathfinding & Spatial Systems) — but #23 does not address it. Stale forward-reference. |
| **NEW: #25 (no §-OPEN block)** | #25 | None — this doc resolves things, doesn't open them. |
| **NEW: #26 §19 items 1–10** | #26 | All open; first introduction. |

**Summary**: of the 15 #13 §5 items, 11 are now resolved somewhere in the doc set (six were already resolved when #20 was written; #25 added five more). Only items 5, 6, 7, 8 remain genuinely unresolved (Virtue coupling, Avatar Score, cross-shard Virtue, housing grace). Of those, items 7 and 8 are explicitly deferred to live-ops by multiple downstream docs — the apparent Phase-1 backlog on #13 is overstated by 9 items. **High-leverage cleanup**: a single editorial pass on #13 §5 closing all 11 cross-links would shrink the apparent #13 backlog from 15 to 4.

---

## 4. Capability Tier Drift

| Capability | Defined in | Referenced in | Drift |
|---|---|---|---|
| `inspect.read` | #14 §3 | #14, #15 §7.2, #16 §11, #17 §12, #18 §12, #19 §12, #21 §14, #22 §9, #23 §13, #24 §13, #26 §17 | None. |
| `avatar.basic` | #14 §3 | #14, #23 §13.1 (heavy use; `move_to`, `path_exists`, `line_of_sight`, `cancel_move`), #25 §T-13-13 | None. |
| `avatar.full` | #14 §3 | All MCP-bearing docs (#14–#26) | None. |
| `avatar.minimal` | **#20 §4.1 (T-13-13 placeholder)** + **#25 §T-13-13** | #20 + #25 only | **MAJOR drift**: `avatar.minimal` is referenced as a Phase 1 capability tier in #25 §T-13-13's authoritative table (between `inspect.read` and `avatar.basic`) but is not declared in #14 §3's original capability table. #14 §3 lists only `inspect.read | avatar.basic | avatar.full | ugc.author`. Canonical version: #25 §T-13-13 (most recent, most schema-rich). Recommended edit: amend #14 §3 to insert `avatar.minimal` between `inspect.read` and `avatar.basic`, mirroring #25's table verbatim. |
| `ugc.author` | #14 §3 | #14, #19 §12, #24 §13, #25 §T-13-13 (explicitly excluded from Phase 1), #26 §17 | None — Phase 1 exclusion noted. |
| `gm.host` | **#26 §7** | #26 only | None — sole source. |
| `gm.grant` | **#26 §6** (`can_grant_virtue` GMAuthority bit; never named as a standalone capability in §17) | #26 only | **MINOR drift**: `gm.grant` appears in only one place (#26 §6 narrative line 291) and is not in #26 §17.3 capability table. Likely an editorial slip — the intent is the `can_grant_virtue` field on `GMAuthority`, not a separate capability. Recommended edit: strike "gm.grant" from #26 §6 prose, or add it as a capability in §17.3. |
| `gm.narrate`, `gm.puppet`, `gm.spawn` | #26 §8 line 364 (in error code text) | #26 only | These are not capabilities but verb names referenced as `gm.<verb>`. **MINOR drift**: nomenclature collision — Doc #26 uses `gm.<verb>` as both audit-log verb prefix AND speaks of capability tiers `gm.host` and `gm.grant`. The reader cannot tell whether `gm.spawn` is a verb or a capability. Recommended edit: split nomenclature — verbs use `verb=gm.<x>` literal in audit logs; capabilities use `capability=gm.<x>`; note which is which in #26 §17.3. |
| `arc.author` | **#26 §7** + **§17.3** | #26 only | None — sole source. |
| `arc.persistence` | **#26 §6 line 258** + **§7.1 line 286** | #26 only | **MAJOR drift**: appears as a property/policy reference (`arc.persistence_policy`) — this is *not* a capability tier, but the inconsistent dotted form makes it look like one. Recommended edit: write as `arc_persistence_policy` (snake_case, like other policy fields) in narrative to avoid capability-tier connotation. |
| `admin.viewer`, `admin.mod`, `admin.gm`, `admin.engineer`, `admin.root` | **never defined** | Mentioned only in the audit prompt; **never appears in any doc.** | **N/A — not in scope yet**. Doc #29 (Moderation & Admin Tools) is in-flight (per project task list) but no draft exists in the repo. |
| `community.mod` | **never defined** | Not in any doc. | Same — pending Doc #29. |
| `telemetry.read`, `telemetry.admin` | **never defined** | Not in any doc. | Same — pending Doc #28 (Telemetry, Analytics & Live Ops). |
| `liveops.schedule` | **never defined** | Not in any doc. | Same — pending Doc #28. |
| `qa.harness` | **#22 §16 [OPEN] item 4** + #22 §17 narrative | #22 only | **MAJOR drift — proposed but undefined**: Doc #22 introduces `qa.harness` and a sibling `inspect.bulk` as a *proposed* capability for elevated-bulk-read tooling clients, but the proposal is unbound — no allowed-tools list, no rate-limit tier, no sample resource grants. Canonical resolution path: this is open. Recommended edit: either (a) add a one-line "[OPEN]: full schema deferred to Doc #28 telemetry doc" tag, or (b) add a placeholder row to #14 §3 / #25 §T-13-13 capability table marked "unimplemented." |
| `inspect.designer` | #21 §14.1 (one-off; backs `replication_log` resource) | #21 only | **MAJOR drift — undeclared tier**: appears once in #21 §14.1, never declared in #14 §3 or #25 §T-13-13. Same pattern as `qa.harness`. Recommended edit: amend #14 §3 / #25 §T-13-13 capability table with a `inspect.designer` row OR rename to `inspect.read + designer-flag` to align with #24 §13's `session.designer = true` model. |
| `inspect.admin` | #21 §14.1 (one-off; backs `migration_history` and `snapshots` resources) | #21 only | **MAJOR drift — same pattern as `inspect.designer`**. Recommended edit: same as above; add to canonical table. |
| `session.designer` flag | #24 §13.2 (`complete_tutorial_for_testing` gate) | #24 only | **MINOR drift**: orthogonal mechanism vs. `inspect.designer` capability — two parallel systems for the same idea (designer/QA elevation). Canonical resolution: pick one. Recommended edit: align on either capability-based (`inspect.designer`, etc.) or flag-based (`session.designer = true`) and rewrite the other. |

---

## 5. Verb Registry Drift

Cross-checked against Doc #13 §2 canonical verb registry (which contains: `examine`, `use`, `drag`, `drop`, `combine`, `right_click`, `attack`, `cast_spell`, `throw`, `talk`, `trade`, `steal`, `lockpick`, `ignite`, `extinguish`, `meditate`, `donate`, `sleep`, `place`, `script_invoke`).

| Verb | Declared in #13 §2? | Referenced as MCP tool / verb in | Drift |
|---|---|---|---|
| `examine` | yes | #14, #24 | OK |
| `use` | yes | #14, #18 §2.1 (matcher), #24 | OK |
| `drag` | yes | #14, #15, #18, #21 §13.3 | OK |
| `drop` | yes | #14 | OK |
| `combine` | yes | #14, #18 §2.1 | OK |
| `right_click` | yes | #14, #25 | OK |
| `attack` | yes | #14, #16 §2.1 (full schema), #22 | OK |
| `cast_spell` | yes | #14, #16 §2.2 (full schema) | OK |
| `throw` | yes | #14, #16 §2.3 | OK |
| `talk` | yes | #17 §5 (full schema) | OK |
| `trade` | yes | #18 §9 | OK |
| `steal` | yes (implicit-via-drag note) | #15 §6.2, #25 §T-13-4 | OK |
| `lockpick`, `ignite`, `extinguish`, `meditate`, `donate`, `sleep`, `place`, `script_invoke` | yes | scattered | OK |
| `move_to` | **no** in #13 §2; declared in #14 §5.11 (envelope stub), formalized in #23 §5 | #14, #17 §7.1 (`activity_to_verb` returns `move_to`), #22 §4.2, #23, #26 | **MAJOR drift**: `move_to` is invoked in MCP (#14 §5.11), in scheduling (#17 §7.1), and in pathfinding (#23) but is NOT in #13 §2's verb table. Canonical source: #23 §5 (most schema-rich). Recommended edit: add `move_to` row to #13 §2 with reads/writes/Virtue columns + cross-link to #23 §5. |
| `defend`, `flee` | **no** in #13 §2; introduced in #16 §2.4 §2.5 | #16, #22 | **MAJOR drift**: combat verbs `defend` and `flee` introduced in #16 are referenced as MCP tools in #16 §11 and as combat-AI dispatcher targets in #16 §4 but not registered in #13 §2. Canonical source: #16 §2.4 §2.5. Recommended edit: add both verbs to #13 §2 verb table. |
| `say_keyword`, `end_dialogue` | no in #13 §2; declared in #17 §12 as MCP tools | #17 | **MINOR drift**: `say_keyword` and `end_dialogue` are MCP-only tool wrappers around the `talk` session — they don't have their own dispatcher resolution and probably shouldn't appear in #13 §2 (which is about world-affecting verbs). Acceptable as-is, but should be documented as "MCP session-management wrappers, not first-class dispatcher verbs" in #17 §12. |
| `equip`, `give`, `set_combat_mode`, `bribe` | no in #13 §2; declared in #15 §7.1 as MCP tools | #15 | **MINOR drift**: same pattern. `equip`/`give`/`set_combat_mode`/`bribe` are added to MCP surface in #15 §7.1; the underlying dispatcher verbs are typically wrappers (`equip` ≈ `drag` to slot; `give` ≈ `trade` with auto-accept; `bribe` is its own primitive in #15 §6.5). #13 §2 registry doesn't list them. Recommended: add `bribe` (a true new verb) to #13 §2; document `equip`/`give`/`set_combat_mode` as wrappers in their respective MCP sections. |
| `learn_spell`, `set_flee_threshold` | no in #13 §2; declared in #16 §11 as MCP tools | #16 | Same MCP-wrapper pattern — these decompose to `combine` + flag write. Acceptable but document. |
| `craft`, `buy`, `sell`, `accept_trade`, `reject_trade` | no in #13 §2; declared in #18 §12 as MCP tools | #18 | Same MCP-wrapper pattern over `combine` and `trade`. `buy`/`sell` are arguably first-class verbs against the `Shop` component. Recommended edit: add `buy` and `sell` (as Shop-component primitives) to #13 §2; document `accept_trade`/`reject_trade`/`craft` as wrappers. |
| `compile_script`, `publish_creation`, `playtest_creation` | no in #13 §2; declared in #19 §12 as MCP tools | #19 | These are tool-chain operations on UGC artifacts, not world-affecting verbs. Acceptable. |
| `save_game`, `load_game` | no in #13 §2; declared in #21 §14 as MCP tools | #21 | Wrappers around the `sleep` verb (campfire save) plus client reconnect. Acceptable. |
| `path_exists`, `line_of_sight`, `cancel_move` | no in #13 §2; declared in #23 §13 as MCP tools | #23 | Pure queries (no mutation) — `path_exists`/`line_of_sight` shouldn't be in the verb registry. `cancel_move` is a control-plane op on `MoveTask`. Acceptable. |
| `complete_tutorial_for_testing` | no in #13 §2; declared in #24 §13.2 as MCP tools | #24 | Designer-only QA tool. Acceptable. |
| `arc_create`, `arc_advance_stage`, `arc_complete` | no in #13 §2; declared in #26 §17.1 as MCP tools | #26 | Arc lifecycle ops — not world-affecting in the dispatcher sense. Acceptable. |
| `gm_session_open`, `gm_session_close`, `puppet`, `unpuppet`, `narrate`, `gm_spawn`, `private_handout`, `gather`, `time_skip`, `weather_set`, `grant_virtue`, `set_scene`, `leave_session` | no in #13 §2; declared in #26 §8 + §17.1 | #26 | **MAJOR drift**: 13 new GM verbs all missing from #13 §2 registry. `puppet`, `unpuppet`, `narrate`, `gm_spawn`, `private_handout`, `gather`, `time_skip`, `weather_set`, `grant_virtue`, `set_scene`, `leave_session` actually mutate Entity state and route through `VerbDispatcher` per #26 §8 first paragraph. They belong in the canonical verb table. Canonical source: #26 §8. Recommended edit: append a "GM verbs (added by #26)" sub-table to #13 §2 covering all 11 mutating GM verbs, with cross-link. |
| `list_actions` | no in #13 §2; declared in #14 §5.2 as MCP tool | #14 | Pure read; control-plane for `right_click`. Acceptable as MCP-only. |

---

## 6. Persistence Scope Drift

Canonical 6 scopes (declared in #13 §3 + #6 §3): `WorldState`, `PlayerInventory`, `HousingAndCreations`, `VirtueReputation`, `Economy`, `StoryEvents`. Canonical sub-tag (declared in #21 §13.4): `Procedural` (a sub-tag inside `WorldState` storage, NOT a peer scope).

| Scope name referenced | Referenced in | Drift |
|---|---|---|
| `WorldState` | #13, #6, #15, #16, #17 §5.3, #18, #19 §11, #21, #22, #23, #24, #26 | OK. |
| `PlayerInventory` | #13, #6, #15, #18, #19, #21, #22, #24, #26 | OK. |
| `HousingAndCreations` | #13, #6, #18, #19, #21, #22 §15 | OK. |
| `VirtueReputation` | #13, #6, #15, #19, #21 | OK. |
| `Economy` | #13, #6, #18, #21 | OK. |
| `StoryEvents` | #13, #6, #17 §5.3, #19, #21, #26 | OK. |
| `Procedural` (sub-tag of `WorldState`) | #21 §13, #25 §T-13-15 | OK — explicit "no new top-level scope" rule per #21 §13.4. |
| `Social` (referenced as a hypothetical scope) | #22 §16 [OPEN] item 7 | **MINOR drift — proposed-but-undeclared scope**: #22 §16 item 7 raises whether friends-list should live under `PlayerInventory` or a new `Social` scope. Not yet introduced. Status: open question only. Recommended: keep open, but mark "proposed-only, not in canonical enum." |
| Lowercase / freeform shorthand: `world | player | housing | virtue | economy | story` | #14 §4 invariant 3 + #14 §5 envelope `persistence_scope` field | **MINOR drift**: #14 uses lowercase tokens `world | player | housing | virtue | economy | story` for the wire envelope. #13 §3 uses CamelCase enum names. The intent is presumably "the wire is lowercase, the type is CamelCase" but this is never spelled out. Recommended edit: add a one-line note to #14 §5 envelope spec: "lowercase wire tokens correspond to CamelCase #13 §3 PersistenceScope enum values." |

---

## 7. Cross-Reference Accuracy (sample of 30)

Random sample, target sections inspected by hand:

| Source citation | Claim | Verified? |
|---|---|---|
| #14 §1 cites "#13 Core Schema (Entity/Verb/Scope spec — drafted in parallel; this document treats its model as canonical)" | #13 exists with that scope | ✓ |
| #15 §1 cites "#13 §1.5 (Schedule)" | #13 §1.5 is `ScheduleComponent` placeholder | ✓ (though #17 §6 supplants) |
| #15 §3.7 cites "Resolves Doc #13 §5 [OPEN] item 2" | #13 §5 item 2 is NPC ownership transfer on death | ✓ |
| #16 §2.1 cites "Doc #15 §5.1" for paperdoll | #15 §5.1 is paperdoll | ✓ |
| #16 §5.6 cites "Doc #15 §5.2 cascading rules" | #15 §5.2 is container nesting | ✓ |
| #16 §10 cites "Doc #6 §2 (shard types)" | #6 §2 is shard architecture | ✓ |
| #17 §3.1 cites "Doc #15 §6.2 witness records" | #15 §6.2 is witness model | ✓ |
| #17 §6.1 cites "Resolves Doc #13 §5 [OPEN] item 3" | #13 §5 item 3 is schedule slot granularity | ✓ |
| #17 §10 cites "Doc #15 §3.2 default `true` in BR" for `witness_enabled` | #15 §3.2 declares it | ✓ |
| #18 §2 cites "Doc #4.1 §4" for crafting rule | #4.1 §4 is technical implementation rules | ✓ |
| #18 §6 cites "Doc #15 §5.3 — gold stacks unlimited per container" | #15 §5.3 has the stacking table | ✓ |
| #18 §10 cites "Doc #15 §6.4 (always-watched)" | #15 §6.4 is `RegionMetadata.always_watched` | ✓ |
| #18 §11 cites "Doc #6 §3 (HousingAndCreations + Economy scopes)" | #6 §3 covers both | ✓ |
| #19 §1 cites "Doc #4 §2 simulation, Doc #5 §4 virtues, Doc #6 §3 persistence" | All three exist with the cited content | ✓ |
| #19 §6 cites "Doc #13 §4" verb dispatch | ✓ |
| #19 §8.3 lists canonical NPCs `Lord British, Iolo, Shamino, Spark, Dupre, Jaana, Geoffrey, Julia, Katrina, Sentri, Mariah, Tseramed` | #3 §6 lists "Iolo, Shamino, Dupre, and other classic party members"; full BG roster is implied but #3 is incomplete | ✓ on names but **doc-internal completeness drift**: #3 §6 only names 3 of 12. |
| #21 §3.4 footnote "Doc #15 §4.4 redemption" | #15 §4.4 is "Redemption Path" table | ✓ |
| #21 §13 cites "Doc #20 T-13-15" | T-13-15 exists in #20 §4.1 | ✓ |
| #21 §16 cites "Doc #22 (territory handoff)" | #22 §7 is region handoff | ✓ |
| #22 §3 cites "Doc #16 §4 (combat AI 2 Hz), Doc #17 §7 (schedule 1 Hz)" | Both correct | ✓ |
| #22 §15 cites "Doc #13 §5 item 11" as the OPEN it resolves | ✓ |
| #23 §1 cites "Doc #2 §4.1 (no auto-pathing breaks simulation invariant)" | #2 §4.1 is "no auto-pathing that breaks simulation" | ✓ |
| #23 §4 cites "Doc #17 §14 [OPEN] item 3 (pathfinder algorithm)" | ✓ |
| #23 §13.1 cites "supersedes the ambiguous Doc #14 §5.11 stub" | #14 §5.11 is short stub; #23 formalizes | ✓ |
| #24 §1 cites "Doc #6 §2 ('Beginner / Tutorial Shard')" | #6 §2 lists "Beginner / Tutorial Shard" as instanced starting zones | ✓ — and #24 explicitly clarifies the terminology drift. |
| #24 §15 item 5 defers to "Doc #23" for garden region presence | #23 does not address; **stale forward-reference**. | ✗ — should remain open as a noted gap. |
| #25 §T-13-1 cites "Doc #14 §4 invariant 5" for per-entity right-click | ✓ |
| #25 §T-13-13 cites "Doc #14 §3" capability table | ✓ |
| #26 §6 cites "Doc #6 §2 instanced housing pattern" | ✓ |
| #26 §17.3 declares `arc.author` and `gm.host` capabilities | ✓ but per §4 above, `gm.grant` and `arc.persistence` are loose. |

**Result**: 28 of 30 cross-references accurate; 1 stale forward-reference (#24 → #23 garden), 1 internal-completeness gap (#3 §6 NPC list vs #19 §8.3). No outright wrong section pointers detected in the sample.

---

## 8. Terminology Conflicts

| Term | Conflicting meanings | Severity |
|---|---|---|
| **Avatar** | (a) The player character in the Ultima sense (#1, #2, #5, #15, #24); (b) the same word used adjective-style ("Avatar's Studio" #7 §2; "Avatar's Garden" #24 §4 — both are labels for tools/areas, not characters). | MINOR — context disambiguates; no spec impact. |
| **session** | (a) MCP client session bound to a shard at handshake (#14 §3, #25 §T-13-13); (b) dialogue session opened by `talk` (#17 §5, #22 §10); (c) trade session (#18 §9.1, #22 §10); (d) GM hosted session (#26 §6); (e) play session / "this play session" (informal in #2, #5). | **MAJOR — shared name across five distinct concepts.** Each subsystem disambiguates internally (`SessionId`, `dialogue_session_id`, `trade_session_id`, `GMSessionId`), but cross-doc prose uses bare "session" liberally. Recommended edit: when crossing doc boundaries, always qualify (`dialogue session`, `trade session`, `MCP session`, `GM session`, `play session`). |
| **shard** | (a) Database shard / partition (#21 §1 "PostgreSQL shards"); (b) world server cluster / persistent realm (#6 §2 — Classic, Virtue, Chaos, Beginner shards); (c) implicitly used as a logical world identifier (`shard_id` everywhere). | **MAJOR — same word, two distinct meanings**. The doc set uses (b) overwhelmingly (ShardId is a world-server-cluster identifier), but #21 §1 uses (a) by analogy ("PostgreSQL shards"). Recommended edit: in #21 §1, write "PostgreSQL primary plus Redis" without using the word "shard" for the DB layer; reserve "shard" exclusively for world-server-cluster meaning. |
| **scope** | (a) `PersistenceScope` enum (#13 §3); (b) `ArcScope` enum (#26 §2 — Local/Regional/Shard/CrossShard); (c) Lua sandbox scope (#19 §4); (d) general-prose word ("the scope of this document"). | MINOR — namespaced via type names; prose context disambiguates. |
| **stage** | (a) `QuestStage` (#19 §3); (b) `ArcStage` (#26 §2); (c) `LayerStage` (informal). | MINOR. Both are well-namespaced types. |
| **tier** | (a) Capability tier (#14 §3, #25); (b) sandbox tier (#19 §5 — Restricted/Standard/Trusted/Official); (c) quality tier (#4.1 §3.2 weapon "quality tiers"). | MINOR. |
| **policy** | (a) `CompanionPolicy` (#15 §3.2); (b) `PacingPolicy` (#26 §2); (c) `ArcPersistencePolicy` (#26 §2); (d) `PersistencePolicy` (informal). | MINOR — all suffixed `*Policy` and namespaced. |
| **gate** / **gated** | (a) `VirtueGate` (#17 §2, #19 §3); (b) gate as in moongate (#3 §3); (c) gate as in "the editor is gated behind tutorial completion" (#24 §7). | MINOR — context disambiguates. |
| **flag** | (a) `FlagId` quest/state flag (#17 §2, #19 §2.2, #24 §3.4); (b) feature flag (#21 §3.13 `feature_flags`); (c) Wanted "flag" in justice system (#15 §6.2). | MINOR. |
| **handoff** | (a) Region handoff (#22 §7, network); (b) "private_handout" (#26 §8) — different word but visually similar to readers skimming. | TYPO/COSMETIC. |
| **dispatcher** | Always means `VerbDispatcher` (#13 §4) — no drift. | OK. |
| **reagent** | Always physical inventory item (#16, #4.1, #18) — no drift. | OK. |

---

## 9. Phase 1 Scope Coherence

Cross-checked the Phase 1 subsections in every doc that has one (#11, #14 §8, #15 §8, #16 §12, #17 §13, #18 §13, #19 §13, #21 §12, #22 §14, #23 §14, #24 §14, #26 §18).

| Question | Answer |
|---|---|
| Does #15 Phase 1 (companions: Iolo + Shamino only) align with #17 Phase 1 (15 NPCs, Iolo+Shamino dialogue trees)? | ✓ |
| Does #15 Phase 1 (no MP combat) align with #16 Phase 1 (single-player pause-on-inventory only; MP combat disabled)? | ✓ |
| Does #16 Phase 1 (`AttackNearest` + `Manual` only; no `Flank`/`Protect`/`Flee`) align with #23 Phase 1 (no Flank/Protect/Flee path predicates)? | ✓ |
| Does #17 Phase 1 (no `Pray`/`Patrol`/`Socialize`/`Custom` activities) align with #23 Phase 1 (schedule executes through dispatcher)? | ✓ — the activities not shipped in #17 are simply not exercised. |
| Does #18 Phase 1 (gold-only currency, no copper/silver/platinum) align with #25 §T-18-1 (price table denominated in copper)? | **MINOR drift**: #18 §13 says "Currency: Gold only (single denomination); copper, silver, platinum stacks deferred." But #25 §T-18-1 ships base prices in copper, with a 100:1 ratio assumption. The reconciliation: the price *table* is in copper for representational precision, but Phase 1 *gameplay* surfaces gold only and rounds. This is documented in #25 §T-18-1 ("ships gold only — but the base table is in copper to prevent fractional gold prices"). Recommend a cross-link from #18 §13 to #25 §T-18-1's note. |
| Does #21 Phase 1 (SQLite only, no Postgres, no Redis, no `replication_log`) align with #22 Phase 1 (single region, no real cluster, no Redis)? | ✓ |
| Does #14 Phase 1 (only `examine`, `entity_by_id`, `entities_in_region`, `virtue_readout`, `use`) align with #23 Phase 1 (`move_to` ships)? | **MAJOR drift — capability set widened post-#14**: #14 §8 explicitly says one mutating verb in Phase 1 (chosen as `use`). #23 §14 ships `move_to` in Phase 1 too — necessary for the success metric (Avatar walks to a tile). #25 §T-13-13 reconciles by introducing `avatar.basic` capability (which includes `move_to`) and includes `move_to` in the §14 row's deferred list — but doesn't strike the "one mutating verb" claim from #14 §8. Recommended edit: amend #14 §8 to list `move_to` as a Phase 1 mutating verb alongside `use`, with cross-link to #23 §14 and #25 §T-13-13's table. |
| Does #19 Phase 1 (visual editor only, no Lua, only `OnEnter`/`OnUse` triggers, only `SpawnEntity`/`OpenDialogue`/`GiveItem` actions) align with #24 Phase 1 (UGC editor unlocked but not built per #7 §6)? | ✓ |
| Does #24 Phase 1 (Tutorial Shard deferred; "Nay" greyed) align with #6 §2 (Beginner / Tutorial Shard listed as a shard type)? | **MINOR drift — terminology**: #24 §4.5 explicitly flags "despite Doc #6 §2's name 'Beginner / Tutorial Shard,' this is an instanced private region, not a public shard" and recommends a corrective amendment to #6. Not yet applied. Recommended edit: amend #6 §2 to rename "Beginner / Tutorial Shard" → "Beginner / Tutorial Instance" or add a footnote pointing to #24 §4.5. |
| Does #26 Phase 1 (arcs + GM sessions deferred to Phase 2; only "dispatcher extensibility" required) align with anything? | ✓ — pure forward-compat commitment; no other doc is affected. |

---

## 10. Recommended Cleanup Actions (one-line edits)

Ordered by leverage (top closes the most downstream issues per edit). Each is an exact (doc, section, suggested change) tuple.

1. (**#13**, §5 items 1, 3, 4, 9, 10, 11, 12, 14, 15) — **Replace each `[OPEN]` token with the cross-link the resolution already exists in (#15/#16/#17/#18/#19/#21/#22/#25 per §3 of this audit).** Single editorial pass, ~30 minutes, shrinks #13 §5 apparent open backlog from 15 to 4.
2. (**#14**, §3 capability table) — **Insert a row for `avatar.minimal` between `inspect.read` and `avatar.basic`, mirroring #25 §T-13-13's authoritative table.** Resolves the audit's largest capability-tier drift.
3. (**#13**, §2 verb registry) — **Add rows for `move_to`, `defend`, `flee`, `bribe`, `buy`, `sell`, plus a "GM verbs (per #26 §8)" sub-table for the 11 mutating GM verbs.** Closes the verb-registry drift across 4 docs.
4. (**#13**, §1.1, §1.2, §1.5, §1.8) — **Append: PhysicalComponent.volume_tile_footprint + blocks_los (#23); StateComponent.{paralyzed, invisible, charmed, sleeping, bleeding} (#16 §7); CombatComponent.{resistances, armor_pierce, stance} (#16 §3.2); replace ScheduleComponent placeholder with cross-link to #17 §6.** Closes component-extension drift.
5. (**#13**, §1.11 [new]) — **Add new component `PerceptionComponent` with `sight_blocked: bool, hearing_radius: int, hearing_threshold: int` per #25 §T-13-4(a).** Closes the major undeclared-component drift.
6. (**#13**, §4 Caller enum) — **Import #26 §8's full Caller enum (adds `GM` variant) and #19 §6's UGC sandbox-level extension.** Closes Caller drift.
7. (**#14**, §3) — **Add capability rows for `inspect.designer` and `inspect.admin` per their first appearance in #21 §14.1; cross-link to #25 §T-13-13.** Closes designer/admin tier drift.
8. (**#14**, §5.11 `move_to`) — **Replace stub with one-line: "see Doc #23 §5 for normative spec."** Resolves stub-vs-formal-spec drift.
9. (**#14**, §8) — **Amend Phase 1 in-scope tools to add `move_to` alongside `use`; cross-link to #23 §14 and #25 §T-13-13.** Closes the Phase-1 scope-coherence MAJOR.
10. (**#15**, §6.4) — **Rename `RegionMetadata` to `RegionRulesMetadata` to disambiguate from #23 §2's spatial RegionMetadata; add cross-link.** Closes the name-collision MAJOR.
11. (**#15**, §5.5) — **Rename `TradeOffer` to `TradeDialogState` (or add a one-line note) to disambiguate from #18 §9.1.** Closes the trade-offer name collision.
12. (**#6**, §2) — **Rename "Beginner / Tutorial Shard" → "Beginner / Tutorial Instance"; cross-link to #24 §4.5.** Closes the terminology drift #24 §4.5 explicitly flagged.
13. (**#21**, §1) — **Replace "PostgreSQL shards" wording with "PostgreSQL primary plus Redis" to avoid overloading the word "shard."** Closes the shard MAJOR terminology conflict.
14. (**#26**, §6 + §17.3) — **Strike "gm.grant" or promote it to a §17.3 capability row; rewrite `arc.persistence` → `arc_persistence_policy`.** Closes the GM capability nomenclature drift.
15. (**#22**, §16 item 4) — **Mark `qa.harness` and `inspect.bulk` explicitly as "[OPEN] — capability schema deferred to Doc #28."** Tags the open question.
16. (**#26-SpriteAnimation.md**) — **Delete the empty placeholder file (or rename it `26b-SpriteAnimation.md`); the canonical doc #26 is "Long-range Arcs & Hosted GM Sessions."** Closes the doc-numbering collision.
17. (**#13**, §5 item 2) — **Mark "partially resolved" with cross-links to #15 §3.7 (companion case) AND a note that non-companion case carries the #20 §4.1 placeholder (300s decay → World).** Closes the partial-resolution discoverability gap.
18. (**#3**, §6) — **Expand canonical NPC list to match the 12 names enumerated in #19 §8.3 (Lord British, Iolo, Shamino, Spark, Dupre, Jaana, Geoffrey, Julia, Katrina, Sentri, Mariah, Tseramed).** Closes the lore-completeness gap.
19. (**#24**, §15 item 5) — **Re-mark as "stale forward reference; Doc #23 does not address; remains open."** Removes a misleading defer.
20. (**#18**, §13) — **Add cross-link to #25 §T-18-1 explaining copper-internal/gold-surface currency split.** Closes the currency-coherence MINOR.

---

## 11. Severity Summary Table

| Severity | Definition | Count |
|---|---|---|
| **CRITICAL** — schema name conflict that would break implementation | Two docs declaring incompatible schemas with same name | **0** |
| **MAJOR** — capability/verb undefined-but-used; cross-reference points to wrong section; undeclared component | `PerceptionComponent` undeclared (1); `avatar.minimal` undeclared in #14 (1); `inspect.designer` + `inspect.admin` undeclared in #14 (2); 11 GM verbs missing from #13 §2 (1 collective); `move_to`/`defend`/`flee` missing from #13 §2 (1 collective); `RegionMetadata` name collision (1); `TradeOffer` name collision (1); `qa.harness`/`inspect.bulk` proposed-but-unbound (1); `session` overloaded across 5 concepts (1); `shard` overloaded (DB vs world cluster) (1); `arc.persistence` capability-vs-policy ambiguity (1); Phase-1 `move_to` scope mismatch (#14 vs #23) (1) | **13** |
| **MINOR** — component extensions not folded back; terminology drift; stale [OPEN] markers; partial resolutions | Component extensions on #13 (3 components); ScheduleComponent placeholder vs #17 §6 (1); 11 #13 §5 [OPEN]s already resolved but not cross-linked (counted as one cleanup item); Caller enum drift (1); `gm.grant`/`gm.<verb>` nomenclature (1); `Social` proposed scope (1); lowercase wire vs CamelCase enum tokens (1); `move_to` in #17 vs #13 (1); Phase-1 currency coherence (1); Tutorial Shard naming (1); `session.designer` vs `inspect.designer` mechanism (1); `give`/`equip`/`set_combat_mode`/`learn_spell`/`set_flee_threshold`/`craft`/`accept_trade`/`reject_trade`/`compile_script`/`publish_creation`/`playtest_creation`/`save_game`/`load_game`/`path_exists`/`line_of_sight`/`cancel_move`/`complete_tutorial_for_testing`/`arc_create`/`arc_advance_stage`/`arc_complete` MCP-wrappers not documented as such (1 collective); #3 §6 NPC list incomplete vs #19 §8.3 (1); #24 §15 item 5 stale forward-ref (1) | **17** |
| **TYPO/COSMETIC** — formatting; doc-number collisions; auto-update should fix | Doc 26 number collision (`26-SpriteAnimation.md` empty alongside `26-Long-range Arcs & Hosted GM Sessions.md`) (1); #26 §6 paragraph repeated verbatim (lines 238 and 240 — same text twice) (1); the `nil` placeholder in `data/recipes/phase1.toml` (#25) is not valid TOML and engineering note says so (1, but already self-flagged) | **3** |
| **TOTAL FINDINGS** | | **33** |

---

## 12. Top 5 Highest-Leverage Fixes

These five edits, each one line or one short paragraph, would close the most downstream consistency issues. Verbatim from §10 above for action-readiness.

1. **(#13, §5 items 1, 3, 4, 9, 10, 11, 12, 14, 15)** — Replace each `[OPEN]` token with the cross-link the resolution already exists in (#15/#16/#17/#18/#19/#21/#22/#25 per §3 of this audit). Single editorial pass, ~30 minutes, shrinks #13 §5 apparent open backlog from 15 to 4.

2. **(#14, §3 capability table)** — Insert a row for `avatar.minimal` between `inspect.read` and `avatar.basic`, mirroring #25 §T-13-13's authoritative table. Resolves the audit's largest capability-tier drift; downstream-affects every doc that quotes the capability table.

3. **(#13, §2 verb registry)** — Add rows for `move_to`, `defend`, `flee`, `bribe`, `buy`, `sell`, plus a "GM verbs (per #26 §8)" sub-table for the 11 mutating GM verbs. Closes verb-registry drift across 4 docs (#16, #18, #23, #26) in one edit.

4. **(#13, §1.1 / §1.2 / §1.5 / §1.8 + new §1.11)** — Append PhysicalComponent.volume_tile_footprint + blocks_los (per #23); StateComponent.{paralyzed, invisible, charmed, sleeping, bleeding} (per #16 §7); CombatComponent.{resistances, armor_pierce, stance} (per #16 §3.2); replace ScheduleComponent placeholder with cross-link to #17 §6; add new §1.11 PerceptionComponent (per #25 §T-13-4(a)). Closes 5 schema-extension drifts in one edit.

5. **(#13, §4 Caller enum)** — Import #26 §8's full Caller enum (adds `GM` variant) and ratify #19 §6's UGC sandbox-level extension. Closes Caller-enum drift; everything downstream of the dispatcher (every MCP call, every UGC script, every GM verb) becomes typewise consistent.

---

## 13. Net Verdict

**Net-good shape, with cleanup pending.** The doc set's spine — the dispatcher invariant (#13 §4), the persistence scope enum (#13 §3 + #6 §3), the verb dispatch contract (#14 §4), the Phase 1 success-metric chain across #11/#14/#15/#16/#17/#18/#19/#22/#23/#24 — is internally consistent. Every major specialization (combat #16, dialogue #17, economy #18, persistence #21, network #22, spatial #23, onboarding #24, arcs/GM #26) explicitly cross-references and respects the spine; no doc forks the dispatcher contract or invents a parallel side-channel. The 13 MAJOR findings are all of a kind: later docs extended the schema (PerceptionComponent, GM verbs, capability tiers like `avatar.minimal`/`inspect.designer`/`inspect.admin`/`qa.harness`, MoveTask formalization) but did not fold the extensions back into the canonical sources (#13 §1, #13 §2, #14 §3). None of these are *implementation-blocking* — every extension is locally well-specified — they're *discoverability* hazards: an engineer reading only #13 will miss what #16/#21/#22/#23/#25/#26 added. The 17 MINOR findings are similarly cosmetic: name collisions resolvable by rename, terminology overloads resolvable by qualification, [OPEN] markers resolvable by cross-link.

There are zero CRITICAL findings — no two docs declare incompatible schemas under the same name. The doc set is in net-good shape; one focused editorial pass against the §10 cleanup list (especially items 1–5) would bring it to net-clean.

---

## Wave 5 + ADR Reconciliation Audit (2026-05-04)

This pass audits the doc set against Doc #41 (Engine & Stack ADR) and the recent Wave 5 reconciliation edits. Triggered by Doc #41's hard split between Rust authoritative server (bevy_ecs + Tokio) and UE5/TS as "dumb view" clients, plus its forbidden list (UE5 native replication, GAS, NavMesh, Behavior Trees). Method: targeted greps for forbidden-tech terms, stale serialization formats, and missing #41 cross-refs, plus spot-checks on Docs #11, #20, and #25 (not in the recent edit batch). Scope: docs #1–#41; no doc #42 exists.

### Findings

- **Doc #11 (Prototype Scope & Milestone Roadmap)** — throughout — No reference to Doc #41 and no UE5/MessagePack/GAS hits at all on quick grep. Doc is engine-agnostic enough to survive the ADR; **no fix required**, but a one-line "engine stack per Doc #41" footer would help future readers.
- **Doc #20 (Phase 1 OPEN Triage)** — line 135 — Pathfinder triage row references "Navmesh authoring tooling (Doc #9) parallel work" as a placeholder; Doc #41 §4 forbids UE5 NavMesh for NPCs and Doc #23 §4.6 rejects navmesh for Phase 1. **Fix:** strike the navmesh-tooling parallel-work clause; the resolution is now A* on tile graph per Doc #23, full stop.
- **Doc #20 (Phase 1 OPEN Triage)** — file-level — Lacks a Doc #41 cross-ref; as a triage doc covering technical OPENs it should anchor to the ADR. **Fix:** add a one-line header note "Updated 2026-05-04: technical resolutions defer to Doc #41 (Engine & Stack ADR)."
- **Doc #25 (BLOCK-P1 Resolutions)** — file-level — No Doc #41 reference. As a resolution doc closing technical BLOCK-P1 items, several of which touched netcode/replication/AI, it should pin those resolutions against the ADR. **Fix:** add an ADR-supersession note in the doc header.
- **Doc #22 (Network Protocol & Replication)** — line 454 — Phase 1 server row still reads "UE5 dedicated server binary on a single machine, in-process; no real cluster." Direct contradiction with Doc #41 (UE5 dedicated server forbidden; server is Rust). **Fix:** replace with "Single Rust binary (bevy_ecs + Tokio) on one machine; no cluster."
- **Doc #22 (Network Protocol & Replication)** — line 460 — Phase 1 wire format still listed as "MessagePack" without annotation; superseded by Protobuf per Doc #41 (already noted at §4.5 line 85, but the Phase 1 table row is stale). **Fix:** change to "Protobuf (envelope per Doc #41); MessagePack permitted only on inner high-rate channels per Doc #40."
- **Doc #22 (Network Protocol & Replication)** — line 461 — "Reliable TCP (UE5 default)" — UE5 default is irrelevant now; we run our own TCP/WebSocket transport. **Fix:** drop the "(UE5 default)" parenthetical.
- **Doc #22 (Network Protocol & Replication)** — line 494 — Open Question #2 "MessagePack vs FlatBuffers vs Cap'n Proto" is partially superseded; Protobuf is now canonical for the envelope per Doc #41 §10 #41-OQ-1. **Fix:** narrow OQ#2 to "MessagePack vs FlatBuffers for inner-channel encoding (envelope is Protobuf, see Doc #41 §10 #41-OQ-1)."
- **Doc #27 (Audio System)** — line 322 — `SoundEvent` row claims MessagePack encoding; should align with Doc #41's Protobuf envelope (or be explicitly called out as an inner-channel exception). **Fix:** annotate "MessagePack inner-channel per Doc #40 §wire-encoding; envelope still Protobuf per Doc #41."
- **Doc #27 (Audio System)** — line 315 — "UE5 audio volume" used as authoritative ReverbZone mechanism. UE5 audio volume is fine as a renderer feature, but the ReverbZone *tag* must be server-emitted to keep TS web client parity. **Fix:** add one line: "ReverbZone tag is server-side data per Doc #41; UE5 audio volume is one of two presentation paths (TS web client uses Web Audio convolution)."
- **Doc #9 (Tooling)** — line 41 — Already annotated with the Doc #41 supersession note for dedicated server. **Clean** for the highlighted line; but the doc is titled "Tooling" and recommends UE5-specific tooling (GAS, Behavior Trees, NavMesh authoring) elsewhere. **Fix:** sweep the rest of #9 to confirm those recommendations carry "presentation-only / forbidden for authoritative use" annotations consistent with §41 §4.
- **Doc #40 (Implementation Scaffolding)** — lines 137, 188, 279, 292, 743, 1019 — Multiple residual MessagePack references in ASCII diagrams and the ADR-ledger row 0005 ("MessagePack on the wire, protobuf for handshake — Accepted"). The ledger row is now historically inaccurate post-Doc #41 (envelope is now Protobuf). **Fix:** add ADR-ledger row 0006 superseding 0005 ("Protobuf for envelope per Doc #41; MessagePack retained only on high-rate inner channels"); update diagrams to read "Protobuf envelope / MessagePack inner."
- **Doc #14 (MCP Server Surface)** — Discord references at lines 348–364 and 447 — Consistent with policy: outbound-only, never authoritative, never required, GDPR perimeter exclusion noted via Doc #38 cross-ref. **Clean.**
- **Doc #28 (Telemetry, Analytics & Live Ops)** — lines 228, 230 — Discord link surface treated as community-health metric only; no Discord chat content captured; explicit GDPR perimeter exclusion. **Clean.**
- **Doc #29 (Moderation & Admin Tools)** — lines 16–20 — Guild Discord servers correctly out-of-jurisdiction; reporting-bridge model documented. **Clean.**
- **Doc #38 (Data Export & GDPR Portability)** — lines 196–198 — Discord-side data correctly excluded from GDPR perimeter; only the link record is exported. **Clean.**
- **Doc #37 (Voice Chat)** — §15 (lines 845–942) — Comprehensive Discord interop spec; outbound-biased; never authoritative; GDPR carve-out present. **Clean.**
- **Doc #16 (Combat & Magic Systems)** — header + §2 + §15 — Already annotated 2026-05-04 per Doc #41 (GAS forbidden, Rust-authoritative). **Clean.**
- **Doc #17 (Dialogue & NPC Schedule)** — header + §7 (line 280) — Already annotated 2026-05-04 per Doc #41 (NavMesh and Behavior Trees forbidden, Rust-authoritative AI). One residual at line 617 references "navmesh authoring tooling" as parallel work; duplicate of Doc #20 issue above. **Fix:** strike the navmesh-tooling parallel-work clause.
- **Doc #23 (Pathfinding & Spatial Systems)** — header + §4 + §15 — Already annotated 2026-05-04 per Doc #41 (UE5 NavMesh forbidden); §15 OPEN item 4 leaves navmesh open for Phase 3+ outdoor regions, which is fine. **Clean.**
- **Doc #41 (Engine & Stack ADR)** — full doc — Self-consistent; the canonical reference; appropriately cites itself. **Clean.**
- **Docs without a #41 reference** — Vision/lore docs (#3, #5, #7, #8, #10, #13, #15, #18, #24, #26, #4, #4_1, #33) are legitimately engine-agnostic and need no ADR pointer. Technical/process docs that should add one: #11, #20, #25, #28, #29, #30 (this doc).

### Status Summary (Docs #1–#42)

| Doc # | Status | Note |
|---|---|---|
| #1 (Vision Statement) | clean | Vision-tier; #41 ref present |
| #2 (GDD) | clean | #41 ref present |
| #3 (World Bible) | clean | Lore doc; ADR-ref not needed |
| #4 (Simulation & Interaction) | minor | Engine-agnostic but technical; consider one-line ADR pointer |
| #4_1 (Crafting & Alchemy) | clean | Mechanics-only |
| #5 (Virtues & Morality) | clean | Lore doc |
| #6 (Persistent World) | clean | #41 ref present |
| #7 (UGC Modding) | minor | Touches scripting surface; could use ADR pointer |
| #8 (Procedural Generation) | clean | World-design doc |
| #9 (Tooling) | minor | Has #41 ref at line 41; sweep remaining UE5-tooling recommendations for "presentation-only" annotations |
| #10 (Art & Audio Style) | clean | Style doc |
| #11 (Prototype Scope) | minor | No UE5/MessagePack hits but lacks #41 pointer; add one-line header note |
| #12 (Slide Deck) | clean | #41 ref present |
| #13 (Core Schema) | clean | Schema is engine-agnostic |
| #14 (MCP Server Surface) | clean | #41 + Discord refs all consistent |
| #15 (Character, Party & Inventory) | clean | Mechanics-only |
| #16 (Combat & Magic) | clean | Header annotated 2026-05-04 per #41 |
| #17 (Dialogue & NPC Schedule) | minor | Annotated; line 617 has stale navmesh-tooling parallel-work clause |
| #18 (Economy, Crafting & Trade) | clean | Mechanics-only |
| #19 (Quest & UGC Scripting) | clean | #41 ref present |
| #20 (Phase 1 OPEN Triage) | major | Lacks #41 ref; line 135 has stale navmesh-tooling clause; needs header supersession note |
| #21 (Save Format & Shard DB) | clean | #41 ref present |
| #22 (Network Protocol & Replication) | major | Header reconciled (line 10); but Phase 1 table (lines 454, 460, 461) and OQ#2 (line 494) still reference UE5 dedicated server / unannotated MessagePack |
| #23 (Pathfinding & Spatial) | clean | Header annotated 2026-05-04 per #41 |
| #24 (Onboarding & Tutorial) | clean | Flow doc |
| #25 (BLOCK-P1 Resolutions) | minor | Lacks #41 ref; closes technical BLOCK-P1 items that should anchor to ADR |
| #26 (Long-range Arcs & Hosted GM) | clean | Design doc |
| #27 (Audio System) | minor | Has #41 ref; line 322 SoundEvent still reads "MessagePack-encoded" without inner-channel annotation |
| #28 (Telemetry, Analytics & Live Ops) | minor | Discord refs clean; lacks #41 ref but is a process doc — add ADR pointer |
| #29 (Moderation & Admin Tools) | clean | Discord boundary correct; ADR-ref optional for policy doc |
| #30 (Cross-Doc Consistency Audit) | clean | This doc |
| #31 (Sprite Animation Pipeline) | clean | #41 ref present |
| #32 (Anti-cheat & Security Hardening) | clean | #41 ref present |
| #33 (Localization & i18n) | clean | Process doc; ADR-ref optional |
| #34 (Accessibility Standards) | clean | #41 ref present |
| #35 (PvP Design & Chaos Shard Rules) | clean | #41 ref present |
| #36 (Procedural Quest Skeletons) | clean | #41 ref present |
| #37 (Voice Chat) | clean | §15 Discord interop spec is canonical |
| #38 (Data Export & GDPR Portability) | clean | Discord perimeter correct |
| #39 (Console Certification) | clean | #41 ref present |
| #40 (Implementation Scaffolding) | major | Multiple residual MessagePack diagrams; ADR-ledger row 0005 historically inaccurate post-#41 |
| #41 (Engine & Stack ADR) | clean | Self-consistent canonical reference |
| #42 | N/A | Does not exist |

### Conclusion

The doc set is in **net-good shape** post-Doc #41 reconciliation. The Wave 5 edits successfully updated the headers and §1–§4 of every directly-impacted technical doc (#16, #17, #22, #23, #27, #32, #34, #35) with explicit "per Doc #41" annotations. Three docs carry **major** stale content: #22 Phase 1 deployment table, #40 Implementation Scaffolding ADR-ledger and diagrams, and #20 Phase 1 OPEN Triage. These are mechanical edits, not design rethinks — a single focused editorial pass closes them. Discord interop is consistent across all five touchpoints (#14, #28, #29, #37, #38): outbound-biased, never authoritative, GDPR-perimeter excluded. No two docs declare contradictory architectural commitments; the contradictions that remain are stale-text artifacts of pre-ADR drafts, not live disagreements. After the cleanup pass, the doc set will be **net-clean** against Doc #41.

---

End of Document #30.
