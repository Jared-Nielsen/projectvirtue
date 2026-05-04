Document #24: Onboarding & Tutorial Flow
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Player Experience Lead]
Status: Living Design Reference — Normative spec for first-launch flow, Britain Town Opening, Tutorial Shard, UGC editor unlock, persistent-shard gating, and re-onboarding

Depends on: #1 Vision, #2 GDD §1 §2 §3 §4, #6 Persistent World §2, #7 UGC §2, #11 Prototype Scope, #13 Core Schema, #14 MCP Surface, #15 Character/Party/Inventory §1, #17 Dialogue & NPC Schedule, #19 Quest & UGC Scripting.

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Britannia Reborn.

---

## 1. Onboarding Philosophy

Two parallel paths preserve the BG opening for veterans while granting absolute beginners a respectful runway. Path A — **Britain Town Opening** `[BG]` — drops the new Avatar directly into the simulation: red moongate, summoned-from-the-real-world fiction, Iolo and the Companions present, no overlay tutorial, no floating tooltips. Learning is diegetic; the player figures out controls by trying, exactly as in 1992. Path B — **Tutorial Shard** `[BR]` — is an instanced Avatar's Garden where three guidance NPCs, played as in-fiction tutors (a warrior, an herbalist, a scribe), reveal the same controls through ordinary `talk`-and-`use` interactions. Crucially, no tooltip popups, no animated arrows, no "Press W to walk" overlays appear in either path; the only difference is that Path B's NPCs are *willing teachers* and Path A's are *busy townsfolk*. Both paths flip the same `tutorial_britain_complete` flag and unlock both the UGC editor (Doc #7 §2) and persistent-shard access (Doc #6 §2). This resolves the apparent tension between Doc #2 §1 ("no hand-holding tutorials that insult veteran players") and Doc #6 §2 / Doc #7 §2 (Tutorial Shard exists, UGC gated behind tutorial completion): the *gate* persists, but the *hand-holding* never does — what was a "wizard tutorial" in lesser games becomes an in-fiction Avatar's Garden where Lord British's chosen tutors speak to you in character `[BR]`.

---

## 2. First-Launch Flow

```
Title screen
  ├── "New Avatar"   ──→ Character generation (Doc #15 §1)
  │                       └── Question: "Hast thou walked these lands before?"
  │                             ├── "Aye"     ──→ Britain Town Opening   (§3)
  │                             ├── "Nay"     ──→ Tutorial Shard         (§4)
  │                             └── "Show me" ──→ 60s gameplay clip → return to question
  └── "Continue"     ──→ Avatar select ──→ resume in last region
```

| Property | Value |
|---|---|
| Choice scope | **Per-Avatar**, not per-account. Players may re-roll a new Avatar later and pick the other path. |
| Default selection on fresh account | Neutral — neither answer pre-checked. The prompt presents two sentences explaining each path. |
| Default selection if account already has any Avatar with `tutorial_britain_complete = true` on any shard | "Aye" pre-checked (§6). |
| "Show me" preview | A scripted ~60s capture of Britain ambient gameplay (no UI, no narration). Returns to the question. The player may pick "Show me" again. |
| Persistence of choice | The selected path is stored as `OnboardingChoice = { "veteran" | "beginner" | "preview" }` on the Avatar's `PlayerInventory`-scoped onboarding record (Doc #13 §3). Used only for telemetry; never re-prompted. |

The question is asked *after* genesis (Doc #15 §1) so that the gypsy questions and shard binding are already complete; the path choice does not alter the Avatar's stats, class, or starting kit.

---

## 3. Britain Town Opening

The BG-equivalent diegetic intro `[BG]`. No HUD overlays. No tutorial popups. The game is the tutorial.

### 3.1 Cinematic Stub

Red moongate opens in the Avatar's bedroom (the meta-fictional Real-World framing, faithful to BG `[BG]`). Lord British's voice summons the Avatar through. Transition to Britain main square. In Phase 1, this is a **text intro screen** (§14); the full cinematic is Phase 2.

### 3.2 Spawn

| Element | Detail |
|---|---|
| Location | Britain main square, central plaza, daylight, fair weather |
| Companions present | Iolo, Shamino, Dupre — already in the party at spawn |
| First scripted moment | Iolo greets the Avatar by name and gestures toward Lord British's castle: "Avatar, Lord British awaits. The castle lies thataway." Single line, no modal. |
| HUD state | None. No tooltips, no key hints. Inventory and stats panels are toggleable per Doc #15 §5.4 but not pre-opened. |

### 3.3 Discovery Anchors

Within 5 tiles of spawn, the simulation seeds a few obviously curious objects whose purpose is to teach by being interesting, not by being labeled:

| Anchor | What it teaches | Mechanism |
|---|---|---|
| A barrel beside a fruit cart | Pickup, drag, drop, container nesting | Standard `Container` entity (Doc #13 §1.4); contains 3 apples |
| An unlit torch in a sconce | `use` verb, fire simulation (Doc #4 §3) | Standard ignitable; lighting it does nothing scripted, just burns |
| A beggar named Carlin | `talk` verb, keyword discovery (Doc #17 §3) | Real NPC with a real schedule; asks for a coin, no quest payload |

These are not flagged as "tutorial" objects. They are real entities that happen to be placed where new players will see them first.

### 3.4 Milestone Flags (gating tutorial completion)

The four milestones below collectively define "the player has practiced the four basic verbs the rest of the game depends on." Each writes a sub-flag under the Avatar's `PlayerInventory`-scoped onboarding record:

| # | Milestone | Sub-flag | Verb proven |
|---|---|---|---|
| 1 | Talk to one NPC and learn one keyword **beyond** `name`/`job`/`bye` | `tutorial.dialogue` | `talk` + `say_keyword` (Doc #17) |
| 2 | Pick up and place at least one Entity (any object, anywhere) | `tutorial.move_item` | `drag` (Doc #13 §2) |
| 3 | Examine Lord British (any verb that resolves on him) | `tutorial.examine_lb` | `examine` (Doc #14 §5.7) |
| 4 | Visit at least one shop (entering trade dialog counts; no purchase required) | `tutorial.shop` | `OpenShop` side-effect (Doc #17 §5.3) |

When all four sub-flags are set, the dispatcher writes `tutorial_britain_complete = true` to the same record. No notification fires. The player simply finds, on their next visit to the main menu, that the UGC editor option is now selectable (§7).

| Property | Value |
|---|---|
| Time-to-completion target | 10–20 minutes of organic play |
| Designed-for-failure | Yes — players may complete the four milestones in any order, on any path through Britain. The game does not advance them; the world is open. |
| Telemetry | Per-milestone first-trigger timestamp written to the onboarding record. Used by live ops to detect onboarding stuck patterns (e.g., 90th-percentile players never visiting a shop = redesign signal). |

---

## 4. Tutorial Shard (Avatar's Garden)

The beginner-respecting alternative. **Despite Doc #6 §2's name ("Beginner / Tutorial Shard"), this is an instanced private region, not a public shard** `[BR]`. We clarify the terminology here and recommend a corrective amendment to Doc #6 §2 in a future revision.

### 4.1 Setting

A small bordered garden outside Britain's south wall, fictionally established as the place where Lord British trains new Avatars before sending them into Britannia proper. Always daylight, always fair weather, no hostile spawns. The garden is bounded by hedges; the only exit is a moongate at the north end.

### 4.2 The Three Tutors

Three NPCs, each playing a diegetic role. Each is a **standard NPC** with a normal `Schedule` and `DialogueTree` (Doc #17). They live in the instanced region and never appear elsewhere; they are tutors only by virtue of their dialogue content, not by any special verb dispatch (§11).

| NPC | Diegetic role | Teaches | Mechanism |
|---|---|---|---|
| **Master Toridan** | Stoic warrior trainer | Movement, combat AI modes, `attack` verb | Offers an opt-in spar with a wooden sword; if declined, awards completion for simply approaching and conversing |
| **Mistress Avila** | Gentle herbalist | Inventory, pickup, combine | Gives flour and water; player makes bread via `combine` (Doc #4.1) |
| **Brother Quill** | Quiet scribe | Dialogue keywords, journal | Asks the player to ask him three keywords beyond `name`/`job`/`bye` |

### 4.3 Completion Conditions

The garden completes when all three tutors have set their respective sub-flag:

| Tutor | Sub-flag set when |
|---|---|
| Toridan | Player has either completed the spar (one swing landed, no winner required) OR exhausted Toridan's keyword tree |
| Avila | Player has produced one loaf of bread via `combine(flour, water)` |
| Quill | Player has asked Quill at least 3 keywords beyond `name`/`job`/`bye` |

Each tutor's exit dialogue, on satisfying their own sub-flag, includes the line:

> "Thou art ready. Walk through yonder moongate to Britain proper, Avatar."

When all three sub-flags are set, the moongate at the north of the garden visibly activates (was inert before). Stepping through it:
1. Sets `tutorial_britain_complete = true` on the Avatar's onboarding record.
2. Spawns the Avatar in Britain main square (same location as §3.2's Britain Town Opening).
3. Iolo, Shamino, and Dupre are present (same as §3.2). Iolo's "Lord British awaits" greeting fires.

### 4.4 Time Target

| Property | Value |
|---|---|
| Time-to-completion target | 30–45 minutes |
| Failure mode | The player may leave any tutor mid-conversation; the garden is patient. There is no fail state. |
| XP awarded | **None.** Tutorials are free practice (§5). |
| Items kept | All items the player crafts or picks up in the garden carry over to Britain. |

### 4.5 Why Not Public

A public Tutorial Shard would expose new players to other new players, multiplying confusion, and would require the Virtue/Justice/anti-griefing apparatus of Doc #6 §5. An instanced Avatar's Garden gives every Avatar their own private space, eliminates griefing surface, and matches the BG fictional framing that the Avatar is special (summoned, singular). Multiplayer onboarding to *persistent* shards is a separate flow (§10).

---

## 5. What Is Explicitly NEVER Added

This section is normative. The following are forbidden in both Path A and Path B, by Doc #2 §1 mandate:

| Forbidden element | Why |
|---|---|
| Floating "Press X" tooltip overlays | Inserts a HUD layer between the player and the simulation; breaks Doc #2 §1's "full-screen, mouse-driven interaction." |
| Animated arrow pointers ("Go this way") | Breaks "no hand-holding"; reduces Britannia to a theme-park ride. |
| Popup modals explaining mechanics | Same. Modals are worse than tooltips because they pause the sim. |
| "Skip Tutorial" button | The game IS the tutorial. The branch is chosen at first launch (§2). There is nothing to skip. |
| XP rewards specifically for tutorial actions | Tutorials are free practice. Awarding XP encourages farming the tutorial; awarding none keeps it pure pedagogy. The four Britain milestones (§3.4) and three garden sub-flags (§4.3) award **no XP and no Virtue deltas**. |
| Forced camera moves to highlight points of interest | Breaks the locked isometric view promise (Doc #2 §1, Doc #1 §2). |
| Dialogue from the game-engine narrator (not a diegetic NPC) | All exposition flows through diegetic NPCs (Iolo, the three tutors, Lord British, etc.). The game never speaks in its own voice. |

This list is the operational reading of Doc #2 §1. Any future feature request that would add an item from this list requires an explicit Doc #2 amendment first.

---

## 6. Veteran Shortcut

| Condition | Behavior |
|---|---|
| Account has any Avatar (any shard) with `tutorial_britain_complete = true` | "Aye, I have walked these lands before" auto-checked on the path-choice prompt. Player may still pick "Nay" to revisit the garden on this new Avatar. |
| Fresh account, no completed Avatars | Question defaults to neutral. Two-sentence explanation appears below: "If thou hast played the Ultimas of old, choose AYE and step into Britain. If thou art new to Britannia, choose NAY and Lord British's tutors shall greet thee in his garden." |
| Account holder has explicitly opted into "always show me Britain Town Opening" in account settings | Path-choice prompt skipped; goes straight to §3. |

The veteran shortcut is per-account, not per-shard, because the relevant fact (does this human know how to play?) is per-human.

---

## 7. UGC Editor Unlock

> **Resolves Doc #7 §2's "Unlocked after completing the Britain tutorial" requirement.**

| Rule | Detail |
|---|---|
| Lock condition | `tutorial_britain_complete = false` on the active Avatar |
| Lock kind | **Hard requirement.** The UGC editor entry in the main menu and the in-fiction "Avatar's Studio" portal in Britain are **hidden**, not greyed-out, until the flag is set. Hidden because greying-out is a teasing pattern that violates the no-hand-holding spirit. |
| Reasoning | Per Doc #7 §3, brand-new players who have never moved a barrel or talked to an NPC will produce UGC that floods the moderation queue with empty rooms and noise. The tutorial gate filters this at zero cost — completing the tutorial proves the creator understands the simulation primitives they will be authoring. |
| Re-lock | **Never.** Once unlocked for an Avatar, the editor remains unlocked even after Avatar reset (Doc #15 §1.5). The `tutorial_britain_complete` flag is not part of the reset-able Virtue/Inventory state; it lives on a separate permanent onboarding record. |
| Cross-Avatar inheritance | An account holder who completed the tutorial on Avatar A may access the editor on Avatar B *if* Avatar B also has the flag set; flag is per-Avatar, not per-account. Rationale: a friend logging in on the same account on a fresh Avatar is treated as a fresh creator session. |

---

## 8. Persistent Shard Access Gating

| Shard type | Tutorial gate? | Rationale |
|---|---|---|
| Classic Shard (Doc #6 §2) | **No gate.** | Classic is single-player or small private co-op; new players who don't know controls only affect themselves and their friends. |
| Virtue Shard (public persistent) | **Gated.** Requires `tutorial_britain_complete = true`. | Virtue Shard is a shared resource. New players who don't know controls grief the experience for others by getting lost in shops, accidentally stealing, blocking doorways. |
| Chaos Shard (public persistent, PvP-allowed) | **Gated.** Requires `tutorial_britain_complete = true`. | Same reason, doubly so — a new player walking into PvP without knowing how to combat is being wronged by the system, not the other players. |
| Avatar's Garden (instanced) | N/A — this *is* the tutorial. | Always reachable as Path B for any Avatar. |

Players who pick "Aye" at the path question and then skip out without completing the four Britain milestones (§3.4) cannot enter persistent shards. They will receive a single in-fiction prompt at any persistent-shard moongate: "Britannia is not yet ready for thee, Avatar. Visit Britain town and learn its ways first." No tooltip, no modal — a plain dialogue line from the moongate's attendant NPC.

---

## 9. Re-Onboarding (Returning Players)

For players who have been inactive long enough that they may have forgotten controls.

| Trigger | Behavior |
|---|---|
| Login after >180 real-time days inactive on a given Avatar | Optional one-time prompt at character select: "Wouldst thou like a refresher in the Avatar's Garden?" |
| Player chooses "Aye" | Avatar respawns at the garden's south entrance with all stats, items, Virtues, and quest progress intact. The three tutors recognize the Avatar by name and offer abridged refreshers ("Welcome back, Avatar — thy old tricks return easily, no doubt"). The moongate is active from the start; the player may leave at any time. |
| Player chooses "Nay" | Avatar resumes in last region as normal. |
| Player chooses "Aye" then leaves before satisfying the three tutors | No penalty, no progress loss; the prompt does not re-fire for another 180 days. |

The re-onboarding flow does not affect `tutorial_britain_complete`. The flag, once set, stays set forever.

---

## 10. Multiplayer Onboarding (Per-Shard Briefing)

> Specific to first entry into a persistent shard. Distinct from the per-Avatar tutorial flag (§7, §8).

| Property | Value |
|---|---|
| Trigger | First entry into a given persistent shard (Virtue, Chaos, or any future-named persistent shard) for a given Avatar |
| Form | A 30-second in-fiction "guardian briefing" scripted scene at the shard's main moongate. A Royal Herald NPC (or shard-specific equivalent — e.g., a black-cloaked envoy on the Chaos Shard) explains shard-specific rules in character. |
| Content (Virtue Shard) | "This is a land where the Eight Virtues are watched and weighed. Thy deeds are remembered. Strike no innocent; lie not under oath." |
| Content (Chaos Shard) | "This is a land of strife. Steel may meet steel between Avatars here. Trust thy companions and thy reflexes." |
| Skippability | Skippable after the first 5 seconds via a single click. The first 5 are non-skippable to prevent reflex-skipping the only safety briefing the player ever sees. |
| Persistence | Per-shard, per-Avatar. Once delivered, never repeats on subsequent entries. Stored as `OnboardingShardBriefing.{shard_id} = true` on the Avatar's onboarding record. |
| Skip on subsequent Avatars | If the *account* has seen a given shard's briefing on any prior Avatar, the briefing is fully skippable from second 0 on the new Avatar (per-account memory of "this human has read the safety card"). |

This briefing is **not** a tutorial — it teaches no controls. It is shard-specific *rules* exposition, equivalent to reading a sign on the gate of a town. It does not gate entry; it accompanies it.

---

## 11. Verb Dispatch in Tutorial Contexts

A normative invariant: **all tutorial actions flow through the same `VerbDispatcher` (Doc #13 §4) used by the rest of the game**. There are no tutorial-only verbs, no tutorial-only side channels, no tutorial-only persistence rules.

| Implication | Detail |
|---|---|
| Tutorial NPCs (Toridan, Avila, Quill) are **standard NPCs** | Standard `Entity` with standard `Schedule` (Doc #17 §6) and standard `DialogueTree` (Doc #17 §2). They live in an instanced region (Doc #6 §2 instance layer); that is their only special property. |
| Tutorial sub-flag writes use the standard side-effect channel | Each tutor's "satisfaction" response carries a `SetFlag` `DialogueEffect` (Doc #17 §2) writing the tutor-specific sub-flag. The flag predicate that activates the moongate is a standard `StateGate` on the moongate's interaction tree. |
| Britain milestone sub-flags use the same channel | Milestone 1 writes its sub-flag from a `SetFlag` on the first non-trivial keyword response. Milestones 2–4 write from `Drag.complete`, `Examine.complete`, and `OpenShop.complete` events the dispatcher already emits for telemetry — the onboarding sub-flag is just another listener. |
| UGC creators inherit the same toolkit | Because tutorials are nothing but normal NPCs in instanced regions writing flags via normal dialogue, **UGC creators can author their own tutorial-style intros for their own content** (Doc #19, Doc #7). A creator's dungeon may begin with its own tutor NPC, instanced sub-region, and milestone flags using the same dispatcher path. This is the design payoff for refusing tutorial-only special cases. |

The Tutorial Shard's instancing is achieved via the same `Instance Layer` mechanism Doc #6 §2 uses for player housing — there is nothing onboarding-specific in the shard architecture either.

---

## 12. Accessibility

| Concern | Treatment |
|---|---|
| Time-pressured controls | **Neither path requires any.** Britain Town Opening can be played at any pace; combat is avoidable (the four milestones in §3.4 do not require combat). Tutorial Shard's spar with Toridan is opt-in; declining still counts toward Toridan's sub-flag (§4.3). |
| Text-only interaction baseline | Both paths can be completed using only mouse + keyboard text input. No QTEs, no rhythm prompts, no timed dialogue choices. |
| Tutorial Shard isolation | Single-player-instanced; no PvP, no time pressure, no other Avatars present. A player who needs an hour to read each line of dialogue may take it. |
| Color-blind / dyslexic accommodations | **Engine-wide concern, not tutorial-specific.** Spec lives in a TBD accessibility document (Doc #25 candidate, §15 [OPEN]). The tutorial paths do not introduce any new accessibility surface beyond what the rest of the game requires. |
| Pause behavior | Both paths obey the standard sim pause (`Esc` opens the system menu and pauses single-player; in instanced contexts the garden also pauses). |

---

## 13. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 13.1 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/avatar/{id}/tutorial_state` | `{ tutorial_britain_complete: bool, sub_flags: { dialogue: bool, move_item: bool, examine_lb: bool, shop: bool, toridan: bool, avila: bool, quill: bool }, onboarding_choice: "veteran" \| "beginner" \| "preview" \| null, shard_briefings_seen: ShardId[], first_completed_at: Timestamp \| null }` | `inspect.read` for **OWN avatar only** (per Doc #15 §7.3 cross-avatar gating rule). Reading another Avatar's tutorial state returns `ERR_CAPABILITY`. |

Read-only. There is no MCP tool that *clears* the tutorial flag in production; the flag is monotonic-true. (Avatar reset, which destroys the Avatar entirely, is the only way to "lose" the flag — and even then, the account-level memory is preserved per §6.)

### 13.2 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `complete_tutorial_for_testing` | **`avatar.full` PLUS designer-only flag** (`session.designer = true`); rejected outright on production capability sets | `avatar_id` | `{ tutorial_britain_complete: true, sub_flags_set: string[] }` | Force-sets all sub-flags AND `tutorial_britain_complete = true` on the named Avatar. **QA-only.** |

```json
// complete_tutorial_for_testing
{
  "name": "complete_tutorial_for_testing",
  "input": {
    "envelope": "VerbEnvelope",
    "avatar_id": "AvatarId"
  },
  "returns": {
    "tutorial_britain_complete": "boolean",
    "sub_flags_set": ["string"]
  }
}
```

Errors specific to onboarding tools: `ERR_NOT_DESIGNER` (capability check failed on `complete_tutorial_for_testing`), in addition to standard codes from Doc #14 §5.

### 13.3 Capability Notes

- `complete_tutorial_for_testing` is the only tutorial-related MCP tool, and it is **explicitly QA-scoped**. Production capability sets (`avatar.full` for human-bound LLM clients, `ugc.author`, `inspect.read`) cannot see it in the tool list — the server does not advertise it without the `session.designer` flag.
- Subscriptions on `tutorial_state` deliver one event per sub-flag transition; useful for QA harnesses verifying the four milestones fire in expected order.

---

## 14. Phase 1 Prototype Scope (12-Week "Britain Alive")

Per Doc #11. Britain Town Opening only — Tutorial Shard deferred to Phase 2.

| Subsystem | In Scope | Deferred |
|---|---|---|
| First-launch flow | Path-choice question shown after genesis; "Nay" option **greyed and labeled "Coming in Phase 2"**; "Aye" and "Show me" functional | Tutorial Shard option enabled |
| Cinematic | **Text intro screen** ("Lord British summons thee..."): single screen, click to dismiss; no animation | Full red-moongate-from-the-bedroom cinematic |
| Spawn | Britain main square; Iolo + Shamino present (Doc #15 §8 names only those two for Phase 1); Dupre **deferred** | Dupre at spawn, full-square ambient population |
| Discovery anchors | Barrel + apples (uses container nesting from Doc #15 §5.2); unlit torch in sconce; one beggar NPC named Carlin | Additional anchors |
| Milestone flags | All 4 wired (§3.4) and tracked through standard dispatcher channels | Telemetry dashboard for milestones |
| Tutorial Shard | **Not built.** No instanced region, no Toridan/Avila/Quill, no garden moongate | Full §4 build in Phase 2 |
| UGC editor unlock | Hard gate working on flag flip — editor menu hidden until `tutorial_britain_complete = true`, then visible | Editor itself per Doc #7 §6 Phase 1 scope |
| Persistent shard gating | **Not enforced** — Phase 1 multiplayer is single-region only per Doc #22 Phase 1 scope; no Virtue/Chaos shards exist yet | Full gating per §8 in Phase 2 |
| Re-onboarding | **Not built** | Full §9 in Phase 2 |
| Multiplayer briefing | **Not built** (no persistent shards in Phase 1) | Full §10 in Phase 2 |
| MCP | `tutorial_state` resource present (used by QA harness); `complete_tutorial_for_testing` tool present (designer-flagged) | None |
| Veteran shortcut | Account-memory check skipped (no prior accounts in Phase 1 alpha); always defaults to neutral | Per-account memory in Phase 2 |

**Phase 1 success metric:** a Garriott playtester picks "Aye" at the path question, spawns in Britain with Iolo and Shamino, walks five tiles, picks up an apple from the discovery barrel (milestone 2), talks to Carlin and learns the keyword `coin` (milestone 1), enters the bakery and clicks the baker (milestone 4), walks to Lord British's chamber and clicks him (milestone 3), and on returning to the main menu sees the UGC editor option appear — without ever having seen a tooltip, popup, or arrow.

---

## 15. Open Questions

1. `[OPEN]` **Lord British voice cast.** §3.1 requires a voice line for Lord British's opening summons. Casting decision pending license-holder consultation (Doc #1 §5 — Garriott as Creative Steward).
2. `[OPEN]` **Tutor identities — generic or canonical?** §4.2 names Master Toridan, Mistress Avila, Brother Quill as generic tutors. Lore tension: should the three tutors instead be Iolo, Shamino, and Dupre themselves? Pro-canonical: stronger fiction, no new NPCs to author. Pro-generic: the Companions are already-met characters who arrive *with* the Avatar in Britain (Doc #15 §3); having them simultaneously be tutors-in-the-garden requires a fictional bridge (memory? flashback?) that the BG framing does not support cleanly. Recommend keeping generic tutors and treating the garden as a Lord-British-administered school. Final call deferred.
3. `[OPEN]` **Localization of the path-choice prompt.** §2's "Hast thou walked these lands before?" is the English rendering. The archaic-English register is a deliberate stylistic choice (BG's voice). Localized versions need an in-language equivalent of the same register, not a literal translation. Per-locale translator brief required. Affects every locale Doc TBD covers (Doc #25 candidate, intersects §12 accessibility).
4. `[OPEN]` **Cinematic skippability.** §3.1 stub: in Phase 2 when the full red-moongate cinematic exists, should it be skippable on first viewing? Recommendation: **skippable after first viewing only**, with a "watch again" entry in the main menu's Codex section. First-viewing non-skippable to ensure narrative beat lands; subsequent skippable for replays. Final call deferred to cinematic delivery.
5. `[OPEN]` **Avatar's Garden interaction with persistent shards.** The garden is instanced (§4.5), so two Avatars on the same Virtue Shard never see each other's gardens. Open: does the garden technically *exist* on the shard's region map (visible at the south wall as a hedged enclosure no one else can enter), or is it spatially elsewhere (a dimensional pocket)? The hedged-on-the-map version preserves the BG visual that the Avatar walked from the garden into Britain; the pocket version is technically simpler. Recommendation: hedged-on-the-map, with the moongate at the north end being the only entrance/exit. Final call deferred to spatial systems doc (Doc #23).
6. `[OPEN]` **Carlin the beggar's continued role post-tutorial.** §3.3's beggar is a real NPC with a real schedule. After milestone 1, does he persist as a normal Britain beggar (preferred — preserves the simulation-first principle), get a unique long-arc storyline (overinvestment in a tutorial NPC), or remain ambient color (waste)? Recommend persistent as normal beggar with a small Compassion-rewarded mini-arc available to high-Compassion Avatars who feed him repeatedly.
7. `[OPEN]` **Phase 2 Tutorial Shard regional accessibility.** When the garden ships in Phase 2, can a Phase 1 veteran Avatar (already `tutorial_britain_complete = true`) ever revisit it? §9's re-onboarding flow says yes after 180 days. Open: should there be a "always available, just walk to the south wall" route too, for players who want a refresher sooner? Recommendation: yes — the moongate at Britain's south wall is always passable in either direction for Avatars who have the flag set. Final call deferred to Phase 2 spec.
8. `[OPEN]` **Telemetry retention for onboarding records.** §3.4 stores per-milestone first-trigger timestamps for live ops. How long retained? GDPR-style retention concerns intersect with Doc #6 persistence rules. Recommendation: 180 days rolling, then aggregate-only. Final call deferred to live-ops doc.

---

## 16. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #1 §2, Doc #2 §1 §2, Doc #6 §2, Doc #7 §2 |
| §2 First-launch | Doc #15 §1 (genesis flow precedes path question) |
| §3 Britain Opening | Doc #11 (vertical slice opening sequence), Doc #15 §3 (companions), Doc #17 (dialogue verbs), Doc #13 §2 (verb registry) |
| §4 Tutorial Shard | Doc #6 §2 (instance layer), Doc #17 §6 (NPC schedules), Doc #4.1 (combine for breadmaking) |
| §5 Forbidden elements | Doc #2 §1 (no hand-holding mandate) |
| §6 Veteran shortcut | Doc #15 §1.5 (per-Avatar persistence) |
| §7 UGC unlock | Doc #7 §2 §3 (editor + moderation queue rationale) |
| §8 Persistent shard gate | Doc #6 §2 (shard types), Doc #6 §5 (anti-griefing rationale) |
| §9 Re-onboarding | Doc #6 §3 (persistence), Doc #15 §1.5 |
| §10 Multiplayer briefing | Doc #6 §2 (shard-specific rules) |
| §11 Verb dispatch invariant | Doc #13 §4 (dispatcher contract), Doc #17 §2 (`SetFlag` effect), Doc #19 (UGC scripting inheritance) |
| §12 Accessibility | TBD Doc #25 candidate |
| §13 MCP | Doc #14 §3 (capabilities), §5 (tool envelope), §6 (resources), Doc #15 §7.3 (cross-Avatar gating) |
| §14 Phase 1 | Doc #11 (milestones), Doc #14 §8, Doc #15 §8, Doc #17 §13, Doc #22 Phase 1 (single-region multiplayer) |

---

End of Document #24.
