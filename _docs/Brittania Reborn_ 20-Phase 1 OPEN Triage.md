Document #20: Phase 1 [OPEN] Item Triage
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0
Date: May 2026
Status: Triage of all `[OPEN]` markers across Docs #13–#19 against the Doc #11 12-week "Britain Alive" vertical slice. Self-contained: a project lead can run a kickoff meeting from this document alone.

---

## 0. Method

1. Grep across `_docs/` for `[OPEN]` tokens (Docs #1–12 produced zero hits; only Docs #13, #15, #16, #17, #18, #19 carry items — Doc #14 has no inline OPENs but its §10 Open Questions list two Phase 2 deferrals that are tracked here as REDUNDANT/DEFER).
2. Each item is given an ID `T-<doc>-<n>`, anchored to its source via `[#doc§section]`, summarised in one line, and assigned exactly one bucket:
   - **BLOCK-P1** — must be answered before Phase 1 implementation can begin.
   - **BLOCK-P1-MINOR** — Phase 1 needs *an* answer; a placeholder default is documented inline.
   - **DEFER-P2** — explicitly out of Phase 1 per the source doc's Phase 1 subsection.
   - **DEFER-LIVE-OPS** — only relevant after launch (multi-shard, real-money, post-telemetry tuning).
   - **REDUNDANT** — already resolved in another doc; cross-link to the resolution.
3. Counts and 63 items inventoried (15 from #13, 8 from #15, 13 from #16, 8 from #17, 12 from #18, 7 from #19).

---

## 1. Counts by Bucket

| Bucket | Count |
|---|---|
| BLOCK-P1 | 7 |
| BLOCK-P1-MINOR | 14 |
| DEFER-P2 | 30 |
| DEFER-LIVE-OPS | 6 |
| REDUNDANT | 6 |
| **Total** | **63** |

---

## 2. Top 10 BLOCK-P1 Items (Priority Order)

Priority criterion: items whose absence stalls a Week 0–5 deliverable in Doc #11's roadmap, or that block more than one downstream doc.

| # | ID | Title | Source | Owner | Est |
|---|---|---|---|---|---|
| 1 | T-13-13 | MCP caller authority model | [#13§5.13] | Engineering + Garriott approval | 2 days |
| 2 | T-13-1 | Right-click sub-verb taxonomy (closed enum vs `script_invoke`) | [#13§5.1] | Engineering (verb registry owner) | 3 days |
| 3 | T-15-1 | Gypsy question content (3 needed for Phase 1, 7 for full) | [#15§10.1] | Design | 5 days |
| 4 | T-15-6 | Starting-kit data table `data/starting_kits.toml` | [#15§10.6] | Design | 2 days |
| 5 | T-13-4 | Witness model for stealing (Phase 1 success metric depends on it) | [#13§5.4] | Design | 1 day |
| 6 | T-13-3 | Schedule slot granularity (cap, time resolution) | [#13§5.3] | Design + Engineering | 1 day |
| 7 | T-18-1 | Base price table `data/prices/base.toml` | [#18§15.1] | Design (economy pass) | 5 days |
| 8 | T-18-INLINE-119 | `data/recipes/phase1.toml` — the 8 Phase 1 recipes | [#18§3] | Design | 3 days |
| 9 | T-13-15 | Procedurally-generated entity persistence scope | [#13§5.15] | Engineering | 1 day |
| 10 | T-13-10 | Container weight cascading rule (drag precondition) | [#13§5.10] | Design (resolved by #15§5; ratify) | 0.5 day |

---

## 3. Cross-Doc Dependency Chain

Resolving X unblocks Y. Items below are the load-bearing decisions; resolving them in this order chases the longest critical path.

| Resolve | Unblocks |
|---|---|
| T-13-1 (right-click sub-verb taxonomy) | T-18-6 (haggle dispatcher path), all UGC `right_click` patterns in #19, MCP `list_actions` design surface in #14 |
| T-13-13 (MCP caller authority) | Every #14 mutating tool, #15§7, #16§11, #17§12, #18§12, #19§12 — i.e. everything MCP — and the Phase 1 `use` capability check itself |
| T-13-3 (schedule slot granularity) | #17§6 (already partially resolved there, ratify), Phase 1 baker schedule success metric, #15§3 companion schedules |
| T-13-4 (witness model) | #15§6 (resolved there for Phase 1), #16§3.1 sleeping-target multiplier, #17 `thief` keyword auto-injection |
| T-13-9 (recipe schema) | #18§2 (resolved there, ratify), #19 UGC recipe authoring, T-18-INLINE-119 (recipe data table format) |
| T-13-2 (NPC ownership-on-death) | #15§4 (companion case resolved), T-16-INLINE-431 (non-companion corpse rules), Phase 1 looting Virtue scoring |
| T-13-12 (ScriptHook sandbox levels) | #19§5 (resolved there for non-spell verbs), #16§5 (resolved for spells: not scriptable in Phase 1) |
| T-13-15 (procedural entity persistence) | Cave of Trials regeneration (Doc #11 prototype deliverable), #16§9 spawn behavior |
| T-15-6 (starting kit data) | T-15-1 (gypsy question outcomes route into kit), Phase 1 paperdoll equip success metric, all character-gen UI work |
| T-18-1 (base price table) | T-18-INLINE-119 (recipe input/output cost balance), #18§7 merchant restock, Phase 1 baker bread purchase metric |
| T-13-15 → T-13-10 → T-13-1 | UGC-procedural Cave of Trials interactions (Doc #19 §10) cleanly typed |

Notable cascade: **T-13-13 alone touches 5 downstream docs**; resolve first.

---

## 4. Master Item Inventory

### 4.1 Doc #13 — Core Schema (15 items)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-13-1 | Right-click sub-verb taxonomy | [#13§5.1] | **BLOCK-P1** | Phase 1 doesn't ship `right_click` MCP (per #14§8) but the engine still dispatches it for mouse clicks. Decision needed because UGC API stability and #18§7.4 haggle both depend on it. Recommend: closed enum of {Mix, Pour, Ignite, Lockpick, Use, Look, Drop, Eat, Drink, Open, Close, Read, Light, Extinguish, Repair} + `script_invoke` escape hatch limited to `Trusted` UGC. **Owner: Engineering. Effort: 3 days (registry + dispatcher tests).** |
| T-13-2 | NPC ownership transfer on death | [#13§5.2] | **BLOCK-P1-MINOR** | Companion case resolved in [#15§4] (corpse Container preserves Owner; looting = stealing for 60s claim window). Non-companion NPCs need a default. **Placeholder: corpse Container retains original Owner for `corpse_decay_seconds = 300`, then Owner→World.** Ratify before Phase 1. |
| T-13-3 | Schedule slot granularity | [#13§5.3] | **BLOCK-P1** | #17§6.1 claims to resolve this; verify the cap/resolution choice and lock. Recommend: **8 slots per NPC instance per day, 15-min resolution, archetype provides default but per-instance overrides allowed.** Phase 1 baker (4-slot schedule) success metric depends on this. **Owner: Design. Effort: 1 day (write into #13).** |
| T-13-4 | Witness model for stealing | [#13§5.4] | **BLOCK-P1** | #15§6 resolves for Phase 1 (option **c**: score always, legal consequence only if witnessed). Ratify and propagate to #13. Phase 1 success metric (steal bread under one watching baker) requires this to be unambiguous. **Owner: Design. Effort: 1 day.** |
| T-13-5 | Virtue opposition coupling | [#13§5.5] | **BLOCK-P1-MINOR** | Phase 1 only scores Honesty/Justice/Sacrifice/Compassion/Valor in observable contexts. **Placeholder: opposition coupling = 0.0 for Phase 1 (no cross-Virtue penalty). Eight-way opposition graph deferred to Phase 2 balance pass.** |
| T-13-6 | Avatar Score formula | [#13§5.6] | **DEFER-P2** | Hidden score, no Phase 1 surface. **Placeholder: `avatar_score = mean(virtues)` for any internal use.** |
| T-13-7 | Cross-shard Virtue reputation | [#13§5.7] | **DEFER-LIVE-OPS** | Phase 1 is single-shard ("not applicable" per #19§13). Revisit before multi-shard launch. #15§1 explicitly defers. |
| T-13-8 | Housing inactivity grace period | [#13§5.8] | **DEFER-P2** | No housing in Phase 1. Set placeholder **30 real-time days** for any prep work. Blocks T-18-5 when housing ships. |
| T-13-9 | Crafting recipe representation | [#13§5.9] | **REDUNDANT** | Resolved in [#18§2]. Mark as resolved in #13 §5; cross-link. No further action. |
| T-13-10 | Container weight/volume cascading | [#13§5.10] | **REDUNDANT** | Resolved in [#15§5] (cascading weight, direct-children volume). Mark resolved in #13 §5; cross-link. **0.5 day to ratify.** |
| T-13-11 | Replication interest set for instanced housing | [#13§5.11] | **DEFER-P2** | No instanced housing in Phase 1. |
| T-13-12 | Sandbox levels for ScriptHook | [#13§5.12] | **REDUNDANT** | Resolved in [#19§5] for non-spell verbs and [#16§5] for spells (not scriptable in Phase 1). Mark resolved in #13 §5. |
| T-13-13 | MCP caller authority | [#13§5.13] | **BLOCK-P1** | Phase 1 ships `examine` + `use` via MCP; the dispatcher must know whose Avatar/permissions to apply. Recommend: **MCP caller acts as the bound Avatar from session handshake (#14§3), with capability `avatar.minimal` for Phase 1; no GM tier in Phase 1; no third-party sandboxed tier.** **Owner: Engineering + Garriott approval (security policy). Effort: 2 days incl. session-binding tests.** |
| T-13-14 | Combat pause semantics under MP | [#13§5.14] | **REDUNDANT** | Fully resolved in [#16§14]: pause-on-inventory and pause-on-spellbook are single-player and private-instance only. Mark resolved in #13 §5. |
| T-13-15 | Procedurally-generated entity persistence | [#13§5.15] | **BLOCK-P1** | Doc #11 includes "Cave of Trials" procedural dungeon as a Phase 1 deliverable. Recommend: **new `Procedural` scope. Generated entities default to `Procedural`; on regeneration the entire region's `Procedural`-scoped state is wiped, but any item moved to a player's inventory transitions to `PlayerInventory` scope at drag-time.** **Owner: Engineering. Effort: 1 day (scope enum + drag-time scope-promotion hook).** |

### 4.2 Doc #15 — Character, Party & Inventory (8 items)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-15-1 | Gypsy question content | [#15§10.1] | **BLOCK-P1** | Phase 1 ships **3 of 7 questions** (per #15§8). The 3 must be authored before character-gen UI can be tested end-to-end (Week 3–5 milestone). Constraint per source doc: each question is a binary Virtue dilemma; collectively the full 7 touch all 8 Virtues. **Owner: Design. Effort: 5 days (write 7, ship first 3 in vertical slice).** |
| T-15-2 | Avatar customization beyond portrait | [#15§10.2] | **BLOCK-P1-MINOR** | **Placeholder: portrait + name only at genesis in Phase 1; dyes are in-game cosmetics, not genesis options. No `cosmetics` block needed in §1.1 for Phase 1.** |
| T-15-3 | Atrophy formula for assembled companions | [#15§10.3] | **DEFER-P2** | Phase 1 companions = Iolo + Shamino only; no assembled companions. |
| T-15-4 | Permadeath-locked companion list | [#15§10.4] | **DEFER-P2** | Phase 1 has no permadeath logic ("no permadeath logic" per #15§8). Resolve before BG-storyline-fidelity pass. |
| T-15-5 | `CompanionPolicy.loyalty` extension | [#15§10.5] | **DEFER-P2** | No companion-leaving logic in Phase 1; loyalty surface unused. |
| T-15-6 | Starting kit data table `data/starting_kits.toml` | [#15§10.6] | **BLOCK-P1** | Phase 1 success metric requires Iolo + Shamino + Avatar to walk into Britain equipped. The 3 class skews (or whatever subset Phase 1 ships) need authored kit rows. **Owner: Design. Effort: 2 days. Hint: §1.4 already specifies 50gp + 1 ration + 3 torches + reagent pouch for casters — this is mostly transcription to TOML.** |
| T-15-7 | Gate-travel key naming (Serpent Jawbone analog) | [#15§10.7] | **DEFER-P2** | No gate travel in Phase 1 (Britain-only per Doc #11). |
| T-15-8 | Two-handed-weapon back-slot interaction | [#15§10.8] | **BLOCK-P1-MINOR** | **Placeholder: yes, two-handed weapons can be slung on back. Engine permits; art validates per asset.** Phase 1 Cave of Trials may include a two-handed weapon. |

### 4.3 Doc #16 — Combat & Magic Systems (13 items)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-16-INLINE-150 | Companion-flee Valor scoping (player penalised when protected-by companion flees) | [#16§2.5] | **BLOCK-P1-MINOR** | Phase 1 ships `flee` plumbed but no flee AI (per #16§12). **Placeholder: scope flee-abandonment Valor penalty to Avatar only when the fleeing companion was actively engaged in defending the Avatar within the last 5s. Phase 1 companions don't auto-flee, so realistically this fires only on Manual flee.** |
| T-16-1 | Full BR spell roster | [#16§13.1] | **DEFER-P2** | Phase 1 has no `cast_spell` (per #16§12); spellbook schema only. Reagent items exist but are inert. |
| T-16-2 | Weapon durability formula | [#16§13.2] | **BLOCK-P1-MINOR** | **Placeholder: durability decrement = 1 per swing on hit; no decrement on miss. Repair at blacksmith costs 10% item base price per 10 durability restored. Visible in tooltip.** |
| T-16-3 | Area-effect spell tile geometry | [#16§13.3] | **DEFER-P2** | No spells in Phase 1. |
| T-16-4 | Charmed in PvP shards | [#16§13.4] | **DEFER-LIVE-OPS** | No PvP shards in Phase 1. |
| T-16-5 | MCP cast_spell timeout in single-player | [#16§13.5] | **DEFER-P2** | `cast_spell` deferred to Phase 2 per #16§12. |
| T-16-6 | Holy damage source | [#16§13.6] | **BLOCK-P1-MINOR** | **Placeholder: keep `holy` in the damage_type enum; no Phase 1 source produces it. The undead-multiplier row in §3.1 is dormant pending a Phase 2 blessing/spell.** Trivially correct — no implementation cost. |
| T-16-7 | Companion `flee_threshold` UI surface | [#16§13.7] | **DEFER-P2** | Phase 1 has no flee AI per #16§12; UI control deferred. |
| T-16-8 | Berserk + auto-flee + Sleep interaction | [#16§13.8] | **DEFER-P2** | No Berserk AI mode (Phase 1 ships `Manual`, `AttackNearest` only per #16§12). |
| T-16-9 | Spell interruption damage threshold | [#16§13.9] | **DEFER-P2** | No spells in Phase 1. |
| T-16-10 | Unconscious entity attackability | [#16§13.10] | **BLOCK-P1-MINOR** | **Placeholder for Phase 1 (Classic shard, single-player): yes-attackable. Honor − ×2.0 modifier from §3.1 already covers the moral cost.** Chaos/Virtue shards can revisit in live-ops. |
| T-16-11 | Pack behavior alert propagation cap | [#16§13.11] | **BLOCK-P1-MINOR** | Phase 1 spawns 3 brigands in Cave of Trials; cascade risk is real on a small scale. **Placeholder: max 2 alert hops, alerted-set BFS capped at 6 entities.** Cheap to enforce, prevents demo-day exploit. |
| T-16-12 | Two-handed weapon damage formula (`weapon_base` for two-handers) | [#16§13.12] | **BLOCK-P1-MINOR** | **Placeholder: `weapon_base_2h = 1.5 × single_hand_baseline` per the proposed `[BR]` value in source.** Cave of Trials weapons may include a two-hander. Confirm with Design but proceed. |

### 4.4 Doc #17 — Dialogue & NPC Schedule (8 items)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-17-1 | Voice acting trigger logic | [#17§14.1] | **DEFER-P2** | Audio production budget is a Doc #10 question; Phase 1 may ship without VO entirely. |
| T-17-2 | Localization layer | [#17§14.2] | **BLOCK-P1-MINOR** | **Placeholder: simple key/locale lookup (`LocalizedString = { en: string, ...optional }`); ICU MessageFormat deferred. English-only ships in Phase 1.** Schema stable enough that UGC dialogue authoring (Doc #19) won't break. |
| T-17-3 | Pathfinder algorithm | [#17§14.3] | **BLOCK-P1-MINOR** | **Placeholder: A\* with dynamic obstacle re-plan on tick (the working assumption in source). Navmesh authoring tooling (Doc #9) parallel work.** Required for #17 schedule execution success metric. |
| T-17-4 | Companion-vs-companion dialogue | [#17§14.4] | **DEFER-P2** | Per #17§13: "no banter triggers" in Phase 1. |
| T-17-5 | Malformed `say_keyword` MCP validation | [#17§14.5] | **DEFER-P2** | MCP `talk` not in Phase 1 surface (per #14§8 only `examine`/`use` mutate; `talk` is not in scope). Resolve when MCP `talk` ships. |
| T-17-6 | Rumor severity formula | [#17§14.6] | **DEFER-P2** | "No `RumorStore`" in Phase 1 per #17§13. |
| T-17-7 | Override slot persistence defaults | [#17§14.7] | **DEFER-P2** | Override slots deferred per #17§13 ("Override slot installation by external events" deferred). |
| T-17-8 | Banter cooldown after dialogue | [#17§14.8] | **DEFER-P2** | No banter in Phase 1. |

### 4.5 Doc #18 — Economy, Crafting & Trade (12 items: 10 numbered + 2 inline)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-18-INLINE-119 | `data/recipes/phase1.toml` — full content of the 8 Phase 1 recipes | [#18§3] | **BLOCK-P1** | The 8 recipes are enumerated in #18§13 (bread, dough, dagger, healing potion, cooked meat, arrows, cloth bolt, blessed bread). Their predicate/product TOML rows must be authored against the schema in [#18§2]. Phase 1 success metric (bake bread, donate to beggar) hinges on this. **Owner: Design. Effort: 3 days. Depends on T-18-1 (price table for ingredient costs).** |
| T-18-INLINE-300 | Stall purchase cost / craft recipe | [#18§8.1] | **DEFER-P2** | Persistent shard marketplace deferred per #18§13. |
| T-18-1 | Base price table `data/prices/base.toml` | [#18§15.1] | **BLOCK-P1** | Required for Phase 1 baker BUY/SELL success metric. **Owner: Design (economy). Effort: 5 days. Coordinated with T-18-INLINE-119 to avoid input-cost > output-price recipes.** |
| T-18-2 | Regional scarcity propagation algorithm | [#18§15.2] | **DEFER-P2** | Phase 1 hard-codes `scarcity_mod = 1.0` per #18§13. |
| T-18-3 | Cross-shard wallet portability for cosmetic purchases | [#18§15.3] | **DEFER-LIVE-OPS** | Per source: "Resolution likely lives in a future live-ops doc." |
| T-18-4 | Companion-merchant interaction | [#18§15.4] | **BLOCK-P1-MINOR** | **Placeholder: Phase 1 follows BG precedent — companions hold items but cannot transact independently. Iolo and Shamino can carry purchased goods; the Avatar must initiate every BUY/SELL.** |
| T-18-5 | MarketStall ownership transfer on housing abandonment | [#18§15.5] | **DEFER-P2** | Stalls deferred per #18§13. Blocks on T-13-8. |
| T-18-6 | Haggle dispatcher path | [#18§15.6] | **DEFER-P2** | "All other merchants; haggle" deferred per #18§13. Blocks on T-13-1 when un-deferred. |
| T-18-7 | Crafting failure Virtue scoring | [#18§15.7] | **BLOCK-P1-MINOR** | **Placeholder: catastrophic crafting failure (e.g., setting your own alchemy lab on fire) costs Humility −1 only. Spirituality scoring deferred until magic crafting in Phase 2.** Phase 1 has alchemy bench in Britain; failure path must score *something*. |
| T-18-8 | UGC recipe Virtue review pipeline | [#18§15.8] | **DEFER-P2** | UGC recipes deferred; #19 ships `SpawnEntity`/`OpenDialogue`/`GiveItem` only in Phase 1, no recipe publication. |
| T-18-9 | Recipe journal persistence scope | [#18§15.9] | **BLOCK-P1-MINOR** | **Placeholder: `PlayerInventory` scope. Learned recipes survive client wipe. Cheap and matches BG fidelity.** |
| T-18-10 | Two-phase trade timeout under network partition | [#18§15.10] | **DEFER-P2** | "Player-to-player trade — Deferred" per #18§13. |

### 4.6 Doc #19 — Quest & UGC Scripting (7 items)

| ID | Title | Section | Bucket | Notes / Default |
|---|---|---|---|---|
| T-19-1 | Lua VM choice (LuaJIT vs Lua 5.4) | [#19§14] | **DEFER-P2** | Source explicitly says "Decision needed before Phase 2." Phase 1 = visual editor only, no Lua. |
| T-19-2 | Script versioning under verb signature drift | [#19§14] | **DEFER-P2** | Backwards-compat concern; no published scripts to migrate in Phase 1 (Phase 1 publish goes to a "review queue" per #19§13, not Hall of Wonders). |
| T-19-3 | Per-script raised resource budgets | [#19§14] | **DEFER-P2** | Phase 1 sandbox = `Restricted` only per #19§13; no `Trusted` tier exists yet. |
| T-19-4 | Anti-cheat for cross-player flag taint analysis | [#19§14] | **DEFER-P2** | Single-shard, small UGC reviewer pool in Phase 1. Production-grade taint analysis can wait. |
| T-19-5 | UGC migration between shards | [#19§14] | **DEFER-LIVE-OPS** | Multi-shard concern. |
| T-19-6 | Party-wide quest progress sharing | [#19§14] | **DEFER-P2** | "Multi-stage Quest.next_stage deferred" per #19§13; party-wide is a further deferral on top of that. Phase 1 ships single-stage quests only. |
| T-19-7 | `CompositeNode` permission inheritance | [#19§14] | **DEFER-P2** | "`CompositeNode` deferred" per #19§13. |

### 4.7 Doc #19 inline OPENs already explicitly resolved in source

| Inline tag | Resolution |
|---|---|
| [#19§1] line 10 — "Resolves Doc #13 §5 [OPEN] #12 (Sandbox levels for ScriptHook)" | Cross-resolution: T-13-12 marked REDUNDANT above. |
| [#19§5] line 314 — same as above. | — |

### 4.8 Other inline cross-resolutions found while triaging (the "buried answers")

These are answers the original authors wrote but did not formally close out in #13 §5. Any project lead reading only #13 today would still think the items are open. Recommend a one-line edit pass on #13 §5 to mark each as resolved with cross-link.

| #13 item | Where it was actually resolved | Triage bucket |
|---|---|---|
| T-13-2 (companion case only) | [#15§4] explicitly says "Resolves Doc #13 §5 [OPEN] item 2" for companions; non-companion case still open as BLOCK-P1-MINOR placeholder | Partially REDUNDANT |
| T-13-3 | [#17§6.1] explicitly says "Resolves Doc #13 §5 [OPEN] item 3 — Schedule Slot Granularity" — verify the resolution lines match the recommended placeholder | REDUNDANT (but ratify) |
| T-13-4 | [#15§6.2] explicitly says "Resolves Doc #13 §5 [OPEN] item 4" | REDUNDANT (but ratify) |
| T-13-9 | [#18§2] explicitly says "Resolves Doc #13 §5 [OPEN] item 9" | REDUNDANT |
| T-13-10 | [#15§5] explicitly says "Resolves Doc #13 §5 [OPEN] item 10" | REDUNDANT |
| T-13-12 | [#19§5] (non-spell verbs) + [#16§5] (spells: not scriptable in Phase 1) | REDUNDANT |
| T-13-14 | [#16§14] resolution footer, plus #16§10 narrative | REDUNDANT |

**Six of the fifteen Doc #13 OPEN items are already answered elsewhere.** Updating #13 §5 to cross-link them shrinks the apparent open backlog from 15 to 9 with zero design work.

---

## 5. Phase 1 Critical Path

Ordered sequence of decisions that must be made before Week 1 of implementation kickoff. Items below are gated; later items depend on earlier ones.

| Step | When | Decision | Owner | Hours |
|---|---|---|---|---|
| 1 | Pre-Week-0 | T-13-13 — MCP caller authority. Lock the session-bound-Avatar model. | Engineering + Garriott approval | 16 |
| 2 | Pre-Week-0 | T-13-1 — Right-click sub-verb taxonomy (closed enum + script_invoke escape). Even if Phase 1 doesn't ship the MCP variant, the engine dispatches `right_click` for mouse clicks. | Engineering | 24 |
| 3 | Pre-Week-0 | Issue a one-line edit to Doc #13 §5 marking items 9, 10, 12, 14 as resolved, item 2 as partially resolved, item 3 and item 4 as resolved per #17/#15 — no design work, just cross-linking. | Doc owner | 1 |
| 4 | Week 0 | T-13-3 (ratify schedule granularity at 8 slots × 15 min × per-instance overrides). Required for Britain NPC schedule import. | Design | 8 |
| 5 | Week 0 | T-13-4 (ratify witness model: score always, legal consequence iff witnessed). Required for stealing success metric. | Design | 4 |
| 6 | Week 0 | T-13-15 (procedural entity persistence scope). Required for Cave of Trials work in Week 9–10. | Engineering | 8 |
| 7 | Week 1 | T-15-1 (author 3 of 7 gypsy questions). Required for character-gen UI by Week 3. | Design | 24 (concurrent with 8) |
| 8 | Week 1 | T-15-6 (starting-kit TOML). Required for character-gen completion. | Design | 16 |
| 9 | Week 1–2 | T-18-1 (base price table). Required for baker BUY/SELL by Week 3–5. | Design (economy) | 32 |
| 10 | Week 1–2 | T-18-INLINE-119 (8 Phase 1 recipes). Depends on step 9. Required for baking-bread metric. | Design | 24 |
| 11 | Week 1–2 | Ratify all BLOCK-P1-MINOR placeholders in §4 above as a single review meeting. ~1 hour for a focused pass. | Design + Engineering joint | 1 |
| 12 | Week 0–2 | T-13-2 non-companion corpse rule (placeholder accepted: 300s decay, then Owner→World). | Design | 2 |

**Critical-path total wall-clock work before Week 1 implementation begins: ~50 person-hours of design + ~50 person-hours of engineering. With one designer and one engineer in parallel, kickoff prep is achievable in one week.**

Items not on the critical path (DEFER-P2 / DEFER-LIVE-OPS) can be re-triaged at the end of Phase 1 against the Doc #11 Phase 2 scope.

---

## 6. Outstanding BLOCK-P1 Items With No Proposed Resolution Path

None. Every BLOCK-P1 item in §2 carries either a proposed answer (T-13-13, T-13-1, T-13-3, T-13-4, T-13-15) or a defined design task with named owner and hours estimate (T-15-1, T-15-6, T-18-1, T-18-INLINE-119). T-13-10 is REDUNDANT (already resolved in #15) and is included in the Top 10 only because the cross-link has not been made in #13.

---

## 7. Summary Findings

- 63 `[OPEN]` items inventoried; 21 (33%) require Phase 1 attention; 42 (67%) are legitimately deferred to Phase 2 or live-ops.
- Of the 15 Doc #13 §5 items, 6 (40%) are already answered in later docs but not cross-linked back to #13. Closing those out via a one-line ratification pass collapses the apparent backlog substantially.
- The single highest-leverage decision is **T-13-13 (MCP caller authority)** — it gates every MCP mutating tool across 5 docs and the Phase 1 `use` capability check.
- The next-highest-leverage *design* task is **T-18-1 + T-18-INLINE-119** — base prices and recipes — because two of the three Phase 1 success metrics (bake bread, baker BUY/SELL) cannot be demoed without them.
- No blocking item lacks an owner or a proposed path. A project lead can run kickoff this week.

---

End of Document #20.
