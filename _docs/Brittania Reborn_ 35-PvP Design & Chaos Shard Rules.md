# 35 — PvP Design & Chaos Shard Rules

Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [PvP & Live Ops Design Lead]
Status: Living Design Reference — Normative spec for player-vs-player combat, shard taxonomy, the Chaos shard ruleset, faction/notoriety systems, and griefing defenses. Resolves Doc #6 §4 PvP philosophy stub and Doc #16 §13 [OPEN] item 4 (Charm in PvP shards).

Depends on: #2 GDD §4.3 §6, #5 Virtues §2 §4 §5, #6 Persistent World §2 §4 §5, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface §3 §4 §5, #15 Character, Party & Inventory §4 §5, #16 Combat & Magic §2 §3 §7 §8 §10, #18 Economy, Crafting & Trade §9, #21 Save Format & Shard DB, #22 Network Protocol & Replication §3 §6 §11, #28 Telemetry, Analytics & Live Ops §7, #29 Moderation & Admin Tools, #32 Anti-cheat & Security Hardening §3 §6 §7 §12 §15.

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[UO]` = *Ultima Online* (1997, the canonical Trammel/Felucca template). `[BR]` = original to Britannia Reborn.

---

## 1. PvP Design Philosophy

Britannia Reborn does not reward cruelty, but it must permit it — bounded, opt-in, and consequence-laden — because the moral weight of the Eight Virtues collapses if the world cannot be transgressed. The single-player vision (Doc #2 §1, "every choice echoes") generalizes to multiplayer only if at least one shard remains genuinely dangerous. The Chaos shard exists to be that place. The Order shard exists so that players who do not want it never have to encounter it. Both must be first-class citizens — neither a "default" with the other relegated to a niche server farm. Core mantras:

1. **Consent is the dividing line.** Trammel-equivalent shards (Order) treat unconsented PvP as a hard-rejected verb invocation by the dispatcher (Doc #16 §2.1 `ERR_VIRTUE_REJECTED`). Felucca-equivalent shards (Chaos) treat consent as implicit at login.
2. **Risk and reward must scale together.** Anything Chaos players can lose, Chaos players can also gain — and gain in quantities that Order players cannot. See §10.
3. **Virtue is louder, not optional, on Chaos.** The Virtue Engine (Doc #5) does not stop scoring just because PvP is legal; it scores differently. A Chaos murderer is not a virtuous player just because their server allows the kill — they are a Notorious player whose actions are visible to the world (§5).
4. **Anti-grief is a feature, not a patch.** Log-out timers, res-kill protection, account-wide cooldowns (§7) are designed up front, not added after the first scandal.
5. **No cross-contamination.** Items, gold, and reputation cannot leak from Chaos to Order in either direction (§9). The two ecosystems are deliberately walled.

This doc is the normative spec for everything that changes between Order and Chaos shards. Where shard behavior is identical, the relevant rule lives in its primary doc and is not duplicated here.

---

## 2. Shard Taxonomy

Doc #6 §2 lists four shard types. This section formalizes them with PvP-relevant attributes; §3 specifies the Chaos ruleset in detail.

### 2.1 Shard Type Matrix

| Attribute | Classic | Beginner / Tutorial | Order (Trammel-equiv) | Chaos (Felucca-equiv) |
|---|---|---|---|---|
| Player count | 1–8 (private) | 1, instanced | 2,000–10,000 concurrent | 2,000–10,000 concurrent |
| PvP enabled | Optional (party consent) | No | Consent-only (duels, arenas, declared guild war only) | Yes, world-wide |
| Looting on death | None | None | Blessed-only loss (§4.4) | Full corpse loot (§4.3) outside guard zones |
| Stat / skill loss on death | None | None | None (item insurance only) | Optional (§4.5); off by default in Phase 2 |
| NPC guards | Hostile to criminals only | None (no crime concept) | Aggressive in towns; protect all law-abiding players | Towns only; wilderness ungoverned |
| Murder count system | Off | Off | Off (no murders possible) | On (§5.2) |
| Reputation/notoriety visible | Virtue title only | None | Virtue title | Virtue title + Murder Count + Chaos/Order alignment |
| Faction wars | Off | Off | Declared guild wars only (§4.6 explicit) | Declared + open Chaos/Order alignment (§4.6) |
| Item insurance | Off (saves are local) | Off | Default-on, free | Default-off, gold-cost (§4.4) |
| Resurrection penalties | None | None | None | Stat drift (§4.5), no item return |
| Cross-shard transfer | N/A | One-way out (graduate) | To Order, with restrictions | None outbound; Chaos drops cannot leave (§9) |
| Procedurally generated frontier (Doc #8) | Yes | No | Yes | Yes, with Chaos rules |

The "Virtue Shard" of Doc #6 §2 is renamed **Order Shard** in this document for symmetry with the Chaos counterpart and to avoid confusion with the Virtue *system* (Doc #5), which runs on every shard. The label "Virtue Shard" in older docs refers to what this doc calls the Order Shard.

### 2.2 Shard Selection at Login

Per Doc #6 §2, shard is player-selectable at login. The PvP-relevant constraints:

- The selected shard becomes the binding for the entire session (Doc #14 §4 invariant 4). An Avatar is on Order or on Chaos, not both, for the duration of a session.
- An Avatar may exist as an entity on multiple shards via the cross-shard travel framework (Doc #6 §2), but the shard binding is always to one at a time and the Avatar's persistent state on each shard is tracked separately for Chaos-specific fields (§5.2 murder counts, §4.6 alignment).
- Switching shards mid-session requires logout, a 5-minute server-side cooldown (anti-exploit per §7.4), and re-authentication.
- The login flow shows shard population, latency to nearest game server, and a one-line warning for Chaos: *"This shard permits open player-versus-player combat, looting of corpses, and reputation consequences. Item loss is permanent."* The warning is dismissible but logged in `shard_selection_log` for telemetry (Doc #28).

### 2.3 Region-Level Flags Within a Shard

Even on the Chaos shard, not every tile is open PvP. Region metadata extends Doc #6 §2 spatial-partitioning regions:

```ts
type RegionPvpPolicy = {
  pvp_enabled:       bool                 // base allow flag
  guard_zone:        bool                 // §6 town guards intervene
  looting_allowed:   bool                 // false in arena/duel zones with no_loot
  res_kill_protect:  bool                 // §7.2 default true
  faction_only:      "any" | "chaos" | "order" | "none"  // §4.6 faction-locked zones
  arena_id:          ArenaId | null       // §11 instanced arenas have id
}
```

| Region kind | pvp | guard | loot | res_kill | faction |
|---|---|---|---|---|---|
| Chaos shard, town interior | yes | yes | no (criminals only) | yes | any |
| Chaos shard, wilderness | yes | no | yes | yes | any |
| Chaos shard, dungeon | yes | no | yes | yes | any |
| Chaos shard, faction stronghold | yes | yes (faction guards) | yes (cross-faction only) | yes | chaos or order |
| Chaos shard, sanctuary (shrine 8 tiles) | no | yes | n/a | n/a | any |
| Order shard, all regions except declared-war zones | no (rejects with `ERR_VIRTUE_REJECTED`) | yes | n/a | n/a | none |
| Order shard, declared-war zones | yes (combatants only) | no | no (Order rule) | yes | declared parties |
| Arena (any shard) | yes (instanced) | no | no | n/a | any |

The dispatcher (Doc #13 §4) consults the region's `RegionPvpPolicy` in the Verb Validation pipeline (Doc #32 §3) before resolving any combat verb against another player; mismatch produces `ERR_PVP_NOT_ALLOWED` (new code, see §13).

---

## 3. Chaos Shard Ruleset

### 3.1 Default-On Behaviors

On a Chaos shard, the following are **on by default** for every Avatar:

1. **PvP attackability:** any other player not in your party and not within a sanctuary region (§3.5) is a valid `attack`/`cast_spell`/`throw` target.
2. **Corpse looting:** when an Avatar dies, the corpse becomes a normal `Container` entity (Doc #13 §1.4) with the killer's `OwnershipComponent.owner` set as primary access-holder for the loot window (§4.3).
3. **Murder Count tracking:** §5.2.
4. **Notoriety tier visibility:** §5.4. Other players see your tier as a paperdoll halo color (Doc #15).
5. **Faction enrollment eligibility:** any player may join the Chaos or Order faction once their character reaches Level 2 (§4.6).

### 3.2 Opt-In Mechanics

Some behaviors are off by default and require explicit opt-in:

- **Item insurance** (§4.4): off; player must visit a Banker NPC and bind specific items.
- **Stat-loss-on-death** (§4.5): off in Phase 2 launch; an "Old School" toggle slated for Phase 3 may opt the player into stat drift in exchange for a leaderboard prefix (§10.4).
- **Faction enrollment** (§4.6): off; player must speak to a faction recruiter and confirm.
- **Bounty acceptance** (§5.6): off; player must register at a Bounty Board NPC.

### 3.3 Hard-Locked-Off Behaviors

Even on Chaos, these are never permitted:

- Attacking another player on the same shard before character creation completes (Doc #15 character creation flow).
- Attacking another player inside an active dialogue session (Doc #17 §5) where neither party is a hostile NPC.
- Attacking inside a moongate transit window (the 1.5 s during which `RegionHandoff` per Doc #22 §6 is mid-flight).
- Attacking a player whose `State.unconscious == true` if they are within 5 s of their unconsciousness onset (overlaps §7.2 res-kill protection but also covers the live-but-down state).

These are dispatcher-enforced absolute rules and produce `ERR_PVP_NOT_ALLOWED` regardless of shard. The Doc #16 §13 [OPEN] 10 question (unconscious attackability) is here resolved as: **on Chaos, unconscious entities are attackable after the 5 s grace window; on Order, never.**

### 3.4 Combat Resolution on Chaos

Combat resolution follows Doc #16 §2 verb contracts unmodified, and is **Rust-server-authoritative** per Doc #16 and the Doc #41 Engine & Stack ADR — every PvP rule in this document (consent gating, sanctuary checks, Aggressor/Criminal/Murderer flag transitions, Murder Count updates, looting access, halo broadcast, anti-grief throttles) is enforced and resolved exclusively on the authoritative Rust server. UE5 and PixiJS clients are dumb views over the wire protocol (Protobuf per Doc #41); they may render speculative animations but never compute the outcome. The only PvP-specific deltas are:

| Step | Order shard behavior | Chaos shard behavior |
|---|---|---|
| Range / LOS / sanity | Identical to PvE | Identical to PvE |
| Capability check | Verb rejected if `target.kind == Player` and not in declared war | Verb accepted; routes through PvP scoring |
| Damage roll | Identical formula (Doc #16 §3) | Identical formula |
| Armor mitigation | Identical | Identical |
| Crit RNG | Server-side per Doc #32 §7 | Server-side per Doc #32 §7 |
| State effects (poison, fire, bleed) | Apply per Doc #16 §7 | Apply per Doc #16 §7 |
| Charm (`in_quas`) | Cannot target players (`ERR_INVALID_TARGET`) | Can target players, with consent gate (§3.6) — resolves Doc #16 §13 [OPEN] item 4 |
| Virtue scoring | Compassion/Justice negative on murder of innocent | §5.1 alternate Virtue table |
| Persistence write | Standard | Standard plus Murder Count update (§5.2) |
| Replication | Standard | Standard plus halo update (§5.4) |

There is no separate PvP damage formula. The simulation treats Avatars and NPCs as the same kind of `Combat`-component-bearing entity, per Doc #13. The differences are entirely in policy (consent, scoring, looting).

### 3.5 Sanctuary Regions

The following regions are sanctuary on Chaos (no PvP, no looting, no PK consequences either way):

- An 8-tile radius around any of the eight Virtue shrines (matches Doc #5 shrine canon).
- The interior of any Healer building (so players can resurrect without being farmed at the resurrection point — see §7.2).
- The interior of the Lord British throne room (canonical lore-sanctuary).
- The interior of Banker buildings during a banking interaction (locks for the duration of the open-bank session).
- Tutorial / Beginner shard regions, even if a Chaos player visits via cross-shard travel (which is forbidden anyway by §9.2, but defense in depth).

Sanctuary is enforced at verb dispatch — `attack(target=Player)` inside sanctuary returns `ERR_PVP_NOT_ALLOWED` and does not consume any cooldown or rate-limit budget on the attacker.

### 3.6 Charm in PvP — Resolves Doc #16 §13 [OPEN] item 4

`cast_spell(in_quas)` (charm) on a player target in Chaos is **permitted, with the following constraints:**

1. The target must be flagged Aggressor (§5.3) or share a faction-war state with the caster (§4.6); a fully-Innocent player cannot be charmed by a stranger.
2. Charm duration on a player is capped at **15 seconds** (vs. 60 s on NPCs per Doc #16 §7) to avoid griefing scenarios where a charmed player walks off a cliff or into a town guard.
3. Charmed players do not lose control of their movement (their AI is not flipped); instead, the spell forces a `Pacified` state — they cannot invoke offensive verbs against the caster's party for the duration. This is a more conservative interpretation than the Doc #16 §7 NPC version, which flips faction.
4. A successful charm is scored as Honor − for the caster (it is dishonorable to take agency from a sentient Avatar), and the target is granted a temporary `victim_protection` flag for 30 s post-charm-expiry (§7.5).

`ERR_PVP_NOT_ALLOWED` returned if any constraint fails.

### 3.7 Stealth, Invisibility, and Stealing in PvP

Doc #16 §7 lists `Invisible` as a status flag. On Chaos:

- Invisible players are still attackable if revealed via `cast_spell(quas_lor)` reveal (Doc #16 §5.4 `Reveal` effect) or by an AOE that hits their tile.
- A player attacking from invisibility ("backstab") triggers an immediate Aggressor flag (§5.3) and a Honor − Virtue penalty (Doc #5 §2; striking from concealment).
- Stealing from another player's belt (Doc #18 economy, pickpocket verb) is a Chaos-only verb. Order shards reject `pickpocket(target=Player)` with `ERR_PVP_NOT_ALLOWED`. On Chaos, success requires Stealing skill check against target's `Combat`-component-derived perception; failure flags the actor as Criminal (§5.3) for 2 minutes.

---

## 4. PvP Combat Rules

### 4.1 Target Acquisition

Player target acquisition uses the same `target: EntityId` resolution as Doc #16 §2.1, with the following PvP-specific filters applied at dispatch time:

```
acquire_pvp_target(actor, target):
  if target.kind != Player:                        return ALLOW (NPC; standard combat)
  if shard.policy != Chaos and not in_war(actor, target):  return ERR_PVP_NOT_ALLOWED
  if region(actor).pvp_enabled == false:            return ERR_PVP_NOT_ALLOWED
  if region(target).sanctuary:                      return ERR_PVP_NOT_ALLOWED
  if target.unconscious_age < 5s:                   return ERR_PVP_NOT_ALLOWED  // §7.2
  if target.session.in_dialogue_with_npc:           return ERR_PVP_NOT_ALLOWED
  if target.session.region_handoff_in_progress:     return ERR_PVP_NOT_ALLOWED
  if target.account_id == actor.account_id:         return ERR_PVP_NOT_ALLOWED  // self-account / alt
  if target.party == actor.party:                   return ERR_FRIENDLY_FIRE   // §4.2
  return ALLOW
```

The check at `target.account_id == actor.account_id` defends against a single account using two clients to farm Murder Counts on its own alt — a known UO-era exploit pattern.

### 4.2 Friendly Fire

Default: party members and guildmates cannot damage each other.

- A `party` is the small group of up to 8 players defined in Doc #6 §4 cooperative play.
- A `guild` is a larger persistent organization (Doc #18 §11 economy — guild halls; Doc #29 §6 moderation — guild governance).
- Damage to a party member is rejected at dispatch (`ERR_FRIENDLY_FIRE`).
- Damage to a guildmate who is not in your party is rejected unless the guild has set its `friendly_fire_policy = "allow"` (a guild-master-only setting; useful for guild-internal tournament practice).
- Area-of-effect spells (`cast_spell(vas_flam)` on a tile) do not check friendly-fire at cast time, but resolved damage to any party/guild member in the AoE is set to 0 (the visual effect plays, but damage is suppressed). Damage to non-party non-guild bystanders applies normally; this is a deliberate design choice — friendly fire in AoE would make group-PvP unplayable, but it would also gut the cost of an indiscriminate AoE on a crowded street, so Honor − is scored at full magnitude regardless of suppression (Doc #5 §2).

### 4.3 Looting Rules on Death

When a player Avatar dies on Chaos, their corpse is created per Doc #16 §8 and Doc #15 §3.7 corpse rules, with PvP-specific access:

```ts
type PlayerCorpseAccess = {
  // OwnershipComponent.owner = the dead player (cannot be looted by them, they're dead)
  primary_looter:  EntityId       // the killing-blow player; gets first-loot window
  loot_window_s:   30             // first-loot exclusive window
  open_after_s:    30             // after window: any player can loot
  decay_at:        ServerTick     // 5 minutes; corpse despawns, remaining items fall to ground
}
```

Loot rules:

1. The killing-blow player has 30 s of exclusive access to the corpse's contents.
2. After 30 s, any player can access the corpse for the next 4 minutes 30 s.
3. After 5 minutes total, the corpse despawns; any remaining items spawn as loose entities on the corpse tile (visible to all, lootable normally per Doc #18). Decay timers on the now-loose items begin per Doc #4.1 §3.1.
4. Items inside containers inside the corpse are accessible per Doc #15 §5.2 cascading rules — there is no special "corpse container" protection; nested bags can be looted.
5. Blessed and insured items (§4.4) are excluded from the lootable inventory; they remain bound to the dead player and rematerialize on resurrection.
6. The killer's Honor scoring (§5.1) takes the full inventory value into account: looting nothing → Honor neutral; looting only weapons/armor (combatant gear) → Honor − small; looting consumables and gold → Honor − moderate; looting personal effects (letters, pets, family heirlooms — items with `OwnershipComponent.sentimental_flag = true`) → Honor − large.

### 4.4 Item Insurance & Blessed Slots

On Chaos, players may insure or bless items to prevent loss on death.

| Mechanism | Cost | Item count cap | Behavior |
|---|---|---|---|
| **Blessed slot** (per character) | Free; one per character at level 1, +1 per 5 character levels | Up to 4 by level 16 | Blessed items never drop on death; they persist on the corpse-belonging-to-the-dead-player ledger and are returned at resurrection. |
| **Insurance** (per item) | 600 gp per insured item per death (paid from bank to killer's Murder Insurance Pool, §5.5 bounty system) | Unlimited; scales with player wealth | Insured items also persist; on death, gold debited from bank; if bank is empty, insurance fails and item drops as normal loot. |
| **Newbie items** | Free | Auto-flagged at character creation | Tutorial-given starter dagger and torch are blessed by default; cannot be transferred; auto-deleted if player drops them. |

Insured-but-broke fail-state design choice: rather than refusing to die or partially-insuring, the server resolves alphabetically by item name — the player gets explicit knowledge of which items were saved and which were not in the death summary screen (§4.7). This makes failure-state predictable and not a hidden RNG outcome.

Items locked in a player's bank vault are never lootable, period (Doc #18 §11 banking).

### 4.5 Stat / Skill Loss

In Phase 2 launch, **stat and skill loss on death is OFF** for all Chaos shards. The reasoning: classic UO Felucca had stat loss tied to murderer resurrections; modern players overwhelmingly reject the experience, and we have other levers (item loss, Notoriety, bounty) to make death cost something. We log this as a deliberate Phase 2 deviation from the `[UO]` template.

A "Hardcore Chaos" toggle is reserved for Phase 3 (§12 [OPEN]). The current Phase 2 spec for that future toggle:

- Resurrection by Healer NPC (Doc #15 §4.2 Ankh of Renewal): 0% skill loss, no stat drift.
- Resurrection by `cast_spell(in_mani_corp)` from another player: 5% skill drift on top 3 skills, recoverable through normal use within 1 hour.
- Resurrection by self-spawn at shrine: 10% drift on top 5 skills, plus a 2-minute "Weakened" debuff (-25% damage and -25% incoming damage; cannot resist any spell).
- Stat drift only applies if the killer was another player. PvE deaths do not trigger drift even on the Hardcore toggle.

Until Phase 3, `[OPEN]` see §12 item 1.

### 4.6 Faction System

Faction enrollment is the long-form, persistent declared-war framework. It is to guild wars (§4.7) what an army is to a duel.

#### 4.6.1 Two Factions

Per Doc #5 Order/Chaos virtue framing and the historical Britannia lore arc:

| Faction | Theme | Recruiter | Aligned Virtues (scored bonus) | Hostile Virtues (penalty for actions) |
|---|---|---|---|---|
| **Order** | Lord British's standing army; defenders of Britannia | Sir Geoffrey, Britain Castle | Justice, Honor, Compassion | (none — Order is the Virtue baseline) |
| **Chaos** | Lord Blackthorn's heirs (post-canon split); revolutionary faction | Hawkwind's apostate, Buccaneer's Den | Valor, Honor, Spirituality | Compassion (when killing innocents to advance faction goals) |

Both factions are valid Virtuous paths in the BR ethical framework; "Chaos" is not "Evil." This is critical for Doc #5 alignment — Chaos players can still be high-Virtue Avatars. The naming maps the faction to the *political* alignment; the *moral* alignment is scored independently per Doc #5.

#### 4.6.2 Enrollment

- Player must be character level 2+ (prevents alt-spam recruiting).
- Player must speak the appropriate keyword to a recruiter NPC (Doc #17 §3 dialogue).
- Enrollment cost: 500 gp + a 24-hour cooldown after any prior faction departure.
- On enrollment: `Avatar.FactionComponent` set; halo color updates; player is now a valid PvP target for the opposing faction in any Chaos region (no consent step required).
- Enrolled players gain access to faction-only vendors, faction tokens (§10.2), and faction-only spell scrolls (some unique).

#### 4.6.3 Departure

- A player may depart a faction at any time but loses all faction tokens, faction-only items become unequippable (kept in inventory but greyed out), and a 24-hour cooldown begins before re-enrollment (in either faction).
- Departure does not retroactively undo Murder Counts earned during faction service.

#### 4.6.4 Alignment Shift via Virtue System

A player's Virtue scores nudge their faction recruitment: a player with high Justice + high Honor receives in-game letters of invitation from the Order recruiter; a player with high Valor + high Spirituality but low Compassion receives equivalent from Chaos. These are flavor / discoverability hooks; the actual enrollment decision is always the player's.

A player whose Virtue scores swing dramatically while enrolled (e.g., an Order knight whose Justice falls below 30) receives a warning letter from their faction; if Virtue does not recover within 14 in-game days, the faction expels them automatically (forfeit all tokens, 24 h cooldown).

#### 4.6.5 Faction Strongholds

Each faction holds 1–3 strongholds (regions per Doc #6 §2 spatial partitioning) with `RegionPvpPolicy.faction_only != "any"`:

- Inside their own stronghold, a faction's members get +25% Hits regen, free reagent vendor, and faction guards (NPC defenders).
- Inside the opposing faction's stronghold, members are flagged Aggressor (§5.3) automatically and faction guards engage.
- Strongholds can be captured (§6.3 sieges) — capture flips the stronghold's `faction_only` to the conqueror's faction for a configurable duration.

### 4.7 Declared Guild Wars

A guild war is a smaller, more targeted PvP framework available on **both** Order and Chaos shards.

| Step | Action | Notes |
|---|---|---|
| 1 | Guild master invokes `declare_war(target_guild_id, terms)` MCP/UI verb | Terms include: duration (24h–30d), stake (gold pool, optional item bet), arena (specific region or world-wide), kill cap (optional). |
| 2 | Target guild master accepts or declines within 24 h | Decline: war does not start. No-response: war does not start. |
| 3 | War active: members of both guilds can attack each other in any non-sanctuary region | On Order shards, this is the **only** way to PvP attack a non-arena player; on Chaos, war participants get an additional Notoriety exemption (§5.1) — kills do not increment Murder Count if both parties are at war. |
| 4 | War ends on duration timeout, kill cap reached, or mutual disbandment | Stake released to winner per terms; loser's stake locked for 7 days (cooldown). |

Declared war is the primary opt-in PvP affordance on the Order shard. It is the only mechanism by which Trammel-equivalent PvP exists. No more than 1 active war per guild at a time (prevents perma-war griefing); guild-leadership rate-limit per Doc #32 §4.

---

## 5. Reputation, Notoriety & Bounty

This is the public-facing layer of PvP — what other players see about your in-character identity.

### 5.1 Virtue-Adjusted Scoring on Chaos

The Virtue Engine (Doc #5) does not pause on Chaos. PvP kills score Virtue, but with Chaos-specific rules:

| Action on Chaos | Virtue Deltas |
|---|---|
| Kill another player flagged Aggressor (§5.3) toward you | Valor + (small), Compassion 0, Justice 0, Honor 0 — self-defense |
| Kill another player flagged Criminal | Valor + (small), Justice + (small) — vigilante kill |
| Kill another player who is Innocent (not Aggressor, not Criminal, not at war) | Compassion − (large), Justice − (large), Honor − (moderate); Murder Count +1 |
| Kill another player who is in a faction war with you | Valor + (small), Honor + (small if combat was fair: similar level, no AOE bystander damage) |
| Kill in a duel (consented arena) | Valor + (small), Honor + (small if won within rules) |
| Kill another player from invisibility / sleep / paralysis | Apply above plus Honor − (large) — striking from concealment |
| Loot a corpse | Per §4.3 — Honor − scaled by item type |
| Resurrect-kill (§7.2 violation attempted but blocked) | No score (system blocked the act); Honor − applied for the attempt itself |
| Kill in self-defense after being unprovokedly attacked | No Murder Count; Valor +; Honor + |

The Virtue penalties for murdering Innocents on Chaos are *higher* in absolute magnitude than the equivalent NPC-murder penalties on the Order shard, by 50%. The reasoning: PvP victims are sentient agents, not scripted NPCs, and the Virtue Engine ought to weigh the harm proportionally.

### 5.2 Murder Counts

Murder Count is a Chaos-only, persistent, per-Avatar integer counter.

```ts
type MurderCounts = {
  short_term:    int      // [I] kills in last 8 in-game hours; decays 1/hr
  long_term:     int      // [I] career total of innocent kills; never decays
  last_kill_at:  ServerTick | null
}
```

- A "murder" is the kill of a player who was Innocent at the time of the killing blow (per §5.3 flag state at the moment damage drops their hp ≤ -10).
- Faction-war kills, declared-guild-war kills, and self-defense kills do NOT increment Murder Count.
- Short-term decays one count per real-time hour of the killer being logged in (idle / AFK detection per Doc #28 §7 — must show input activity to count as "logged in" for decay purposes; defends against AFK-decay exploits).
- Long-term never decays; it is the Avatar's permanent record.

### 5.3 Aggressor / Criminal / Innocent Flags

Live flags on each player Avatar, recomputed on any combat event:

| Flag | Onset | Duration | Effect |
|---|---|---|---|
| **Innocent** | Default state | Until Aggressor/Criminal trigger | Killing them increments Murder Count (§5.2); guards defend them in guard zones. |
| **Aggressor** (towards X) | Player attacks X without prior provocation; player damages X with AoE without prior consent | 2 minutes after last attack on X; reset by another offense | While Aggressor towards X, X may kill them with no Murder Count for X. Aggressor is *directional* — A is Aggressor towards B, but not towards C unless A also attacked C. |
| **Criminal** | Player commits a Doc #5 §4 crime in public (theft, assault, looting in guard zone, casting offensive spell on Innocent in town) | 2 minutes | All players may attack them with no Murder Count and no Aggressor flag of their own; town guards become hostile (§6.1). |
| **Murderer** (notorious) | Long-term Murder Count > 5 | Permanent until decay below 5 | Halo turns red (§5.4); cannot enter towns without guards attempting arrest; may not teleport to public moongates. |

The Aggressor / Criminal distinction matters: Aggressor is a private debt (between two specific players), Criminal is a public debt (society's response).

### 5.4 Notoriety Tiers & Halo Visualization

Other players on Chaos see a paperdoll halo color over Avatars within visual range:

| Tier | Long-term Murders | Halo |
|---|---|---|
| Honored | 0, with Honor + Justice high | Gold |
| Innocent | 0 | Blue |
| Aggressor (towards viewer only) | n/a | Grey to viewer; blue to others |
| Criminal (active) | n/a | Red, blinking, 2-min duration |
| Murderer (low) | 1–4 | Orange |
| Murderer (notorious) | 5–9 | Red |
| Murderer (infamous) | 10+ | Red, with skull icon |

The tier is visible by paperdoll examination (Doc #15 §6.1) and via `forge://shard/{s}/avatar/{id}/notoriety` MCP resource (§13).

### 5.5 Guard Zones

In any guard zone (per §2.3), NPC guards (Doc #5 §5 guard system, Doc #6 §5 anti-griefing) respond to combat actions:

- A Criminal flag triggers immediate guard response within the same region; guards path to the Criminal (Doc #23 pathfinding) and attempt arrest (`attack(intent="strike")` with stun-rod weapon: paralyzes the criminal for 30 s, then teleports them to a jail cell instance).
- A Murderer (long-term ≥ 5) entering a town tile triggers a guard alert; guards engage on sight; they cannot be conversed with.
- An Aggressor toward an Innocent in a guard zone triggers guard response towards the Aggressor (which is why Aggressor flags last 2 minutes — long enough for guards to arrive and resolve).
- Guards always win 1v1 against any player at any level (their `Combat` stats are scaled to Avatar level + 5 baseline). The system is balance-by-flat — players who fight guards are expected to lose.

### 5.6 Bounty System

Other players may place a bounty on a Murderer.

```ts
type Bounty = {
  bounty_id:   UUID
  target:      AvatarId
  poster:      AvatarId
  amount:      int          // gold; minimum 100, maximum 1,000,000
  posted_at:   Timestamp
  expires_at:  Timestamp    // 30 days default
  claimed_by:  AvatarId | null
}
```

- A bounty is posted at a Bounty Board NPC (one per major town); poster pays the gold up front (locked from bank).
- A bounty target sees their bounty on the board (anonymous poster); cannot un-bounty themselves.
- A bounty is claimed by killing the target; the killer presents the corpse's `entity_id` to the Bounty Board NPC within 1 hour of the kill; gold transfers.
- Bounty kills score same as any murderer-kill — a Bounty Hunter is just a player who got paid for what they would have done anyway.
- Bounty Hunters may opt-in (§3.2) to a Bounty Hunter title, which makes their halo green and gives them a +10% gold loot bonus from Murderer corpses; the price is they cannot place bounties themselves (no laundering money through the bounty system).

Bounty system integrates with Doc #18 economy (gold flow), Doc #28 telemetry (bounty-board posts as live ops events), Doc #29 moderation (suspicious bounty patterns flagged).

---

## 6. Open-World PvP Zones, Dungeons, Sieges, Town Control

### 6.1 Wilderness PvP

The default Chaos shard wilderness is open PvP. No guards, no consent, no protection beyond §3.5 sanctuaries and §3.3 absolute-rules. Travel is hazardous; this is by design.

Wilderness regions are tagged in the world map UI with a red outline (vs. green for safe Order regions, yellow for guard-zone Chaos regions). Recall and gate-travel destinations show the destination region's PvP status before commit.

### 6.2 Dungeons

Dungeon regions on Chaos are open PvP with two amplifications:

- **Champion spawns** (§10.1 reward economy) only spawn in Chaos dungeons. A champion spawn is a multi-stage NPC encounter that culminates in a unique boss drop (§10.1 rare drops) and is intended to be group content. The PvP angle: another guild can show up and attempt to wipe the engaged group at the most vulnerable moment (boss phase) and steal the kill. This is intended emergent content, not a bug.
- **Dungeon-only loot tables**: certain rare items (§10.1) drop from Chaos dungeons exclusively. Order shard dungeons have lower-tier equivalents.

### 6.3 Sieges & Town Control

The Phase 2 launch features one siege loop: **Faction Stronghold Capture**.

- Each faction holds 2 strongholds at launch (Order: Britain Castle outer wall, Yew sheriff's tower; Chaos: Buccaneer's Den keep, Wrong dungeon).
- A stronghold is "active" for capture when its `siege_window` opens — a 4-hour window every 48 hours, scheduled differently per stronghold for time-zone fairness (§12 [OPEN] — exact schedule).
- During the siege window, the opposing faction may attempt to plant a Sigil (faction artifact entity) on the stronghold's command tile.
- Sigil planting takes 2 minutes of channeling; channel interrupts on damage to the planter.
- If the Sigil completes, the stronghold flips to the attacking faction for the next 48 hours, with all the §4.6.5 benefits.
- Defenders earn faction tokens (§10.2) for kills and for successful defense; attackers earn faction tokens for kills and for successful capture.

Tournament-style and other live ops events (Doc #28 §6 live ops) may schedule additional siege windows beyond the regular cycle.

### 6.4 Player Housing in PvP

Per Doc #6 §4 housing is per-player or per-guild instances. PvP-relevant rules:

- Houses on Chaos shards can be **friend-listed**; non-friends are hostile-attackable upon house entry (`pvp_enabled = true` inside).
- **Friend lists** are owner-managed (UI in Doc #15 §6.4 paperdoll-equivalent home interface).
- House lockboxes (special containers inside player houses) are PvP-attackable (`attack` verb with hammer-tool weapon) but require ~10 minutes of repeated hits to break, with audible alarms broadcast to all adjacent regions; gives owners and friends time to respond.
- Once a lockbox is broken, contents are full-loot for the breaker.
- Houses themselves cannot be destroyed (anti-grief, see §7); only their containers can be raided.

---

## 7. Anti-Grief

### 7.1 Log-Out Timers in Combat

A player attempting to log out while in combat enters a **Combat Logout Timer**:

- "In combat" is defined as: damaged or attempted-to-damage another player within the last 30 s, OR has the Aggressor flag towards any player, OR the Criminal flag.
- Attempting to log out (game-quit verb) shows a 30-second countdown; during this time the player's Avatar remains on the shard, fully attackable, with the Combat Logout flag visible on the paperdoll.
- A successful kill on a logging-out player drops their loot per normal Chaos rules.
- If the player force-kills the client process, the server holds the Avatar in-world for the remainder of the 30 s anyway, AI'd as an `Idle` NPC (does not fight back).
- Network drops (legitimate disconnect, not rage-quit) are detected by heartbeat (Doc #22 §3) and follow the same 30 s lingering rule, but the `actor_dropped` telemetry flag is set so we don't false-flag legitimate disconnects as attempted log-out abuse.

### 7.2 Resurrection-Kill Protection

After a player resurrects (Doc #16 §8 resurrection), they receive a **Res-Kill Protection** buff:

- 60 seconds of `victim_protection`: cannot be attacked, cannot attack, cannot pickpocket or be pickpocketed, cannot loot or be looted.
- The buff drops the moment the player invokes any combat or pickpocket verb, OR after 60 s elapsed, whichever first.
- Res-Kill Protection is applied at the Healer NPC instance (sanctuary, §3.5) and at any shrine resurrection point.
- A player who logs out within 60 s of resurrection has the buff persist on their next login, but only if next login is within 5 minutes (anti-exploit — don't let a Res-Kill bypass be saved for later).

### 7.3 Account-Wide Kill Cooldowns

To prevent farming a single victim:

- After Player A kills Player B, A cannot earn Murder Count from killing B again for 1 hour (game time, real-time clock; not in-world hour).
- A is still mechanically allowed to attack B; the kill simply doesn't count toward A's career stats or Notoriety progression.
- Cooldown is account-wide: A on a different character on the same shard cannot bypass it.
- Cooldown applies to bounty claims as well: A cannot claim a bounty on B if A killed B in the past 1 hour without a bounty in place at the time of kill.

This effectively makes the optimal "bully" pattern (camping a low-level Avatar) unprofitable and rate-limited.

### 7.4 Exploit Categories

The following are explicit named anti-grief targets, each with its detection mechanism:

| Exploit Category | Pattern | Detection (Doc #32 §12 bot heuristics) | Response |
|---|---|---|---|
| **Res-kill camping** | Killer waiting at a player's known res point repeatedly | Spatial clustering + temporal repetition; kill timestamp distribution | Invalidate kill counts; apply Aggressor with no decay for 1 hour; auto-flag for moderation review |
| **Body-block exploit** | Multiple players surrounding a victim's path-out tiles to lock them in for kills | Pathfinder failure rate spike + adjacency persistence | Server snaps blocked player out via emergency teleport (1 tile in random direction); attackers throttled |
| **Logout-cheese** | Player logs out mid-combat to avoid death (vs. §7.1 30 s timer) | Attempted exit while flagged in combat | Standard timer enforced; repeat offense → moderation queue |
| **Insurance laundering** | Player uses alt to "kill" their main and "loot" insured items to dodge insurance fee | Account-graph analysis (Doc #32 §15 cross-actor correlation) | Insurance refund denied; Murder Count voided as fake; both accounts flagged |
| **Aggressor stacking** | Player triggers Aggressor flag on many victims simultaneously to delegitimize their attackers | Volume of damage events to distinct targets per second | Rate-limit per-actor Aggressor count to 5 distinct targets / 60 s; over-cap rejected as `ERR_AGGRESSOR_LIMIT` |
| **Champion swoop** | Wait for boss-fight final phase, AOE the engaged group, claim the kill | Detected as legitimate behavior (not exploit); but: if pattern repeats with same actors, suspect coordination |
| **Macro-grief** | Bot client farming Murder Counts on alts | Doc #32 §12 standard bot detection signals | Standard Doc #32 ladder: throttle → CAPTCHA → moderation review → ban |
| **Fake corpse loot** | Killer manufactures a fake corpse via UGC to bait a "looter" who then accidentally Criminal-flags themselves | UGC corpse creation in proximity to ambush patterns | UGC corpse entities flagged as non-lootable by default; explicit owner consent required to make UGC corpse lootable |

### 7.5 Victim Protection States

Beyond Res-Kill Protection (§7.2), the system has graded victim protection:

| State | Trigger | Duration | Effect |
|---|---|---|---|
| `victim_protection` | Resurrection (§7.2); charm-expiry (§3.6); guard rescue | 30–60 s | Cannot attack; cannot be attacked |
| `safe_zone` | Inside sanctuary (§3.5); inside own house (non-PvP setting) | While inside | Cannot attack; cannot be attacked |
| `combat_logout` | Attempting log-out while in combat (§7.1) | 30 s | Cannot attack; CAN be attacked (this is the cost of trying to dodge) |
| `noob_immunity` | New character, level 1 only | First 4 hours of play OR until level 2 | Cannot attack OR be attacked |

Noob immunity is a Phase 2 launch protection — without it, Chaos shards become hostile to new players before they have any way to defend themselves. Veterans may opt out at character creation for a small cosmetic reward (`Bold New Avatar` title).

### 7.6 Reporting & Appeal

Doc #29 moderation tools surface a `report_pvp_incident` verb available from any post-death screen. Reports route to the moderation queue; clearly griefing patterns (per §7.4) are auto-flagged. Players may appeal a flag/ban via Doc #29 appeals process. False reports are tracked; serial false-reporters lose reporting privileges.

---

## 8. Combat Latency & Replication Concerns (PvP-specific)

This section is Chaos-shard tactical detail; the broader replication doc is Doc #22.

### 8.1 Tick Rate Considerations

Per Doc #22 §3, server simulation is 20 Hz (50 ms). PvP fairness considerations:

- A 50 ms tick floor means two players' attacks resolved in the same tick may both land — there is no hidden "first-to-claim-the-tick" advantage.
- Network state broadcast at 10 Hz means a player's last-known position to other clients lags by up to 100 ms. Hit detection is server-authoritative (Doc #32 §7) using server-known positions, not client-rendered positions; this means a player who sees their target on-screen may technically miss because the server-side target moved.
- Client-side aiming is a hint, not a claim. The server resolves the actual target.

### 8.2 Lag Compensation

For PvP:

- The server records each Avatar's authoritative position history (last 500 ms = ~10 broadcasts).
- On `attack` resolution, the server uses the *attacker's* perception time-shifted by the attacker's reported RTT, capped at 200 ms. This is the Doc #22 §6 lag-compensation pipeline applied to combat.
- Above 200 ms RTT, lag compensation is disabled (the player gets no compensation; their attacks resolve from server-current state). This is intentional — high-ping players have a worse PvP experience by design, because pure compensation creates "shoot around corners" scenarios.
- A PvP-specific telemetry signal (`pvp_kill_with_high_rtt`) is logged whenever a kill occurs with RTT > 250 ms; suspicious patterns (kills with consistently high RTT, suggesting a deliberately-laggy client to confuse compensation) are flagged for review.

### 8.3 Anti-Cheat Surface (PvP-specific)

Doc #32 covers the general anti-cheat surface. PvP-specific additions:

| PvP Threat | Mechanism | Defense |
|---|---|---|
| Position-claim cheat (claim to be in a different tile to dodge attacks) | Modified client | Server-authoritative position; client claims rejected (Doc #32 §6) |
| Damage-claim cheat (claim to deal more damage) | Modified client | Damage computed server-side (Doc #32 §7); client claims rejected |
| Murder Count manipulation | Crafted packet | Murder Count is server-only field; not in any client-writable state |
| Notoriety-tier visualization spoofing (display low halo to lure victims) | Modified client | Other players' clients render halo from server-broadcast EntityDelta; spoofed-attacker display only deceives the spoofer's own UI |
| AFK loot-camping | Bot at corpse | Doc #32 §12 bot signals; corpse-loot-without-other-input pattern flagged |

---

## 9. Cross-Shard Interaction Limits

### 9.1 No Outbound Item Transfer from Chaos

This is the hard wall. Items obtained on a Chaos shard cannot be moved to an Order shard, ever. The mechanisms:

- The cross-shard moongate (Doc #6 §2) checks every Avatar's inventory at transit; any item with `chaos_shard_origin = true` set in its persistence record is left behind (deposited in the source Chaos shard's bank vault for later retrieval *back on Chaos*).
- The `chaos_shard_origin` flag is set at Entity creation and is immutable. Even if the item is "cleansed" by passing through other players, the flag persists.
- Insurance gold paid on Chaos cannot be withdrawn on Order; the bank ledgers are separated by shard.
- The flag is also checked during friend-trade (Doc #18 §9 trade two-phase commit) — a trade between an Order Avatar and a Chaos Avatar (only possible during the rare cross-shard moongate moment) is blocked at item level.

### 9.2 Restricted Inbound Transfer to Chaos

Items can enter Chaos from Order, with restrictions:

- The arriving Avatar's `chaos_shard_origin` flag is set on every item carried at transit. Once on Chaos, the items can be dropped, traded, looted normally — but they can never go back to Order.
- This is intentionally one-way: it lets a curious Order player visit Chaos with their gear (and potentially lose it), but prevents Chaos players from "laundering" their gains by trading to a friend who walks them back to Order.

### 9.3 Reputation & Murder Counts: Per-Shard Persistence

- Avatar Virtue scores (Doc #5) are global across shards, but the `MurderCounts` struct (§5.2) is per-shard. A player who is a Murderer on Chaos is just a normal Avatar on Order.
- Faction enrollment (§4.6) is per-shard (factions only exist on Chaos in Phase 2).
- Account-wide kill cooldown (§7.3) is per-shard (cannot bypass by cross-shard movement).
- Bounties placed on a Chaos Avatar do not transfer if the Avatar moves shards.

### 9.4 Cross-Shard Communication

- Global chat channels (Doc #6 §4) are shard-scoped. There is no chat between Chaos and Order shards.
- Out-of-game communication (forums, Discord) is unrestricted; players who coordinate across shards via external tools are the player's prerogative.
- The Bounty Board NPC will show only same-shard bounties.

---

## 10. Reward Economy on Chaos

If Chaos is more dangerous, Chaos must also be more rewarding — but rewards must not be so far ahead that Order players feel forced to play Chaos to keep up. Rewards on Chaos are *different in kind*, not just more numerous.

### 10.1 Rare Drops & Champion Spawns

- **Champion-spawn boss drops** (§6.2): rare items with `chaos_only = true`. Visual/cosmetic uniqueness (tinted weapon glow, animated effects), modest mechanical edges (e.g., +2 damage, +5% crit chance — within the Doc #16 §3 damage-formula envelope so as not to break PvE balance).
- **Powerscroll drops**: at level cap (Doc #15 §3.4), a Powerscroll allows raising one skill cap by +5 (e.g., Combat 100 → 105). Powerscrolls drop only from Chaos champion spawns. They are tradable on Chaos; cannot leave (§9.1).
- **Faction-only artifacts**: certain weapons and armor only buyable with faction tokens (§10.2); cosmetically distinct.

The dimension along which Chaos rewards exceed Order rewards is *prestige and customization*, not raw stat power. A Chaos veteran has visibly different gear; an Order veteran has the same gear's stat-equivalent in a less ornate form.

### 10.2 Faction Tokens

Factions have their own currency (Doc #18 §3 currency types extended). Tokens earned via:

- Faction-war PvP kills: 5 tokens per kill of an opposing faction member at similar level (level-scaled to prevent farming).
- Successful stronghold defense: 50 tokens per defender on successful defense.
- Successful stronghold capture: 100 tokens per attacker on successful capture.
- Faction quest completion (Doc #19 quest system): 10–50 tokens per quest.

Tokens are spent at faction-only vendors (§4.6.5 strongholds) on faction-specific items. Tokens cap at 10,000 per Avatar (prevents hoarding-for-power-spike; encourages spending).

### 10.3 Leaderboards

Chaos-shard public leaderboards (visible at the city herald NPCs and in `forge://shard/{s}/leaderboards/...` MCP resource):

| Leaderboard | Metric | Tier prizes |
|---|---|---|
| Notorious Murderers | Long-term Murder Count, descending | Cosmetic title; halo style; #1 gets monthly statue in Buccaneer's Den |
| Bounty Hunters | Bounties claimed, descending | Cosmetic title; gold bonus |
| Faction Tournament | Faction tokens earned this month | Faction title; rotating weekly |
| Stronghold Defenders | Successful defenses participated | Cosmetic title |
| Survivors | Time on Chaos without dying | Cosmetic title; rare cosmetic mount; very dorky to chase |
| Ironman | Hardcore-Chaos toggle (Phase 3) leaderboard | Reserved [OPEN] |

Leaderboards reset monthly; archived (`forge://shard/{s}/leaderboards/archive/{month}` resource).

### 10.4 Rare Cosmetics & Titles

Both shards have cosmetics; Chaos has *Chaos-themed* cosmetics that Order does not. Examples: the "Bandit's Cloak" drop from Wrong dungeon, the "Pirate's Eyepatch" drop from Buccaneer's Den siege, etc. These are flavor, not power.

### 10.5 Order-Shard Reward Parity

Order shards have their own equivalent prestige system based on:

- Virtue mastery (Doc #5 §6 attainment): all eight Virtues to 100 unlocks the **Avatar of Virtues** title (canonical lore — the Avatar's destiny). This title is statistically harder to earn than any Chaos leaderboard rank; it is the Order shard's equivalent prestige peak.
- Crafting mastery (Doc #18 §6): reach the cap on a profession (e.g., Grandmaster Smith).
- Storyline progression: complete the entire main canon (Doc #2 §3, includes Black Gate climax).

The two shards' prestige systems are deliberately incomparable — a Chaos-veteran title and an Order-Avatar title are both meaningful, but in different dimensions.

---

## 11. Tournament & Arena Modes

Arena modes are instanced, no-loot, no-Virtue-impact PvP — available on both Order and Chaos shards.

### 11.1 Arena Region

```ts
type ArenaRegion = {
  arena_id:        ArenaId
  capacity:        int
  ruleset:         ArenaRuleset
  loot:            "none"          // always
  stat_loss:       "none"
  virtue_impact:   "none"
  duration_sec:    int              // round timer
  victors_share:   GoldAmount       // entry-fee pool * 0.9; 10% house fee
}

type ArenaRuleset =
  | { kind: "duel_1v1",     allow_spells: bool, allow_potions: bool }
  | { kind: "team_3v3",     teams: [Party, Party] }
  | { kind: "free_for_all", max_players: int }
  | { kind: "capture_flag", teams: [Party, Party], flag_count: int }
  | { kind: "tournament",   bracket: BracketSpec }
```

### 11.2 Entry & Stakes

- Players queue at an Arena Master NPC in any major town. Queue time gives a 60 s rejoinder window for lobby formation.
- Entry fee (optional): players may stake gold (or items, with item-staking enabled per ruleset). Stake is server-escrowed; winner takes pool minus 10% house fee.
- No-stake matches are free; for fun, leaderboard rank only.

### 11.3 Arena Replication

The arena is a full UE5 instance (Doc #6 §2 "Instance Layers"); fully isolated from the shard's persistent simulation. Verbs against arena entities resolve in arena context only; nothing persists out of the arena except gold transfers and a leaderboard win/loss row.

### 11.4 Tournament Brackets

- Single-elimination, double-elimination, or round-robin per `BracketSpec`.
- Live ops (Doc #28 §6) may schedule shard-wide tournaments with seeded brackets and prize pools sourced from server-event budgets.
- Tournaments stream observable to all Avatars via a "spectate-arena" verb (Doc #15 §6.5 spectator mode); spectators in third-person camera mode (Doc #15 §6.4 camera mode toggle).

### 11.5 Friendly Duels

A faster, fully consensual format on any shard:

- `request_duel(target_avatar_id)` — player A invokes; B's UI prompts accept/decline.
- On accept, both players enter a 5-second countdown, then a private duel zone instance materializes around them (10×10 tile no-loot zone).
- Duel ends on first-blow or first-death (configurable at request time).
- Same no-loot, no-Virtue rules as arena.

Friendly duel is the way Order-shard players PvP for fun without declaring formal guild war.

---

## 12. Open Questions

1. `[OPEN]` **Hardcore Chaos toggle** (§4.5 stat-loss). Phase 3 feature; the design here is preliminary. Must validate against playtest data once Phase 2 launches; specifically, whether Notoriety and item-loss are sufficient consequences without stat-drift, or whether old-school players will demand stat-drift as authenticity.
2. `[OPEN]` **Faction-stronghold siege schedule** (§6.3). The 4-hour-window-every-48-hours schedule needs time-zone-sensitive rotation to avoid systematically disadvantaging any geographic region. Possible solution: anchor schedule to UTC offset cycle (every stronghold's window shifts by 4 h per cycle, covering all time zones over a 12-cycle period).
3. `[OPEN]` **Cross-shard moongate item-flag enforcement edge cases** (§9.1). What happens to nested containers? If a Chaos-origin chest contains an Order-origin sword, does the sword retain its Order-origin flag and remain transferable to Order? Probably yes (per-item flag is the design), but item-in-container UI must correctly indicate which sub-items will be left behind at transit; needs a UI mockup.
4. `[OPEN]` **Phase 2 Charm-on-player consent gate** (§3.6). The Aggressor-or-faction-war pre-condition is a soft consent gate, but some players may consider it insufficient. Consider an opt-in toggle per Avatar for "I consent to be charmed" — adds complexity but more conservative on player agency.
5. `[OPEN]` **Bounty system money laundering**. A Bounty Hunter title cannot place bounties (§5.6) but two cooperating Bounty Hunters cannot directly fund each other. Monitor for bounty-clusters via Doc #32 §15 graph analysis; tighten constraints if exploitation patterns emerge.
6. `[OPEN]` **Murder Count decay during AFK detection edge case**. §5.2 says "must show input activity" for short-term decay. But what counts as "input activity"? Mouse movement? Verb invocations? Need precise definition; risk of either AFK-decay exploit (low input threshold) or unfair non-decay (high threshold for legitimate idle behaviors like reading lore books).
7. `[OPEN]` **Faction balance**. Initial balance assumes equal recruitment between Order and Chaos factions on Chaos shard. If one faction dominates 70%+ of population, the smaller faction's PvP becomes hopeless. Possible levers: dynamic recruitment bonuses, scaled token rewards, scaled stronghold defender stats. Not yet specified; must wait for Phase 2 telemetry.
8. `[OPEN]` **Resolving the Order-shard "consent-only PvP" via declared war** (§4.7). What if a guild master declares war frivolously (e.g., on a guild that exists only to roleplay)? Decline path is in spec, but does the *declaring* guild get any cost for a frivolous declaration? Suggestion: a 10,000 gp filing fee, refunded only on accepted war. Defer to Phase 2 economy tuning.
9. `[OPEN]` **Spectator capabilities in arena tournaments** (§11.4). Should spectators have any verb access (cheering, betting on outcomes, in-arena chat)? Betting introduces money-flow concerns (Doc #18). Cheering / chat is low-risk but uses replication bandwidth. Suggest spectator mode allow chat + cosmetic cheer emote; betting deferred.
10. `[OPEN]` **Houses in PvP — anti-grief** (§6.4). Lockbox-break in 10 minutes might be too short for offline owners. Should there be a per-house "owner active recently" gate (e.g., raid window only opens if owner has logged in within last 7 days)? Or longer break-in time when owner is offline? Affects anti-grief vs. siege-realism balance.
11. `[OPEN]` **Chaos-only NPC factions for hire**. Should Chaos shards include NPC mercenaries (paid party-up companions) as a balancing aid for solo players? Doc #15 has Companion framework; a paid-mercenary variant is a small extension. Affects solo-vs-group PvP fairness on Chaos.
12. `[OPEN]` **Reputation export / single-player canon**. If a Chaos veteran wants to import their character to the single-player Classic shard for a campaign run-through, are their Murder Counts visible there? Probably not (Classic is a different timeline), but design intent should be explicit. Intersects Doc #21 save format.
13. `[OPEN]` **PvP balance for spell circles**. The Doc #16 §5 spell roster is `[OPEN]` (Doc #16 §13 item 1). PvP balance must inform that spec — some single-player-balanced spells (e.g., area sleep) become unfair on Chaos. Recommend: PvP-aware spell balance pass concurrent with Doc #16 spell roster finalization.
14. `[OPEN]` **Telemetry for false-positive Aggressor flags**. AOE collateral damage on a non-target sets Aggressor; ideally we distinguish accidental vs. intentional. Heuristic difficulty; deferred to Doc #28 telemetry once data collection begins.
15. `[OPEN]` **Murder Count visibility to non-targets**. Does every player see another player's long-term Murder Count? Right now §5.4 says yes via halo. But should the *exact* count be visible only via an Examine action, vs. broad "tier" alone? Suggestion: tier from halo, exact count from Examine — defer for UX testing.

---

## 13. Cross-Document Integration & MCP Surface Additions

### 13.1 Cross-Doc Map

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #2 §1 §6, Doc #5 §1, Doc #6 §4 |
| §2 Shard Taxonomy | Doc #6 §2 (extends), Doc #21 (per-shard persistence) |
| §3 Chaos Ruleset | Doc #16 §2 §10 (combat, MP pause), Doc #5 §2 §4 (Virtue scoring), Doc #16 §13 [OPEN] item 4 (resolves Charm in PvP) |
| §4 PvP Combat Rules | Doc #16 §2 §3 §7 §8, Doc #18 §3 §11 (gold + banking) |
| §5 Reputation/Notoriety | Doc #5 (Virtue), Doc #15 (paperdoll halo) |
| §6 Open-World Zones / Sieges | Doc #6 §2 (regions), Doc #23 (pathfinding), Doc #28 §6 (live ops) |
| §7 Anti-Grief | Doc #32 §3 §6 §7 §12 §15 (anti-cheat), Doc #29 (moderation) |
| §8 Latency / Replication | Doc #22 §3 §6 §11 |
| §9 Cross-Shard Limits | Doc #6 §2 (shard travel), Doc #21 (per-shard tables), Doc #18 §9 (trade) |
| §10 Reward Economy | Doc #18 §3 (currency), Doc #15 §3.4 (skill cap) |
| §11 Arena | Doc #6 §2 (instances), Doc #28 §6 (events), Doc #18 §9 (gold escrow) |
| §13 MCP | Doc #14 §5 §6 |
| Engine / stack authority | **Doc #41 (Engine & Stack ADR)** — Rust authoritative server, UE5 production client, TS/PixiJS web prototype, Protobuf wire protocol; all PvP enforcement in this doc binds to that ADR |

### 13.2 Resolved [OPEN] Items from Other Docs

- **Doc #16 §13 item 4** (Charm-in-PvP) — fully resolved in §3.6: charm permitted on Chaos against Aggressor or faction-war targets, capped at 15 s with Pacified state, scored Honor −, with 30 s post-expiry victim_protection.
- **Doc #16 §13 item 10** (unconscious attackability on Chaos) — partially resolved in §3.3: on Chaos, attackable after 5 s grace; on Order, never; Classic remains [OPEN] in Doc #16.
- **Doc #6 §4** (PvP philosophy, "opt-in only … Chaos Shard zones allowed") — formalized into the full ruleset herein.
- **Doc #5 §5** (anti-griefing, "guards arrest players") — extended in §5.5 with specific guard-zone, criminal-flag, and notoriety-tier behavior.

### 13.3 New MCP Tools

All gated by appropriate capability tier per Doc #14 §3.

| Tool | Capability | Envelope | Mutates |
|---|---|---|---|
| `declare_war` | `avatar.full` (must be guild master) | `target_guild_id`, `terms` | Creates pending war record; routes notification to target guild master |
| `accept_war` | `avatar.full` (must be guild master) | `war_id` | Activates war; updates faction/guild flags |
| `decline_war` | `avatar.full` (must be guild master) | `war_id`, `reason?` | Drops pending war |
| `enroll_faction` | `avatar.full` | `faction: "order" \| "chaos"` | Sets `Avatar.FactionComponent`; debits 500 gp; sets 24h cooldown |
| `depart_faction` | `avatar.full` | (no params; current faction inferred) | Clears faction; forfeits tokens; sets 24h cooldown |
| `place_bounty` | `avatar.full` | `target_avatar_id`, `amount: int` | Posts bounty; locks gold from bank |
| `claim_bounty` | `avatar.full` | `bounty_id`, `corpse_entity_id` | Grants gold if valid corpse + within 1 hour of kill |
| `request_duel` | `avatar.full` | `target_avatar_id`, `ruleset: ArenaRuleset` | Sends duel request |
| `accept_duel` | `avatar.full` | `request_id` | Activates duel instance |
| `decline_duel` | `avatar.full` | `request_id` | Drops duel request |
| `enter_arena_queue` | `avatar.full` | `arena_id`, `stake?: GoldAmount` | Adds to queue |
| `leave_arena_queue` | `avatar.full` | `arena_id` | Removes |
| `report_pvp_incident` | `avatar.full` | `kind: GriefCategory`, `target_avatar_id`, `evidence?: string` | Creates moderation queue ticket (Doc #29) |
| `bind_blessed_item` | `avatar.full` | `item_entity_id`, `slot: BlessedSlotIndex` | Marks item Blessed |
| `unbind_blessed_item` | `avatar.full` | `slot: BlessedSlotIndex` | Unmarks |
| `purchase_insurance` | `avatar.full` | `item_entity_id`, `coverage: bool` | Toggles insurance flag on item |

### 13.4 New MCP Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/avatar/{id}/notoriety` | `{ short_term, long_term, tier, halo, flags }` | `inspect.read`, scoped to current shard |
| `forge://shard/{s}/avatar/{id}/faction` | `{ faction, since, tokens, war_count }` | `inspect.read` |
| `forge://shard/{s}/leaderboards/{kind}` | List of `{ rank, avatar_id, metric }` | `inspect.read` (public on shard) |
| `forge://shard/{s}/leaderboards/archive/{month}/{kind}` | Archived snapshot | `inspect.read` |
| `forge://shard/{s}/wars` | All active wars on shard | `inspect.read` |
| `forge://shard/{s}/avatar/{id}/wars` | Wars involving avatar's guild | `inspect.read`, must be self or guildmate |
| `forge://shard/{s}/bounties` | All active bounties on shard, anonymized poster | `inspect.read` |
| `forge://shard/{s}/avatar/{id}/insurance` | Avatar's insured/blessed item slots and outstanding cost | `inspect.read`, must be self |
| `forge://shard/{s}/region/{r}/pvp_policy` | Region's PvP policy (§2.3) | `inspect.read` |
| `forge://shard/{s}/strongholds` | All strongholds, current holding faction, next siege window | `inspect.read` |

### 13.5 New Error Codes

| Code | Meaning |
|---|---|
| `ERR_PVP_NOT_ALLOWED` | Verb attempted PvP action where shard or region or target state forbids it |
| `ERR_FRIENDLY_FIRE` | Verb attempted to damage party or guild member |
| `ERR_SANCTUARY` | Verb attempted PvP action inside sanctuary region (§3.5) |
| `ERR_VICTIM_PROTECTED` | Target has active victim_protection (§7.5) |
| `ERR_LOGOUT_IN_COMBAT` | Verb attempted log-out while in combat (§7.1) |
| `ERR_MURDER_COOLDOWN` | Murder Count cooldown active for this attacker–victim pair (§7.3) |
| `ERR_AGGRESSOR_LIMIT` | Attacker exceeded simultaneous Aggressor count (§7.4) |
| `ERR_FACTION_COOLDOWN` | Player in 24-hour faction-departure cooldown |
| `ERR_NOT_AT_WAR` | PvP attack attempted without active declared war or faction-war state |
| `ERR_INVALID_BOUNTY_TARGET` | Bounty placed/claimed against ineligible target (e.g., target inside sanctuary, target not Murderer for claim) |
| `ERR_DUEL_DECLINED` | Duel target declined |
| `ERR_INSURANCE_INSUFFICIENT_FUNDS` | Insurance cost exceeded bank balance at death-time |
| `ERR_BLESSED_SLOT_FULL` | All blessed slots in use |
| `ERR_CHAOS_ITEM_TRANSFER_BLOCKED` | Item with `chaos_shard_origin = true` blocked at cross-shard transit |

---

## 14. Phase 1 / Phase 2 Scope

Per Doc #11 (12-week vertical slice) and Doc #6 §7 ("Britain Persistent Test"). PvP is a Phase 2 feature; nothing in this doc is in scope for Phase 1.

| Subsystem | Phase 1 (Vertical Slice) | Phase 2 (Multi-Shard Launch) | Phase 3 (Hardcore Toggle) |
|---|---|---|---|
| Shard taxonomy | Single shard (private 1–8 player, Classic only) | Order + Chaos shards live | Hardcore Chaos opt-in |
| PvP combat | Disabled (single-shard prototype) | Full §3 + §4 ruleset | Stat drift §4.5 enabled |
| Faction system | Stub schema only | §4.6 fully live with strongholds | Faction-balance auto-tuners |
| Notoriety / Murder | Off | §5.1 §5.2 §5.3 §5.4 fully live | Permanent infamy effects |
| Bounty board | Off | §5.6 live | Reserved expansion |
| Sieges | Off | §6.3 single loop | Multi-stronghold raids |
| Anti-grief (§7) | Stub-flagged paths only | §7.1–§7.5 fully enforced | §7.4 detection refinement |
| Item insurance / blessed | Off | §4.4 live | Higher-cost coverage tiers |
| Reward economy / leaderboards | Off | §10 live | Hardcore Chaos leaderboards |
| Tournament / arena | Off | §11 live | Cross-shard tournament events |
| Cross-shard transfer | Off | §9 fully enforced | Reserved expansion |
| MCP surface (§13.3 §13.4) | None | All §13.3 tools and §13.4 resources live | Reserved |

Phase 2 success metric: a player creates two Avatars (one on Order, one on Chaos), experiences zero PvP-related interruptions on Order while interacting with 2,000+ concurrent Avatars in Britain, then experiences full §3 PvP loop on Chaos within 30 minutes of cross-shard travel — including an attempted murder, a bounty placed and claimed, and a single duel-arena match. No griefing exploits succeed in launch-week telemetry; anti-grief detection rate exceeds 95% of intentional griefing attempts on internal red-team test.

---

## 15. Appendix: Heritage Tag Notes

This document leans heavily on `[UO]` heritage for the Trammel/Felucca template — that game pioneered the dual-shard answer to consensual-vs-non-consensual PvP and the framework here is a direct evolution. Specific `[UO]` borrowings: Murder Count, Notoriety halos, Insurance, Blessed slots, faction strongholds with siege windows, champion spawns, Powerscrolls, Bounty Board.

`[BG]` and `[SI]` did not have player-vs-player combat; they are the foundation for the simulation and Virtue layers, not the PvP layer.

`[BR]` original elements: the Order/Chaos faction-virtue alignment (§4.6.1, factional moral framing inherited from Doc #5 not from `[UO]`), the Aggressor/Criminal flag duration tuning (§5.3), the noob immunity period (§7.5), the cross-shard hard wall (§9.1), the arena-with-no-Virtue-impact rule (§11.1), and the resolution of the Charm-in-PvP question via Pacified-not-Faction-flipped state (§3.6).

The Order shard's "consent-only PvP via declared guild war" (§4.7) is closer to `[UO]` Trammel-with-Faction-Wars than to a pure carebear server; this is intentional — declared war lets PvP enthusiasts opt-in to combat without forcing it on anyone else, and allows us to ship a single Order shard rather than splitting the population further.

---

End of Document #35.
