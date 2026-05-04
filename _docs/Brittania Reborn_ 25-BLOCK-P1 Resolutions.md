Document #25: BLOCK-P1 Resolutions
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0
Date: May 2026
Status: Normative resolutions for the 7 true `BLOCK-P1` items in Doc #20 §2 plus 3 cross-link/ratification items. Each section is action-ready: an engineer or designer can lift the schema/table verbatim into Phase 1 implementation. No further design discussion required.

Depends on: #4 Simulation, #4.1 Crafting, #5 Virtues, #11 Roadmap, #13 Core Schema, #14 MCP Server Surface, #15 Character/Party/Inventory, #17 Dialogue/Schedule, #18 Economy/Crafting/Trade, #20 Phase 1 OPEN Triage, #21 Save Format & Shard DB.

Status legend per resolution:
- **RESOLVED** — full new spec authored here.
- **RATIFIED** — answer already existed in another doc; this section binds it and lists the cross-link cleanup.
- **DATA-FILE-DRAFTED** — a TOML data file is delivered inline below as a code fence; engineering drops it into `data/` verbatim.

---

## T-13-13 — MCP Caller Authority Model

**Source:** Doc #13 §5 [OPEN] item 13; Doc #14 §3, §4 invariant 1.
**Status:** RESOLVED.

### Resolution

Every MCP session is materialised inside the engine as a single `MCPCaller` value. The `MCPCaller` is constructed once at session handshake (Doc #14 §3) and is **immutable for the life of the session**. Every verb the dispatcher receives over MCP carries an `MCPCaller` reference; the dispatcher's `validate(inv)` step (Doc #13 §4 step 1) consults it before any other check.

```ts
type MCPCaller = {
  session_id:      SessionId          // server-assigned; UUIDv4
  shard_id:        ShardId            // bound at handshake; immutable
  avatar_id:       AvatarId           // the Avatar all verbs are submitted as
  capability_set:  CapabilitySet      // see table below; bound at handshake
  transport:       "stdio" | "sse"    // determines auth path
  auth_subject:    AuthSubject | null // null only for stdio (trusted local)
  created_at:      ServerTick
  expires_at:      ServerTick         // session token TTL; renewable per §Renewal
  rate_limit_tier: RateLimitTier      // derived from capability_set
}

type AuthSubject = {
  kind:    "bearer"                   // Phase 1: only bearer tokens; OAuth deferred
  user_id: string                     // opaque id from the auth service
  issued_at: ServerTick
  scope:   string[]                   // capability strings the auth service granted
}
```

### Capability sets (Phase 1)

Identical to Doc #14 §3 but pinned here as the authoritative table. The dispatcher rejects any verb whose `verb_id` is not in the caller's allowed set with `ERR_CAPABILITY` before any side effect runs.

| Capability | Allowed verb tools (Phase 1) | Allowed resource URIs | Phase 1 use |
|---|---|---|---|
| `inspect.read` | none | `forge://shard/{s}/info`, `entity/{id}`, `region/{r}`, `region/{r}/entities` | dashboards |
| `avatar.minimal` | `examine`, `list_actions` | `inspect.read` set + `avatar/{a}/virtues` for own avatar only | LLM observer |
| `avatar.basic` | `avatar.minimal` set + `move_to` | `inspect.read` set | tutorial / accessibility agent |
| `avatar.full` | `avatar.basic` set + `use` | `inspect.read` set + `npc/{id}/schedule` (public NPCs only) | Phase 1 LLM avatar agent, QA harness |

Phase 1 ships **no `gm.*` or `ugc.author` capability**. Those are explicitly out of scope and any session attempting to bind them returns `ERR_CAPABILITY` at handshake.

### Composition with verb permission tables

The verb dispatcher already owns a verb-permission table (Doc #13 §2: which components a verb may read vs write). The `MCPCaller` does not replace that table — it gates access to the verb itself. Order of checks at dispatcher `validate(inv)`:

1. **Capability gate.** `verb.id ∈ caller.capability_set.allowed_verbs`. Else `ERR_CAPABILITY`.
2. **Rate-limit gate.** Per `caller.rate_limit_tier` (see below). Else `ERR_RATE_LIMIT`.
3. **Shard binding.** `inv.shard_id == caller.shard_id`. Else `ERR_SHARD_BINDING`.
4. **Avatar binding.** `inv.avatar_id == caller.avatar_id`. Else `ERR_CAPABILITY` (caller is not authorized to act as another avatar).
5. **Persistence-scope match.** Verb's authoritative scope == `inv.persistence_scope`. Else `ERR_SCOPE_MISMATCH`.
6. **Standard verb preconditions** (range, ownership, virtue rejection, etc., per Doc #13 §4 steps 2–6).

This composition rule means the verb table stays unchanged from Doc #13 — the `MCPCaller` only adds gates 1, 2, 4 in front of it. Mouse/keyboard input synthesises an internal "trusted-local" caller with `capability_set = avatar.full` for the seated player; the rest of the path is identical.

### Authentication

| Transport | Auth requirement | Rationale |
|---|---|---|
| `stdio` | **Trusted; no token required.** The MCP server only binds stdio in single-process dev mode (Doc #14 §8). The local OS process boundary is the trust boundary. The `MCPCaller.auth_subject` is `null`; `capability_set` defaults to `avatar.full` bound to the dev avatar id. | Local dev, CI harness, in-process editor. |
| `sse` / `http` | **Bearer token, validated against a separate auth service.** The shard's edge gateway (Doc #14 §2) calls `POST /auth/v1/introspect` with the token; the response carries `user_id`, granted `scope[]`, and `expires_at`. The shard then constructs the `MCPCaller` with the introspected subject and the intersection of (requested capabilities ∩ granted scopes). | Remote LLM agent, web devtool. Phase 1 SSE is **not shipped** per Doc #14 §8 — but the contract is fixed now so the post-prototype hardening pass adds only the gateway, not redesign. |

The auth service is **out of process** — a separate small service (Phase 1: a single-binary `forge-auth` exposing `/auth/v1/introspect` and `/auth/v1/issue`) holding only `(user_id, capability_grants[])`. It is not the shard DB. Issuing tokens is a designer-tool concern; the shard only consumes introspection.

Tokens are short-lived (default TTL: **15 minutes**). On expiry the next verb returns `ERR_CAPABILITY` with `error.code_detail = "token_expired"`; the client must re-introspect a fresh token and reconnect. Sessions do **not** auto-refresh in Phase 1 — explicit reconnect is the only renewal path.

### Rate limit defaults per capability tier

Applied at the dispatcher per `caller.session_id`. A token-bucket with a per-second refill and a burst cap. Exceeded buckets return `ERR_RATE_LIMIT`. Per-verb sub-buckets are layered for the more expensive verbs.

| Tier | Verbs/sec sustained | Burst cap | Per-verb sub-bucket caps (per minute) | Resource reads/sec |
|---|---|---|---|---|
| `inspect.read` | 0 (no verbs) | 0 | n/a | 20 |
| `avatar.minimal` | 5 | 20 | `examine`: 60; `list_actions`: 60 | 10 |
| `avatar.basic` | 5 | 20 | + `move_to`: 30 | 10 |
| `avatar.full` | 10 | 40 | + `use`: 60; (Phase 2: `attack`: 30, `cast_spell`: 20, `combine`: 30, `drag`: 60) | 20 |

Rate limits are identical for `stdio` and `sse` — the transport does not loosen the bucket (it would be tempting to let stdio bypass; rejected because dev-tool runaway loops still hurt the simulation thread).

### Error contract additions

Augments Doc #14 §5 standard error codes:

```
ERR_CAPABILITY           // verb not in caller.capability_set, or token expired (with code_detail)
ERR_RATE_LIMIT           // per §Rate-limit-defaults
ERR_SESSION_EXPIRED      // caller.expires_at < now; client must reconnect
```

`ERR_AUTH_INTROSPECT_FAILED` (handshake-time only) returned if the auth service is unreachable or the token was rejected; the shard does **not** fall back to anonymous.

### Implementation notes

- The `MCPCaller` lives inside the MCP `UE Subsystem` (Doc #14 §2). The dispatcher receives it as a const-ref — never copied per call.
- All five existing Doc #14 §4 invariants are preserved — none of them change.
- The auth service is a small Go or Rust binary; Phase 1 ships a stub that issues a single fixed `dev-token` mapping to `avatar.full` for the dev avatar. The contract is the introspection API shape, not the issuance flow.

### Cross-doc updates required

- Doc #13 §5 item 13: replace `[OPEN]` with cross-link to Doc #25 §T-13-13.
- Doc #14 §3: append a short paragraph noting that the `SessionBinding` is materialised at runtime as `MCPCaller` per Doc #25 §T-13-13.
- Doc #14 §5: add `ERR_CAPABILITY (code_detail)`, `ERR_RATE_LIMIT`, `ERR_SESSION_EXPIRED` to the standard error code list.
- Doc #14 §10 (Open Questions): strike the moderation-tooling bullet's implicit dependency on this item.

---

## T-13-1 — Right-Click Sub-Verb Taxonomy (Per-Entity Dynamic Enum)

**Source:** Doc #13 §5 [OPEN] item 1; Doc #14 §4 invariant 5, §5.7.
**Status:** RESOLVED.

### Decision

**Per-entity dynamic enum, not a global closed enum.** The right-click contextual menu for any entity is computed from that entity's archetype declaration plus its current component state plus the caller's capability set. There is no shard-wide enumeration of all valid `action_id` values, and `action_id` strings from one entity are not portable to another. This is consistent with Doc #14 §4 invariant 5 ("Per-entity right-click enumeration") which this section now binds with a concrete schema.

### Schema

Each Entity archetype declares its right-click action set in archetype data:

```ts
type ActionDef = {
  action_id:           string             // archetype-local id, e.g. "lockpick", "ignite"
  label:               LocalizedString    // shown in the popup menu (Doc #17 §14)
  verb:                VerbId             // the verb the dispatcher executes
  params_schema:       JsonSchema | null  // schema for `right_click.params` (Doc #14 §5.7)
  requires_capability: CapabilityId | null
  requires_state:      StateMatch | null  // hides the action if the entity state doesn't match
                                          //   (e.g. "ignite" hidden when on_fire == true)
  requires_owner:      "any" | "self" | "not_self" | "world"  // ownership precondition
  sandbox_level:       "Core" | "Restricted" | "Trusted"      // see Doc #19 §5
}

type ArchetypeRightClick = {
  archetype_id:        ArchetypeId
  actions:             ActionDef[]
}
```

### Built-in core action ids

The engine ships a fixed set of **core action ids** that any core archetype may reference. UGC archetypes may declare their own action ids but only at sandbox levels permitted by Doc #19. The core list:

```
mix, pour, ignite, extinguish, lockpick, use, look, drop,
eat, drink, open, close, read, light, repair, equip, unequip
```

An archetype's `actions[]` references these core ids by name; the engine wires `verb`, `params_schema`, and component-mutation set centrally. UGC adds **new** action ids only at sandbox `Trusted` and only when the verb is `script_invoke` (next section).

### `script_invoke` escape hatch

Custom UGC right-click actions resolve to the `script_invoke` verb, which is the only verb the dispatcher accepts as a wrapper around an UGC ScriptHook (Doc #13 §1.6). The `ActionDef.sandbox_level` of any `script_invoke`-backed action must equal the ScriptHook's declared sandbox level. UGC `Restricted` scripts cannot declare custom right-click actions at all in Phase 1; only `Trusted` scripts can — and Phase 1 ships **no `Trusted` UGC sandbox** (Doc #19 §13). Net effect: Phase 1 right-click menus contain **only core action ids**.

### Dispatcher contract

`right_click(entity_id, menu_token, action_id, params)` (Doc #14 §5.7) validates as:

1. `action_id` must appear in `entity.archetype.actions[]`.
2. `menu_token` (issued by `list_actions`) must still be valid (entity component set unchanged since issue).
3. The action's `requires_state`, `requires_owner`, and `requires_capability` predicates must hold.
4. `params` must validate against the action's `params_schema`.
5. The action's `verb` is then dispatched normally (Doc #13 §4).

Failures: `ERR_UNKNOWN_ACTION` (id not in archetype), `ERR_CAPABILITY`, `ERR_INVALID_TARGET` (state mismatch), `ERR_OWNERSHIP`, validation error (params schema).

### Cross-doc updates required

- Doc #13 §5 item 1: replace `[OPEN]` with cross-link to Doc #25 §T-13-1.
- Doc #13 §2 verb table row `right_click(action)`: replace the trailing "Sub-verb taxonomy `[OPEN]`" with cross-link.
- Doc #14 §5.7: append a one-liner noting the per-entity enum and `ArchetypeRightClick` schema.
- Doc #18 §15 item 6 (haggle dispatcher path): mark as "unblocked by Doc #25 §T-13-1; design pass still deferred to Phase 2 per Doc #18 §13".

---

## T-15-1 — Gypsy Question Content (3 Phase-1 Questions)

**Source:** Doc #15 §10.1 (and §1.2 for format).
**Status:** RESOLVED for Phase 1 (3 of 7); the remaining 4 are scoped at the bottom of this section.

### Format (binding)

Each question presents a binary moral dilemma between two of the Eight Virtues. The player's pick adds +1 to the chosen Virtue's tally and -0.5 to the rejected Virtue's tally (per Doc #15 §1.2). After 3 questions the highest-tallied Virtue determines class skew (mapped per Doc #15 §1.2 table). Per-question copy is in U4 second-person ("Thou hast…", "Dost thou…").

### Phase 1 Question 1 — Compassion vs Honesty

> *Thou dost stand at the crossroads, weary from the road. Two beggars sit in the dust. The first, gaunt and silent, asks for thy last loaf of bread. The second, an old soothsayer, offers to read thy fate truthfully — be it dark or fair — but only if thou wilt swear to repeat his words to all whom thou meetest, however terrible. Dost thou:*
>
> *(a) Give thy last loaf to the silent beggar, that he may eat one more day? — COMPASSION*
> *(b) Swear the soothsayer's oath, that the truth of his vision shall pass through thee unaltered? — HONESTY*

### Phase 1 Question 2 — Valor vs Sacrifice

> *Thy ship is wrecked upon a rocky shore. The last skiff can carry but one more soul to safety. Beside thee stands a wounded knight, sword broken, who begs to be left behind that thou mayst live to fight the corsairs that doomed thy ship. Dost thou:*
>
> *(a) Take the skiff, and live to bring vengeance and steel against those who slew thy crew? — VALOR*
> *(b) Yield the skiff to the wounded knight, that another may live, even unto thy own drowning? — SACRIFICE*

### Phase 1 Question 3 — Justice vs Humility

> *A peasant is dragged before thee, having been caught stealing grain from the lord's granary in a year of famine. The lord's law is plain — the thief's hand shall be struck off. Yet thou knowest the lord's stores groan with grain unshared, and the peasant's children are starving. Dost thou:*
>
> *(a) Pronounce the lord's law as it is written, that no thief escape it, lest the law itself be unmade? — JUSTICE*
> *(b) Step back from judgement, saying it is not for thee to weigh another's hunger against another's law? — HUMILITY*

### Scoring example (Phase 1, 3 questions only)

| Player pick | Virtue tallies after |
|---|---|
| Q1=a, Q2=a, Q3=a | Compassion +1, Valor +1, Justice +1; Honesty -0.5, Sacrifice -0.5, Humility -0.5 |
| Q1=b, Q2=b, Q3=b | Honesty +1, Sacrifice +1, Humility +1; Compassion -0.5, Valor -0.5, Justice -0.5 |

Tie-break: alphabetical by Virtue name. With only 3 questions there will frequently be three-way ties; this is acceptable for Phase 1 character-gen testing because (a) the alphabetical rule deterministically picks a class, and (b) the full 7 questions in the post-prototype pass dissolves the ambiguity by design.

### Remaining 4 questions (Phase 2 backlog — placeholders)

To be authored in the same format. Each must touch a Virtue not yet covered to ensure the full 7 collectively touch all 8 Virtues:

- Q4 — **Honor vs Spirituality** — an oath sworn to a Lord vs a vision from the gods.
- Q5 — **Compassion vs Justice** — a guilty man begging mercy.
- Q6 — **Valor vs Honesty** — a battle won by a lie.
- Q7 — **Sacrifice vs Spirituality** — give thy gold to a dying stranger or to the shrine.

These are blocking items for the Phase 2 character-gen completion pass, not Phase 1.

### Cross-doc updates required

- Doc #15 §10 item 1: replace `[OPEN]` with cross-link to Doc #25 §T-15-1; note the 4 remaining questions are Phase 2.
- Doc #15 §1.2: cross-link to Doc #25 §T-15-1 for the canonical Phase 1 question text.

---

## T-15-6 — Starting-Kit Data Table

**Source:** Doc #15 §10.6 (and §1.4 for the rule, §1.2 for class list).
**Status:** DATA-FILE-DRAFTED. Ship verbatim as `data/starting_kits.toml`.

### `data/starting_kits.toml`

```toml
# Starting equipment kits per class skew, per Doc #15 §1.4.
# All eight classes are populated for Phase 1 even though the gypsy-question
# subset (3 of 7) only reliably surfaces a subset of class outcomes; we ship
# all eight so the data path is exercised end-to-end and so a designer can
# force a class for QA without a code change.
#
# Universal grant per Doc #15 §1.4: 50 gp, 1 ration of bread, 3 torches.
# Reagent-using classes additionally get 5 of each cantrip-tier reagent in a pouch.
#
# Schema:
#   [class.<name>]
#   stat_skew_primary    = TrainableStat       # +4 at genesis
#   stat_skew_secondary  = TrainableStat       # +2 at genesis
#   paperdoll.<slot>     = ArchetypeId         # equipped at genesis
#   backpack             = [ {archetype, qty}, ... ]
#   reagent_pouch        = bool                # true → grants the 5x cantrip set

[universal]
gold                = 50
backpack_grant      = [
  { archetype = "item.food.bread.ration", qty = 1 },
  { archetype = "item.tool.torch.unlit",  qty = 3 },
]

[reagent_pouch.cantrip_set]
contents = [
  { archetype = "item.reagent.garlic",         qty = 5 },
  { archetype = "item.reagent.ginseng",        qty = 5 },
  { archetype = "item.reagent.mandrake",       qty = 5 },
  { archetype = "item.reagent.sulfurous_ash",  qty = 5 },
]

# ---------------- Mage (Honesty skew) ----------------
[class.mage]
stat_skew_primary   = "int"
stat_skew_secondary = "magic"
reagent_pouch       = true
[class.mage.paperdoll]
torso       = "armor.robe.linen.blue"
feet        = "armor.shoe.leather.soft"
left_hand   = "weapon.dagger.iron.basic"
neck        = "item.jewelry.amulet.ankh.tin"
back        = "container.backpack.linen"
[[class.mage.backpack]]
archetype = "item.book.spellbook.basic"
qty       = 1
[[class.mage.backpack]]
archetype = "item.scroll.in_lor.cantrip"   # Magic Light cantrip
qty       = 1

# ---------------- Bard (Compassion skew) ----------------
[class.bard]
stat_skew_primary   = "dex"
stat_skew_secondary = "int"
reagent_pouch       = false
[class.bard.paperdoll]
torso       = "armor.tunic.cotton.green"
legs        = "armor.leggings.leather.basic"
feet        = "armor.boot.leather.soft"
left_hand   = "weapon.rapier.iron.basic"
back        = "container.backpack.linen"
[[class.bard.backpack]]
archetype = "item.tool.lute.wood.basic"
qty       = 1

# ---------------- Fighter (Valor skew) ----------------
[class.fighter]
stat_skew_primary   = "str"
stat_skew_secondary = "combat"
reagent_pouch       = false
[class.fighter.paperdoll]
torso       = "armor.chain.iron.basic"
legs        = "armor.leggings.chain.basic"
feet        = "armor.boot.leather.heavy"
hands       = "armor.gauntlet.leather.basic"
left_hand   = "weapon.longsword.iron.basic"
right_hand  = "armor.shield.wood.round"
back        = "container.backpack.canvas"

# ---------------- Druid (Justice skew) ----------------
[class.druid]
stat_skew_primary   = "int"
stat_skew_secondary = "magic"
reagent_pouch       = true
[class.druid.paperdoll]
torso       = "armor.robe.wool.green"
feet        = "armor.shoe.leather.soft"
left_hand   = "weapon.quarterstaff.oak.basic"
right_hand  = "weapon.quarterstaff.oak.basic"     # two-handed: both slots → same EntityId
back        = "container.backpack.linen"
[[class.druid.backpack]]
archetype = "item.tool.sickle.iron.basic"
qty       = 1

# ---------------- Tinker (Sacrifice skew) ----------------
[class.tinker]
stat_skew_primary   = "dex"
stat_skew_secondary = "int"
reagent_pouch       = false
[class.tinker.paperdoll]
torso       = "armor.tunic.canvas.brown"
legs        = "armor.leggings.canvas.brown"
feet        = "armor.boot.leather.basic"
left_hand   = "weapon.crossbow.wood.basic"
back        = "container.backpack.canvas"
quiver      = "item.ammo.bolt.iron.basic"          # carrier; stack qty in backpack
[[class.tinker.backpack]]
archetype = "item.ammo.bolt.iron.basic"
qty       = 20
[[class.tinker.backpack]]
archetype = "item.tool.hammer.iron.basic"
qty       = 1
[[class.tinker.backpack]]
archetype = "item.tool.lockpick.iron.basic"
qty       = 5

# ---------------- Paladin (Honor skew) ----------------
[class.paladin]
stat_skew_primary   = "str"
stat_skew_secondary = "combat"
reagent_pouch       = true
[class.paladin.paperdoll]
torso       = "armor.chain.iron.basic"
legs        = "armor.leggings.chain.basic"
feet        = "armor.boot.leather.heavy"
hands       = "armor.gauntlet.leather.basic"
left_hand   = "weapon.mace.iron.basic"
right_hand  = "armor.shield.iron.kite"
neck        = "item.jewelry.amulet.ankh.silver"
back        = "container.backpack.canvas"

# ---------------- Ranger (Spirituality skew) ----------------
[class.ranger]
stat_skew_primary   = "dex"
stat_skew_secondary = "combat"
reagent_pouch       = false
[class.ranger.paperdoll]
torso       = "armor.tunic.leather.green"
cloak       = "armor.cloak.wool.green"
legs        = "armor.leggings.leather.basic"
feet        = "armor.boot.leather.basic"
left_hand   = "weapon.bow.yew.basic"
right_hand  = "weapon.bow.yew.basic"               # two-handed
back        = "container.backpack.canvas"
quiver      = "item.ammo.arrow.wood.basic"
[[class.ranger.backpack]]
archetype = "item.ammo.arrow.wood.basic"
qty       = 30
[[class.ranger.backpack]]
archetype = "item.tool.bedroll.canvas.basic"
qty       = 1

# ---------------- Shepherd (Humility skew) ----------------
[class.shepherd]
stat_skew_primary   = "str"     # balanced low; primary still recorded for engine
stat_skew_secondary = "dex"
reagent_pouch       = false
[class.shepherd.paperdoll]
torso       = "armor.tunic.wool.brown"
legs        = "armor.leggings.wool.brown"
feet        = "armor.shoe.leather.soft"
left_hand   = "weapon.sling.leather.basic"
back        = "container.backpack.linen"
[[class.shepherd.backpack]]
archetype = "item.ammo.stone.river.basic"
qty       = 30
[[class.shepherd.backpack]]
archetype = "item.tool.crook.wood.basic"
qty       = 1
```

### Notes for engineering

- All `archetype` ids in this file must exist in the master archetype registry by Phase 1 Week 3 (character-gen UI milestone). Missing archetypes are a build-breaker, not a runtime warning.
- `paperdoll` slot names are exactly the Doc #15 §5.1 `EquipSlot` enum.
- Two-handed weapons appear in both `left_hand` and `right_hand` keys with the **same archetype id** — the loader is responsible for instantiating one entity and assigning the same `EntityId` to both slots, per the `Paperdoll` rule in Doc #15 §5.1.
- The `quiver` key on Tinker/Ranger seeds the ammo carrier; the actual stack goes in the backpack so the `Quiver` slot's auto-feed logic (Doc #15 §5.1) starts from a known good state.

### Cross-doc updates required

- Doc #15 §10 item 6: replace `[OPEN]` with cross-link to Doc #25 §T-15-6.
- Doc #15 §1.4: change "the data table is `[OPEN]` until art assets are locked" to "the data table is in Doc #25 §T-15-6; art assets ratify per-archetype but kit composition is locked."

---

## T-13-4 — Witness Model for Stealing (Ratification + Edge Cases)

**Source:** Doc #13 §5 [OPEN] item 4; resolved in Doc #15 §6.2.
**Status:** RATIFIED with edge-case extensions.

### Ratification

The witness model in Doc #15 §6.2 is hereby binding for Phase 1. Restated:

```
steal(actor, item):
  1. witnesses_npc    = NPCs with line-of-sight to (actor, item) AND awake
                        AND in same region
  2. witnesses_player = Avatars in same region with line-of-sight
  3. witnesses_party  = party companions of actor with line-of-sight
  4. witnessed = (witnesses_npc U witnesses_player U witnesses_party).nonempty
  5. emit WitnessEvent { actor, item, witnesses, region } to Virtue Engine
  6. Virtue Engine applies:
       - score_delta = item.steal_delta              # ALWAYS applied (option c)
       - if witnessed:
           push WitnessReport to Justice/Honesty engines
           may flag actor as Wanted (Doc #6 §5)
           guard NPCs may auto-engage on next schedule tick
  7. dispatcher records OwnershipComponent.acquired_via = Stolen
```

The score delta is **always** applied (the option (c) decision), and legal/Wanted consequence is **only** triggered if `witnessed` is true. This is the unambiguous rule; the Phase 1 success metric ("steal bread under one watching baker") tests both branches by varying the baker's awake/asleep state.

### Edge cases (all binding)

#### (a) Blind NPCs

NPCs with `Perception.sight_blocked = true` (a new flag on `PerceptionComponent`, defaulting to `false`) **cannot witness sight events** but **can still witness sound events** emitted by the steal. Sound propagation is per Doc #4 §3 and the `drag` verb's `noise_db` field. Concretely:

- The `witnesses_npc` LOS query in step 1 skips blind NPCs.
- A separate sound query layered into step 1 includes blind NPCs whose `Perception.hearing_radius` covers the actor's tile **and** `drag.noise_db >= NPC.hearing_threshold`.
- A "quiet theft" (light item, `noise_db < threshold`) near a blind NPC therefore goes unwitnessed; a noisy theft (heavy chest dragged) does not.

This makes blind/deaf NPC archetypes a meaningful gameplay variable.

#### (b) Sleeping NPCs

NPCs with `State.sleeping = true` (set by their schedule's `Sleep` slot per Doc #17 §7.1) **do not witness anything** — neither sight nor sound. This is the canonical Phase 1 "steal bread from the baker at 3 AM" exploit and it is **intended**: it is the success metric's negative-witness branch.

The score delta is still applied (item.steal_delta still hits Honesty/Justice in step 6 first sub-bullet); the player just escapes the legal consequence. If the player later wakes the NPC, retroactive witness does **not** fire — the witness query is at the moment of theft, not after the fact.

#### (c) Corpse NPCs

Corpses (NPCs with `State.alive = false`) **do not witness**. They are skipped in steps 1 and 2's awake filter. A corpse Container's contents are still owned (per Doc #15 §4 / Doc #20 T-13-2), so taking from a corpse is still flagged as theft for the score; it just goes unwitnessed unless a separate awake NPC saw it.

This means looting in private (no other awake observers) is mechanically free of legal consequence. Companion observers (`witnesses_party`) still trigger their dialogue barb per Doc #15 §6.3.

#### (d) Witness killed before guards arrive

Once the witness is added to the `WitnessEvent` payload in step 5, the Virtue Engine has already evaluated it. The score delta in step 6 sub-bullet 1 is applied **at the moment of theft**, not at the moment of guard response. Killing the witness afterwards does **not** retroactively erase the Honesty/Justice deltas — the Virtue Engine's audit log (Doc #21 §3.4) records the event with `score_applied_at = <theft tick>`.

The guard auto-engagement, however, is downstream. If the only witness dies before the guard schedule tick fires, the `WitnessReport` is **dropped from the Justice queue** with the rationale "no extant witness can identify the thief". This means killing a witness *can* prevent the Wanted flag from being raised — but the Virtue cost of the murder itself is itself enormous (Doc #5 §4) and the score deltas from the original theft are already on the books.

This rule has the desirable property that murdering witnesses is mechanically possible but never a net Virtue gain.

### Cross-doc updates required

- Doc #13 §5 item 4: replace `[OPEN]` with cross-link to Doc #25 §T-13-4 (and the existing cross-link to Doc #15 §6.2).
- Doc #15 §6.2: append a footer cross-linking the four edge cases to Doc #25 §T-13-4.
- Doc #5 §4 (Virtue Engine audit log): note that witness-related deltas carry `score_applied_at = theft_tick` per Doc #25 §T-13-4(d).

---

## T-13-3 — Schedule Slot Granularity

**Source:** Doc #13 §5 [OPEN] item 3; resolved in Doc #17 §6.1.
**Status:** RATIFIED.

### Ratification

The schedule slot granularity rule in Doc #17 §6.1 is the canonical binding for Phase 1:

- **Per instance, per day.** `slots[]` defines the canonical day; `overrides[]` is per-instance per-event.
- **Cap: 8 base + 8 override.** Hard-enforced at the schema validator.
- **Time resolution: 1 minute.** Time-anchored (each slot's `start_time` defines the previous slot's end), not duration-anchored. Schedule wraps at 24:00 → 00:00.
- **Why max 8.** Forces designers to pick meaningful daily transitions; matches BG/SI authored content (4–6 slot averages).

The Phase 1 baker schedule (a 4-slot day: open shop, bake bread, lunch break, close shop) fits trivially within this cap.

### Cross-doc updates required

- Doc #13 §5 item 3: replace `[OPEN]` with cross-link to Doc #17 §6.1 and Doc #25 §T-13-3 (no additional design work; this section exists only to make the cross-link explicit and discoverable).

---

## T-18-1 — Base Price Table

**Source:** Doc #18 §15 item 1; referenced from Doc #18 §7 and §8.
**Status:** DATA-FILE-DRAFTED. Ship verbatim as `data/prices/base.toml`.

### Pricing principles

1. **Currency: copper.** All prices below are in copper coins. Per Doc #18 §6, 1 gold = 100 copper. The Phase 1 currency surface (Doc #18 §13) ships gold only — but the base table is in copper to prevent fractional gold prices when scaling Virtue × economy modifiers.
2. **Recipe coherence.** Crafted items cost more than the sum of their unmodified base inputs. A dagger (60 cp output) costs strictly more than its iron ingot input (30 cp) plus its wood haft input (5 cp). This is the constraint that prevents recipe arbitrage in Phase 1.
3. **Reagent baseline ≈ 5 cp** for common reagents, scaling up for rarer ones, matching BG's "a handful of garlic is cheap, a mandrake root is dear" intuition.
4. **Bread baseline = 8 cp.** This is the Phase 1 success-metric anchor (baker BUY/SELL); all other consumables key off it.

### `data/prices/base.toml`

```toml
# Phase 1 base price table.
# Currency: copper coins (100 cp = 1 gp per Doc #18 §6).
# Schema:
#   [item.<archetype_id>]
#   base_price_cp     = int        # canonical merchant base; modulated per Doc #18 §7
#   merchant_buy_mult = float      # what merchant pays you (default 0.4 = 40%)
#   merchant_sell_mult= float      # what merchant charges you (default 1.2 = 120%)
#   weight_stones     = float      # canonical weight per Doc #15 §5.2
#   stackable         = bool       # whether multiple instances merge
#   stack_cap         = int        # 0 = not stackable; per Doc #15 §5.3

# ============================================================
# WEAPONS
# ============================================================
[item."weapon.dagger.iron.basic"]
base_price_cp     = 60
merchant_buy_mult = 0.4
merchant_sell_mult= 1.2
weight_stones     = 0.5
stackable         = false
stack_cap         = 0

[item."weapon.shortsword.iron.basic"]
base_price_cp     = 180
weight_stones     = 1.5
stackable         = false

[item."weapon.longsword.iron.basic"]
base_price_cp     = 300
weight_stones     = 2.5
stackable         = false

[item."weapon.rapier.iron.basic"]
base_price_cp     = 220
weight_stones     = 1.0
stackable         = false

[item."weapon.mace.iron.basic"]
base_price_cp     = 200
weight_stones     = 2.5
stackable         = false

[item."weapon.axe.iron.basic"]
base_price_cp     = 240
weight_stones     = 3.0
stackable         = false

[item."weapon.quarterstaff.oak.basic"]
base_price_cp     = 30
weight_stones     = 2.0
stackable         = false

[item."weapon.bow.yew.basic"]
base_price_cp     = 250
weight_stones     = 2.0
stackable         = false

[item."weapon.crossbow.wood.basic"]
base_price_cp     = 320
weight_stones     = 3.0
stackable         = false

[item."weapon.sling.leather.basic"]
base_price_cp     = 15
weight_stones     = 0.2
stackable         = false

[item."item.ammo.arrow.wood.basic"]
base_price_cp     = 1
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.ammo.bolt.iron.basic"]
base_price_cp     = 2
weight_stones     = 0.07
stackable         = true
stack_cap         = 100

[item."item.ammo.stone.river.basic"]
base_price_cp     = 0      # free; gather from any riverbank
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

# ============================================================
# ARMOR
# ============================================================
[item."armor.tunic.cotton.green"]
base_price_cp     = 40
weight_stones     = 1.0

[item."armor.tunic.leather.green"]
base_price_cp     = 120
weight_stones     = 2.0

[item."armor.tunic.canvas.brown"]
base_price_cp     = 30
weight_stones     = 1.0

[item."armor.tunic.wool.brown"]
base_price_cp     = 35
weight_stones     = 1.5

[item."armor.robe.linen.blue"]
base_price_cp     = 80
weight_stones     = 1.0

[item."armor.robe.wool.green"]
base_price_cp     = 90
weight_stones     = 1.5

[item."armor.chain.iron.basic"]
base_price_cp     = 600
weight_stones     = 8.0

[item."armor.plate.iron.basic"]
base_price_cp     = 1500
weight_stones     = 14.0

[item."armor.leggings.leather.basic"]
base_price_cp     = 60
weight_stones     = 1.5

[item."armor.leggings.chain.basic"]
base_price_cp     = 250
weight_stones     = 4.0

[item."armor.leggings.canvas.brown"]
base_price_cp     = 20
weight_stones     = 0.8

[item."armor.leggings.wool.brown"]
base_price_cp     = 25
weight_stones     = 1.0

[item."armor.cloak.wool.green"]
base_price_cp     = 50
weight_stones     = 1.0

[item."armor.boot.leather.soft"]
base_price_cp     = 30
weight_stones     = 0.5

[item."armor.boot.leather.basic"]
base_price_cp     = 50
weight_stones     = 0.8

[item."armor.boot.leather.heavy"]
base_price_cp     = 90
weight_stones     = 1.5

[item."armor.shoe.leather.soft"]
base_price_cp     = 20
weight_stones     = 0.3

[item."armor.gauntlet.leather.basic"]
base_price_cp     = 40
weight_stones     = 0.5

[item."armor.shield.wood.round"]
base_price_cp     = 80
weight_stones     = 2.5

[item."armor.shield.iron.kite"]
base_price_cp     = 350
weight_stones     = 5.0

# ============================================================
# CONSUMABLES
# ============================================================
[item."item.food.bread.ration"]
base_price_cp     = 8
weight_stones     = 0.3
stackable         = true
stack_cap         = 20

[item."item.food.bread.loaf"]
base_price_cp     = 12       # crafted output of dough+oven; richer than ration
weight_stones     = 0.5
stackable         = true
stack_cap         = 20

[item."item.food.dough"]
base_price_cp     = 4
weight_stones     = 0.4
stackable         = true
stack_cap         = 10

[item."item.food.flour"]
base_price_cp     = 3
weight_stones     = 0.5
stackable         = true
stack_cap         = 20

[item."item.food.water.flask"]
base_price_cp     = 1
weight_stones     = 0.5
stackable         = false

[item."item.food.meat.raw"]
base_price_cp     = 5
weight_stones     = 0.5
stackable         = false   # decay_timer per Doc #4.1 §3.1

[item."item.food.meat.cooked"]
base_price_cp     = 10
weight_stones     = 0.4
stackable         = false

[item."item.potion.healing.basic"]
base_price_cp     = 90
weight_stones     = 0.3
stackable         = false

[item."item.tool.torch.unlit"]
base_price_cp     = 4
weight_stones     = 0.3
stackable         = true
stack_cap         = 10

[item."item.tool.torch.lit"]
base_price_cp     = 4         # same nominal price; stack rule prevents stacking
weight_stones     = 0.3
stackable         = false

[item."item.tool.lockpick.iron.basic"]
base_price_cp     = 25
weight_stones     = 0.1
stackable         = true
stack_cap         = 10

# ============================================================
# REAGENTS (8 canonical types)
# ============================================================
[item."item.reagent.garlic"]
base_price_cp     = 4
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.reagent.ginseng"]
base_price_cp     = 6
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.reagent.mandrake"]
base_price_cp     = 30
weight_stones     = 0.1
stackable         = true
stack_cap         = 100

[item."item.reagent.sulfurous_ash"]
base_price_cp     = 5
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.reagent.spider_silk"]
base_price_cp     = 12
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.reagent.nightshade"]
base_price_cp     = 40
weight_stones     = 0.1
stackable         = true
stack_cap         = 100

[item."item.reagent.blood_moss"]
base_price_cp     = 8
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.reagent.black_pearl"]
base_price_cp     = 50
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

# ============================================================
# GEAR & UTILITY
# ============================================================
[item."item.tool.rope.hemp.coil"]
base_price_cp     = 20
weight_stones     = 1.0
stackable         = false

[item."item.tool.sextant.brass.basic"]
base_price_cp     = 400
weight_stones     = 0.8
stackable         = false

[item."item.tool.bedroll.canvas.basic"]
base_price_cp     = 60
weight_stones     = 2.0
stackable         = false

[item."item.tool.lute.wood.basic"]
base_price_cp     = 120
weight_stones     = 1.5
stackable         = false

[item."item.tool.hammer.iron.basic"]
base_price_cp     = 35
weight_stones     = 1.5
stackable         = false

[item."item.tool.sickle.iron.basic"]
base_price_cp     = 45
weight_stones     = 1.0
stackable         = false

[item."item.tool.crook.wood.basic"]
base_price_cp     = 15
weight_stones     = 1.0
stackable         = false

[item."item.book.spellbook.basic"]
base_price_cp     = 200
weight_stones     = 2.0
stackable         = false

[item."item.scroll.in_lor.cantrip"]
base_price_cp     = 50
weight_stones     = 0.05
stackable         = true
stack_cap         = 50

[item."item.jewelry.amulet.ankh.tin"]
base_price_cp     = 30
weight_stones     = 0.1
stackable         = false

[item."item.jewelry.amulet.ankh.silver"]
base_price_cp     = 200
weight_stones     = 0.1
stackable         = false

# ============================================================
# CRAFTING INTERMEDIATES & RAW MATERIALS
# ============================================================
[item."item.material.iron_ore"]
base_price_cp     = 8
weight_stones     = 2.0
stackable         = true
stack_cap         = 50

[item."item.material.iron_ingot"]
base_price_cp     = 30
weight_stones     = 1.5
stackable         = true
stack_cap         = 50

[item."item.material.wood.haft"]
base_price_cp     = 5
weight_stones     = 0.3
stackable         = true
stack_cap         = 50

[item."item.material.wood.plank"]
base_price_cp     = 12
weight_stones     = 1.0
stackable         = true
stack_cap         = 50

[item."item.material.stone.block"]
base_price_cp     = 25
weight_stones     = 5.0
stackable         = true
stack_cap         = 20

[item."item.material.thread.linen"]
base_price_cp     = 2
weight_stones     = 0.05
stackable         = true
stack_cap         = 100

[item."item.material.cloth.linen.bolt"]
base_price_cp     = 25       # ≥ 5 × thread
weight_stones     = 1.0
stackable         = true
stack_cap         = 20

[item."item.material.dagger_blade.iron.basic"]
base_price_cp     = 45       # iron_ingot 30 + smithing labor 15
weight_stones     = 0.4
stackable         = false

# ============================================================
# CONTAINERS
# ============================================================
[item."container.backpack.linen"]
base_price_cp     = 30
weight_stones     = 0.5

[item."container.backpack.canvas"]
base_price_cp     = 60
weight_stones     = 0.8

[item."container.pouch.reagent.linen"]
base_price_cp     = 15
weight_stones     = 0.2
```

### Notes for engineering / economy designer

- The recipe coherence check should run as a CI test: load `data/prices/base.toml` + `data/recipes/phase1.toml` (T-18-INLINE-119 below), and assert that for every recipe, `sum(input.base_price_cp * input.count) < output.base_price_cp * output.count` (with a configurable margin for non-trivial recipes).
- Per-merchant `merchant_buy_mult` / `merchant_sell_mult` overrides live in `data/merchants/*.toml` (out of scope for this doc); the values declared on each item here are the **defaults**.
- All weights in stones per Doc #15 §5.2.

### Cross-doc updates required

- Doc #18 §15 item 1: replace `[OPEN]` with cross-link to Doc #25 §T-18-1.
- Doc #18 §7: cross-link `Shop.price_table` to the file above.

---

## T-18-INLINE-119 — Phase 1 Recipes

**Source:** Doc #18 §3 (and §13 enumeration); Doc #4.1 §6.
**Status:** DATA-FILE-DRAFTED. Ship verbatim as `data/recipes/phase1.toml`.

### Recipe set (8 per Doc #18 §13)

1. `cooking.dough.basic` — flour + water → dough.
2. `cooking.bread.basic` — dough + lit oven → bread.
3. `cooking.meat.cooked` — raw meat + lit oven OR campfire → cooked meat.
4. `smithing.dagger_blade` — iron ingot + hammer + anvil → dagger blade.
5. `smithing.dagger.assemble` — dagger blade + wood haft + workbench → dagger.
6. `alchemy.healing_potion.basic` — mandrake + spider silk + sulfurous ash + water + lit cauldron → healing potion.
7. `carpentry.arrows` — wood plank + tools + workbench → 10 arrows.
8. `textile.cloth_bolt` — thread × 5 + loom → cloth bolt.

(The 9th — `magical.bread.blessed` — is in Doc #18 §3's table but Doc #18 §13 explicitly lists 8; the magical-variant token is a Phase 2 schema extension. We include it as an inert disabled stub at the bottom of the file for forward compatibility but Phase 1 does not match it.)

### `data/recipes/phase1.toml`

```toml
# Phase 1 recipes for Britannia Reborn.
# Schema per Doc #18 §2 (Recipe / RecipeInput / ToolSpec / RecipeOutput / QualityFormula / FailureSpec).
# All recipes are source = "core". UGC sourcing deferred to Phase 2 (Doc #19).
#
# Skill stat ids per Doc #15 §2.1: "str" | "dex" | "int" | "combat" | "magic"

# ============================================================
# 1. cooking.dough.basic
# ============================================================
[recipes."cooking.dough.basic"]
name              = "Dough"
cast_time_ms      = 1500
source            = "core"
tool              = nil          # bare-hands; mix flour into water held in another container
[[recipes."cooking.dough.basic".inputs]]
entity_type   = "item.food.flour"
count         = 1
consumed      = true
[[recipes."cooking.dough.basic".inputs]]
entity_type   = "item.food.water.flask"
count         = 1
consumed      = true
[[recipes."cooking.dough.basic".outputs]]
entity_type   = "item.food.dough"
count         = 1
inherits_owner = true
[recipes."cooking.dough.basic".outputs.0.quality_formula]
base          = 50
skill_weight  = 0.0    # no skill check on dough mixing
virtue_weight = 0.0
tool_weight   = 0.0

# ============================================================
# 2. cooking.bread.basic
# ============================================================
[recipes."cooking.bread.basic"]
name              = "Bread"
cast_time_ms      = 5000
source            = "core"
[recipes."cooking.bread.basic".tool]
entity_type     = "fixture.oven"
within_tiles    = 1
[recipes."cooking.bread.basic".tool.state_required]
lit             = true
[[recipes."cooking.bread.basic".inputs]]
entity_type   = "item.food.dough"
count         = 1
consumed      = true
[[recipes."cooking.bread.basic".outputs]]
entity_type   = "item.food.bread.loaf"
count         = 1
inherits_owner = true
[recipes."cooking.bread.basic".outputs.0.quality_formula]
base          = 50
skill_weight  = 1.0    # cooking skill not yet a stat in Phase 1; falls through to dex
virtue_weight = 0.5    # high Compassion bakes better bread (BR flavor; cite Doc #5 §4)
tool_weight   = 1.0
[recipes."cooking.bread.basic".virtue_modifier]
virtue        = "Compassion"
weight        = 0.5
[recipes."cooking.bread.basic".skill_required]
stat          = "dex"
min           = 5
[recipes."cooking.bread.basic".failure]
[recipes."cooking.bread.basic".failure.output]
entity_type     = "item.food.bread.burnt"
count           = 1
inherits_owner  = true
[recipes."cooking.bread.basic".failure.output.quality_formula]
base          = 10
skill_weight  = 0.0
virtue_weight = 0.0
tool_weight   = 0.0

# ============================================================
# 3. cooking.meat.cooked
# ============================================================
[recipes."cooking.meat.cooked"]
name              = "Cooked Meat"
cast_time_ms      = 4000
source            = "core"
[recipes."cooking.meat.cooked".tool]
entity_type     = "fixture.oven"     # oven OR campfire — matched as either via archetype tag in matcher
within_tiles    = 1
[recipes."cooking.meat.cooked".tool.state_required]
lit             = true
[[recipes."cooking.meat.cooked".inputs]]
entity_type   = "item.food.meat.raw"
count         = 1
consumed      = true
[[recipes."cooking.meat.cooked".outputs]]
entity_type   = "item.food.meat.cooked"
count         = 1
inherits_owner = true
[recipes."cooking.meat.cooked".outputs.0.quality_formula]
base          = 50
skill_weight  = 1.0
virtue_weight = 0.0
tool_weight   = 1.0
[recipes."cooking.meat.cooked".skill_required]
stat          = "dex"
min           = 3

# ============================================================
# 4. smithing.dagger_blade
# ============================================================
[recipes."smithing.dagger_blade"]
name              = "Dagger Blade"
cast_time_ms      = 6000
source            = "core"
[recipes."smithing.dagger_blade".tool]
entity_type     = "fixture.anvil"
within_tiles    = 1
[recipes."smithing.dagger_blade".tool.state_required]
# anvil has no required state (it's not lit); rely on a co-located forge being lit
[[recipes."smithing.dagger_blade".inputs]]
entity_type   = "item.material.iron_ingot"
count         = 1
consumed      = true
[[recipes."smithing.dagger_blade".inputs]]
entity_type   = "item.tool.hammer.iron.basic"
count         = 1
consumed      = false           # tool-input not consumed
[[recipes."smithing.dagger_blade".outputs]]
entity_type   = "item.material.dagger_blade.iron.basic"
count         = 1
inherits_owner = true
[recipes."smithing.dagger_blade".outputs.0.quality_formula]
base          = 45
skill_weight  = 1.5
virtue_weight = 0.5
tool_weight   = 1.0
[recipes."smithing.dagger_blade".skill_required]
stat          = "str"
min           = 8
[recipes."smithing.dagger_blade".virtue_modifier]
virtue        = "Honor"
weight        = 0.5

# ============================================================
# 5. smithing.dagger.assemble
# ============================================================
[recipes."smithing.dagger.assemble"]
name              = "Dagger"
cast_time_ms      = 3000
source            = "core"
[recipes."smithing.dagger.assemble".tool]
entity_type     = "fixture.workbench"
within_tiles    = 1
[recipes."smithing.dagger.assemble".tool.state_required]
[[recipes."smithing.dagger.assemble".inputs]]
entity_type   = "item.material.dagger_blade.iron.basic"
count         = 1
consumed      = true
[[recipes."smithing.dagger.assemble".inputs]]
entity_type   = "item.material.wood.haft"
count         = 1
consumed      = true
[[recipes."smithing.dagger.assemble".outputs]]
entity_type   = "weapon.dagger.iron.basic"
count         = 1
inherits_owner = true
[recipes."smithing.dagger.assemble".outputs.0.quality_formula]
base          = 50
skill_weight  = 1.5
virtue_weight = 0.5
tool_weight   = 1.0
[recipes."smithing.dagger.assemble".skill_required]
stat          = "dex"
min           = 6

# ============================================================
# 6. alchemy.healing_potion.basic
# ============================================================
[recipes."alchemy.healing_potion.basic"]
name              = "Healing Potion"
cast_time_ms      = 8000
source            = "core"
[recipes."alchemy.healing_potion.basic".tool]
entity_type     = "fixture.cauldron"
within_tiles    = 1
[recipes."alchemy.healing_potion.basic".tool.state_required]
lit             = true
[[recipes."alchemy.healing_potion.basic".inputs]]
entity_type   = "item.reagent.mandrake"
count         = 1
consumed      = true
[[recipes."alchemy.healing_potion.basic".inputs]]
entity_type   = "item.reagent.spider_silk"
count         = 1
consumed      = true
[[recipes."alchemy.healing_potion.basic".inputs]]
entity_type   = "item.reagent.sulfurous_ash"
count         = 1
consumed      = true
[[recipes."alchemy.healing_potion.basic".inputs]]
entity_type   = "item.food.water.flask"
count         = 1
consumed      = true
[[recipes."alchemy.healing_potion.basic".outputs]]
entity_type   = "item.potion.healing.basic"
count         = 1
inherits_owner = true
[recipes."alchemy.healing_potion.basic".outputs.0.quality_formula]
base          = 40
skill_weight  = 2.0
virtue_weight = 1.0
tool_weight   = 1.0
[recipes."alchemy.healing_potion.basic".skill_required]
stat          = "magic"
min           = 8
[recipes."alchemy.healing_potion.basic".virtue_modifier]
virtue        = "Compassion"
weight        = 1.0
[recipes."alchemy.healing_potion.basic".failure]
damage           = { amount = 6, type = "fire" }      # Doc #18 §4.1 alchemy explosion precedent
[recipes."alchemy.healing_potion.basic".failure.virtue_delta]
virtue           = "Humility"
delta            = -1
[recipes."alchemy.healing_potion.basic".failure.state_apply]
target           = "tool"
[recipes."alchemy.healing_potion.basic".failure.state_apply.state]
on_fire          = true

# ============================================================
# 7. carpentry.arrows
# ============================================================
[recipes."carpentry.arrows"]
name              = "Arrows"
cast_time_ms      = 5000
source            = "core"
[recipes."carpentry.arrows".tool]
entity_type     = "fixture.workbench"
within_tiles    = 1
[recipes."carpentry.arrows".tool.state_required]
[[recipes."carpentry.arrows".inputs]]
entity_type   = "item.material.wood.plank"
count         = 1
consumed      = true
[[recipes."carpentry.arrows".inputs]]
entity_type   = "item.tool.hammer.iron.basic"
count         = 1
consumed      = false
[[recipes."carpentry.arrows".outputs]]
entity_type   = "item.ammo.arrow.wood.basic"
count         = 10
inherits_owner = true
[recipes."carpentry.arrows".outputs.0.quality_formula]
base          = 60
skill_weight  = 1.0
virtue_weight = 0.0
tool_weight   = 0.5
[recipes."carpentry.arrows".skill_required]
stat          = "dex"
min           = 5

# ============================================================
# 8. textile.cloth_bolt
# ============================================================
[recipes."textile.cloth_bolt"]
name              = "Bolt of Cloth"
cast_time_ms      = 7000
source            = "core"
[recipes."textile.cloth_bolt".tool]
entity_type     = "fixture.loom"
within_tiles    = 1
[recipes."textile.cloth_bolt".tool.state_required]
[[recipes."textile.cloth_bolt".inputs]]
entity_type   = "item.material.thread.linen"
count         = 5
consumed      = true
[[recipes."textile.cloth_bolt".outputs]]
entity_type   = "item.material.cloth.linen.bolt"
count         = 1
inherits_owner = true
[recipes."textile.cloth_bolt".outputs.0.quality_formula]
base          = 55
skill_weight  = 1.0
virtue_weight = 0.0
tool_weight   = 1.0
[recipes."textile.cloth_bolt".skill_required]
stat          = "dex"
min           = 4

# ============================================================
# (Disabled stub — Phase 2) magical.bread.blessed
# Listed for forward compat with Doc #18 §3 magical-variant token.
# Phase 1 matcher must NOT load entries with `phase = "phase2"`.
# ============================================================
[recipes."magical.bread.blessed"]
name              = "Blessed Bread"
phase             = "phase2"
cast_time_ms      = 2000
source            = "core"
tool              = nil
[[recipes."magical.bread.blessed".inputs]]
entity_type   = "item.food.bread.loaf"
count         = 1
consumed      = true
[[recipes."magical.bread.blessed".inputs]]
entity_type   = "spell:in_mani"   # Create Food spell overlay
count         = 1
consumed      = false
[[recipes."magical.bread.blessed".outputs]]
entity_type   = "item.food.bread.blessed"
count         = 1
inherits_owner = true
[recipes."magical.bread.blessed".outputs.0.quality_formula]
base          = 75
skill_weight  = 0.5
virtue_weight = 1.5
tool_weight   = 0.0
[recipes."magical.bread.blessed".virtue_modifier]
virtue        = "Spirituality"
weight        = 1.5
```

### Notes for engineering

- TOML does not natively express `null`; `nil` above is a placeholder that the loader must resolve to "no tool required". Suggested: treat `tool = nil` literally as the string `"nil"` and special-case it in the loader, or omit the `tool` key entirely (cleaner). The TOML above uses the explicit `nil` form for symmetry with the schema; engineering may switch to "omit" when implementing.
- Recipe IDs follow the Doc #18 §2 dotted convention.
- The "oven OR campfire" alternative for `cooking.meat.cooked` is intentionally not expressed in TOML — the matcher is responsible for resolving any archetype with the `tag = "heat_source"` archetype tag against the recipe's tool entry. Phase 1 ships only `fixture.oven` as a heat source per Doc #18 §13; campfires are Phase 2.
- The CI assertion in T-18-1 above must skip recipes with `phase = "phase2"`.

### Cross-doc updates required

- Doc #18 §3 (the table at the bottom): change "the full Phase 1 set of 8 lives in `data/recipes/phase1.toml` (`[OPEN]`)" to cross-link Doc #25 §T-18-INLINE-119.
- Doc #18 §13: ratify the 8 recipes listed there match this file.
- Doc #4.1 §6 ("At least 8 working recipes (bread, dagger, basic healing potion, etc.)"): cross-link to Doc #25 §T-18-INLINE-119 for the canonical list.

---

## T-13-15 — Procedurally-Generated Entity Persistence

**Source:** Doc #13 §5 [OPEN] item 15; resolved in Doc #21 §13.
**Status:** RATIFIED.

### Ratification

The four-part rule in Doc #21 §13 is the canonical binding for Phase 1:

1. **Default rule (region-wide procedural).** Procedural entities default to `PersistenceScope.WorldState` with `world_entities.scope = 'Procedural'` and `scope_owner_key = <region_id>`. Durable like any other world entity; survive restart; appear in `replication_log`.
2. **Pocket-realm rule.** Procedural entities inside a pocket realm (e.g. Cave of Trials per Doc #11) are scoped to the **instance** (`scope_owner_key = <instance_id>`); on instance unload + grace period, all rows with that key are deleted in one transaction; on re-entry the generator re-rolls.
3. **Drag-time scope promotion.** A procedural entity moved into player inventory by `drag` has its persistence row rewritten from `world_entities` to `player_inventory` (scope: `WorldState`/`Procedural` → `PlayerInventory`). Component bag preserved; routing changes.
4. **No new top-level scope.** `PersistenceScope` enum stays at six values; `Procedural` is a sub-tag inside `WorldState` storage, not a peer scope.

This handles the Phase 1 Cave of Trials deliverable (Doc #11 Week 9–10).

### Cross-doc updates required

- Doc #13 §5 item 15: replace `[OPEN]` with cross-link to Doc #21 §13 and Doc #25 §T-13-15. No further design work.

---

## T-13-10 — Container Weight/Volume Cascading

**Source:** Doc #13 §5 [OPEN] item 10; resolved in Doc #15 §5.2.
**Status:** RATIFIED. (REDUNDANT per Doc #20 — included for completeness so Phase 1 engineering has one place to look.)

### Ratification

The two-row rule in Doc #15 §5.2 is binding:

| Property | Cascades? | Rule |
|---|---|---|
| `weight` | **Yes**, to all ancestors | A child container's total weight (own + contents) propagates to its parent; the Avatar's carry-weight check sums the full tree. |
| `volume` (bulk) | **No** past one level | A container's `volume` is measured against its parent only; not propagated. A bag fills a chest's volume; the bag's contents fill the bag's own volume budget independently. |

Container nesting depth: **unlimited** (per Doc #15 §5.2, citing `[SI]`). The dual constraint (weight in stones, volume in bulk) is enforced at every level by the `drag` precondition path.

### Cross-doc updates required

- Doc #13 §5 item 10: replace `[OPEN]` with cross-link to Doc #15 §5.2 and Doc #25 §T-13-10. No further design work.

---

## §Cross-doc Cleanup Checklist

The following one-line amendments to existing docs are required to close `[OPEN]` markers and propagate the resolutions in this doc. **No content changes — only cross-links.** A single editorial pass closes all of them.

| Doc | Section | Edit |
|---|---|---|
| #13 | §5 item 1 | Replace `[OPEN]` with cross-link to Doc #25 §T-13-1. |
| #13 | §5 item 3 | Replace `[OPEN]` with cross-links to Doc #17 §6.1 + Doc #25 §T-13-3. |
| #13 | §5 item 4 | Replace `[OPEN]` with cross-links to Doc #15 §6.2 + Doc #25 §T-13-4. |
| #13 | §5 item 9 | Replace `[OPEN]` with cross-link to Doc #18 §2 (already noted in source). |
| #13 | §5 item 10 | Replace `[OPEN]` with cross-links to Doc #15 §5.2 + Doc #25 §T-13-10. |
| #13 | §5 item 12 | Replace `[OPEN]` with cross-links to Doc #19 §5 + Doc #16 §5. |
| #13 | §5 item 13 | Replace `[OPEN]` with cross-link to Doc #25 §T-13-13. |
| #13 | §5 item 14 | Replace `[OPEN]` with cross-link to Doc #16 §14. |
| #13 | §5 item 15 | Replace `[OPEN]` with cross-links to Doc #21 §13 + Doc #25 §T-13-15. |
| #13 | §2 verb table, `right_click(action)` row | Strike trailing "Sub-verb taxonomy `[OPEN]`"; cross-link Doc #25 §T-13-1. |
| #14 | §3 (SessionBinding) | Append: "materialised at runtime as `MCPCaller` per Doc #25 §T-13-13." |
| #14 | §5 (error code list) | Add `ERR_CAPABILITY (code_detail)`, `ERR_RATE_LIMIT`, `ERR_SESSION_EXPIRED`. |
| #14 | §5.7 (right_click tool) | One-liner: per-entity enum schema in Doc #25 §T-13-1. |
| #15 | §1.2 | Cross-link to Doc #25 §T-15-1 for canonical Phase 1 question text. |
| #15 | §1.4 | Replace "data table is `[OPEN]`" with cross-link to Doc #25 §T-15-6. |
| #15 | §6.2 footer | Cross-link the four edge cases to Doc #25 §T-13-4(a)–(d). |
| #15 | §10 item 1 | Replace `[OPEN]` with cross-link to Doc #25 §T-15-1. |
| #15 | §10 item 6 | Replace `[OPEN]` with cross-link to Doc #25 §T-15-6. |
| #5 | §4 (Virtue Engine audit log) | Note `score_applied_at = theft_tick` rule per Doc #25 §T-13-4(d). |
| #18 | §3 table footer | Replace `data/recipes/phase1.toml` `[OPEN]` reference with cross-link to Doc #25 §T-18-INLINE-119. |
| #18 | §15 item 1 | Replace `[OPEN]` with cross-link to Doc #25 §T-18-1. |
| #18 | §15 item 6 | Note "unblocked by Doc #25 §T-13-1; haggle design pass still deferred per §13." |
| #4.1 | §6 | Cross-link the "8 working recipes" line to Doc #25 §T-18-INLINE-119. |

---

## §Estimated Implementation Effort

Hours to implement each resolution **in code/data** (post-design; this is engineering effort, not design effort which Doc #20 §5 already estimates at ~50 design hours + ~50 engineering hours for design-side decisions).

| ID | Resolution kind | Implementation work | Hours |
|---|---|---|---|
| T-13-13 | RESOLVED | `MCPCaller` type + dispatcher composition gates 1, 2, 4 + auth-service stub + introspection client + rate-limit token bucket + 6 dispatcher tests | 24 |
| T-13-1 | RESOLVED | `ArchetypeRightClick` schema loader + `list_actions` resolver + `right_click` validator + 4 dispatcher tests + core action id registry | 16 |
| T-15-1 | RESOLVED | 3 question records in `data/character_gen/gypsy_questions.toml` + scoring rule + UI wiring (text + 2 buttons) | 6 |
| T-15-6 | DATA-FILE-DRAFTED | Drop `data/starting_kits.toml` + archetype id audit + character-gen kit-instantiation path + 2 tests | 12 |
| T-13-4 | RATIFIED + edges | `Perception.sight_blocked` flag + sound query layer + sleeping-NPC short-circuit + corpse short-circuit + audit-log timestamp rule + 6 dispatcher tests | 14 |
| T-13-3 | RATIFIED | Schema validator enforcing 8 base + 8 override cap + 1-minute resolution check + 1 test | 2 |
| T-18-1 | DATA-FILE-DRAFTED | Drop `data/prices/base.toml` + price loader + per-merchant override loader contract + CI recipe-coherence test | 12 |
| T-18-INLINE-119 | DATA-FILE-DRAFTED | Drop `data/recipes/phase1.toml` + recipe loader (or extend if exists) + 8 recipe-match integration tests + Phase-1 success-metric end-to-end test (bake bread → donate to beggar) | 18 |
| T-13-15 | RATIFIED | `Procedural` sub-tag in `world_entities.scope` enum + drag-time scope promotion hook + instance-unload cascade-delete + 3 tests (already partly in #21 schema) | 6 |
| T-13-10 | RATIFIED | `drag` precondition: cascading-weight sum + direct-children-only volume check + 2 tests | 4 |
| **Total** | | | **114 hours** |

At a sustained 30 productive hours/engineer/week: **~1 engineer × 4 weeks** to land all of the above as merged code, including tests. This sits comfortably within Phase 1's Week 0–5 prep window per Doc #11 / Doc #20 §5.

---

End of Document #25.
