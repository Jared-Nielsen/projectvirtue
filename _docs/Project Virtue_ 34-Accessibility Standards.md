Document #34: Accessibility Standards
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Accessibility Lead]
Status: Living Design Reference — Normative spec for engine-wide accessibility. Resolves Doc #24 §12's "engine-wide TBD." Intersects Doc #33 (Localization & i18n).

Depends on: #2 GDD §1 §4 (mouse-driven controls), #10 Art & Audio Style Bible §2 (palette, fonts), #11 Phase 1 Prototype Scope, #13 Core Schema (Entity, Verb, Scope), #14 MCP Server Surface §3 (capabilities), §5 (tools), §6 (resources), #17 Dialogue & NPC Schedule §2 §3 (keyword surface), #19 Quest & UGC Scripting §8 (validator), #24 Onboarding & Tutorial Flow §12 (deferred to this doc), #27 Audio System §9 (subtitles, visual cues), #33 Localization & i18n.

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: The Iron Marches* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Project Virtue.

---

## 1. Accessibility Philosophy

Avermere is meant for everyone who wants to walk it. Accessibility is not "added later" — it is a launch-day commitment, scoped into Phase 1 (§14), validated against external standards (§2), and audited by external consultants before public release (§11). Project Virtue targets **WCAG 2.1 AA equivalent** for game UI and meets or exceeds **CVAA** (Communications and Video Accessibility Act) standards for any communications surface (chat, voice, dialogue captioning). The original `[BG]` and `[SI]` predated the modern accessibility frameworks (WCAG 1.0 was published in 1999, the CVAA in 2010, the Game Accessibility Guidelines first appeared in 2012); reviving Avermere in 2026+ means meeting the standards the originals could not. Accessibility settings are per-Avatar persisted (§12), surfaced through the same `VerbDispatcher` and MCP capability model the rest of the simulation uses (§13), and validated for UGC at compile time (§10).

**Client-split note (canonical stack — see Doc #41 Engine & Stack ADR).** Project Virtue ships two clients against a single Rust authoritative server: a UE5 production client (desktop + PS5 + Xbox) and a TS / PixiJS web thin-client. Accessibility implementation splits accordingly:

- **Platform-mandated accessibility features** (PS5 / Xbox certification requirements — DualSense haptic alternatives, platform screen-reader API conformance, system-level caption settings inheritance, console text-size minimums) are implemented in the **UE5 client only**, since the web client does not ship to console. See `[OPEN]` §15-3.
- **Cross-cutting accessibility features** (color-blind palettes §3.1, high-contrast UI §3.2, text size scaling §3.3, dyslexia-friendly font §3.4, reduced motion §3.5, subtitles §4, keyboard remap §5, combat slow mode §5, auto-pause §7, etc.) **must be implemented in BOTH clients** at functional parity. A player switching between UE5 and web should find the same accessibility profile (§12) honored identically.
- Where a feature has client-specific plumbing (e.g., screen-reader OS bridge — UIA/AX/AT-SPI in UE5 via Slate; ARIA + DOM accessibility tree in web), the per-client implementation differs but the player-facing behavior must match.

---

## 2. Standards Alignment

| Standard | Coverage area | Compliance target |
|---|---|---|
| **WCAG 2.1 AA** | UI, text contrast, color contrast, keyboard navigation, focus indicators | Meet AA where applicable; document deviations where game-specific UX makes literal compliance impossible (e.g., color-only information in art tiles is unavoidable, addressed by §3 palette swap rather than removal) |
| **CVAA** | All communication surfaces — voice chat (Phase 3+), text chat, dialogue subtitles | Meet, including transcription (§4) for voice chat |
| **XAG** (Game Accessibility Guidelines, gameaccessibilityguidelines.com) | Game-specific patterns — remappable controls, difficulty options, pause-on-focus-loss, etc. | Meet "Basic" and "Intermediate" tiers fully; meet most "Advanced" tier items |
| **ADA-compliant alternatives** | Where applicable to the customer-facing service (account portal, support) | Meet for portal/support; in-game alternatives provided per §3–§7 |
| **ITPC 2014 / WCAG 2.3.1** | Photosensitivity, seizure safety | Audited per §8; harmful flashing forbidden in core content and UGC |
| **Voluntary external audit** | AbleGamers, SpecialEffect, or Game Accessibility Conference reviewer pre-launch | Engaged per §11; audit outcomes published with launch notes |

**Conflict resolution.** Where WCAG and XAG (or XAG and Xbox Accessibility Guidelines, "XAG-MS" for clarity) prescribe incompatible behaviors, XAG takes precedence for game-specific patterns and WCAG takes precedence for UI patterns shared with web/desktop applications. Open question on cases of true conflict listed in §15.

---

## 3. Visual Accessibility

### 3.1 Color-blind palettes

Four runtime palette modes, applied as the same palette-swap mechanism Doc #10 §2.2 uses for region expansion:

| Mode | Target |
|---|---|
| `Off` | Default Ultima VII 256-color palette unchanged |
| `Protanopia` | Red-deficient mapping; reds shifted toward orange/yellow with luminance boost |
| `Deuteranopia` | Green-deficient mapping; greens shifted toward blue-green with luminance boost |
| `Tritanopia` | Blue-deficient mapping; blues shifted toward cyan with magenta hint on previously-confused yellows |

Palette swap is a runtime LUT applied to every sprite at render. UGC art is automatically remapped (no creator action required); the validator flags any UGC art that relies on hue-only encoding without a luminance contrast fallback (§10).

### 3.2 High-contrast UI mode

| Element | Default | High-contrast mode |
|---|---|---|
| UI panel background | parchment alpha-tinted | opaque parchment, no transparency |
| UI text | parchment-style font on parchment ground | bold-weighted font; minimum 7:1 contrast against ground |
| Sprite outlines on selection | 1-px highlight | 2-px outline with luminance-inverted color |
| Tooltip background | semi-transparent | opaque with 1-px border |
| Inventory item icons | rendered against panel | rendered against opaque ground swatch per item |

High-contrast mode is independent of color-blind mode; the two compose.

### 3.3 Text size scaling

100% to 200% in 25% steps (5 steps total). UI panels (inventory, dialogue keyword list, journal, spell book) reflow at each step. Text in the game world (signs, books rendered as parchment overlays) scales with the same setting. Combat floating-damage numbers scale to 200% maximum.

| Step | Scale | Notes |
|---|---|---|
| 1 | 100% | Default |
| 2 | 125% | |
| 3 | 150% | |
| 4 | 175% | |
| 5 | 200% | UI panels reflow with vertical scrollbars where needed |

### 3.4 Font choice

| Font | Default | Scope |
|---|---|---|
| Parchment-style serif (per Doc #10 §2.4) | Yes | All UI text, dialogue, journal |
| Dyslexia-friendly font (OpenDyslexic or licensed equivalent) | Opt-in | Replaces parchment font globally; preserves the parchment ground texture so style still reads "Avermere" |

Font choice is independent of text size scaling; the two compose.

### 3.5 Reduced motion

Disables non-essential motion that does not change the simulation: particle effects (smoke, sparkles, ambient dust), screen shake on damage and explosions, fast camera transitions on cutscene start, parallax on title screen. Does **not** disable: NPC walk animation, combat animation, spell cast animation, weather (rain, snow) — these are simulation-meaningful and cannot be reduced without changing what the player perceives.

### 3.6 Photosensitivity

See §8.

### 3.7 Screen reader support

See §6.

---

## 4. Auditory Accessibility

| Feature | Default | Detail |
|---|---|---|
| **Subtitles** | On | Every voice clip with an associated `Response.text` (always present per Doc #17 §2) is shown synchronized to playback. Per Doc #27 §9. |
| **Speaker identification** | On | Subtitle prefixed with speaker name (`Erevan: ...`). Color-coded by faction (Companions warm gold; Highmere townsfolk neutral; Fellowship muted purple; hostile NPCs red). Color is supplemental — speaker name is always literal text. |
| **Per-channel volume** | All at 100% | Five independent buses per Doc #27 §9: master, music, SFX, voice, ambient. |
| **Visual SFX cues** | Off (opt-in) | High-importance audio (combat hits, alerts, screams, explosions, schedule interrupts) shows on-screen icon with directional indicator. Per Doc #27 §9. |
| **Sound propagation hints** | Off (opt-in) | NPC awareness events (Doc #27 §3.4) surface as on-screen hint when relevant to the player: "A guard heard you," "A merchant noticed the broken jar." Reads the `Awareness` message that the simulation already produces. |
| **Audio-cue captions** | Off (opt-in) | Bracketed text captions for non-dialogue audio per Doc #27 §9: `[door creaks open]`, `[footsteps approach from the east]`, `[swords clash nearby]`. |
| **Mono audio mode** | Off | Stereo HRTF collapses to single channel for single-ear hearing. Spatial direction encoded only in subtitle/cue text when this mode is on. |
| **Voice-chat transcription** (Phase 3+) | Off | Server-side speech-to-text on inbound voice chat → text captions for HoH players. Out of Phase 1 scope (no voice chat in Phase 1 per Doc #27 §7). |

Subtitle and audio-cue text is `LocalizedString` per Doc #27 §9 — intersects Doc #33.

---

## 5. Motor Accessibility

| Feature | Default | Detail |
|---|---|---|
| **Full keyboard remap** | Standard Ultima VII layout | Every action remappable via Settings → Controls. No required mouse usage; keyboard-only play is supported for every verb in Doc #13 §2. |
| **One-handed control schemes** | Off | Pre-configured layouts for left-hand-only and right-hand-only play (mouse + half-keyboard or keyboard-only). Selectable as a preset. |
| **Click-and-hold alternatives** | Off | Toggle replaces hold for fatiguing inputs (party-formation drag, area-cursor select, repeating-key inputs). Toggle state shown on cursor or status bar. |
| **Drag-replacement** | Off | Drag-and-drop (Doc #2 §4.2) substituted by two-click "select origin → click destination." Both modes coexist; players may use either at any moment when this is on. |
| **Combat slow mode** | Off | Toggleable 0.5× simulation speed for combat. **Single-player only** per §9; disabled in PvP shards (Chaos, duels). |
| **Auto-pickup option** | Off | Items auto-collect when Avatar walks over them. Off by default because some players need it and most don't; turning it on does not change Virtue scoring (auto-picking up someone else's `is_owned` item still triggers the same `steal` event Doc #15 §6.2 emits for manual pickup). |
| **Reduced precision tolerance** | Off | Snap-to-tile for click targeting; expanded interaction radius (1.5× standard). Useful for tremor, low-precision pointing devices. |
| **Pause on focus loss** | On | Single-player paused when window loses focus. Does not apply to multiplayer (the world keeps running for everyone else). |

---

## 6. Screen Reader Support

The hard problem. Avermere is keyword-driven (Doc #17), isometric (Doc #2 §1), and click-target-rich. Most isometric games do not target screen readers at all; this section is mostly `[BR]` original design.

### 6.1 OS integration

The engine exposes a structured UI tree to OS-level screen readers (NVDA, JAWS on Windows; VoiceOver on macOS; Orca on Linux). Each UI element carries an accessible name, role, and state. Implementation uses the platform's accessibility API (UIA on Windows, AX on macOS, AT-SPI on Linux) bridged from UE5's Slate widget tree.

### 6.2 Dialogue (the keyword problem)

The keyword-driven dialogue surface (Doc #17 §3) is announced as a structured list:

| Surface | Announcement |
|---|---|
| Session open | "Talking to {NPC name}. Keywords available:" then list. |
| Keyword list navigation | Arrow keys move focus; each focused keyword spoken. `Enter` selects. |
| Response | NPC name + response text spoken; if response unlocks new keywords, new list announced. |
| Locked / suppressed keyword | Not announced (matches sighted players' surface — they don't see it either). |
| Session close | "Conversation ended." |

The keyword list is a true list widget for the screen reader, not a row of mouse-only sprites. Sighted players see bold keywords on parchment; screen-reader users hear the same set. Both are reading the same `DialogueTree.opening + unlocks - locks` set.

### 6.3 Inventory

Each paperdoll slot carries an accessible name (`right hand: long sword, weight 3 kg, durability 22 of 25`). Items in containers are read in container traversal order; nested containers announce nesting depth.

### 6.4 Combat

Each verb result is announced in real time: `Erevan struck the rat for 8 damage; rat health low.` Slowing combat (§5) helps screen-reader users keep up; combat slow mode is recommended (but not forced) when a screen reader is detected.

### 6.5 Schedule view

NPC location announced relative to Avatar: `Erevan is at the bakery, north 4 tiles, east 2 tiles.` Useful for finding party members and known NPCs.

### 6.6 World examination — the "Described View"

A novel `[BR]` mode. Most isometric games offer no screen-reader equivalent for "what do I see?". Avermere provides a **described view** that lists nearby Entities in spoken form by distance and direction:

```
Within 5 tiles: a wooden door (north, 2 tiles, closed); a fruit cart (east, 3 tiles); 
Carlin the beggar (south-east, 4 tiles); a lit torch in a sconce (north-west, 5 tiles).
Within 10 tiles: 7 more entities, say "expand" to list.
```

Selection algorithm for dense scenes (a Highmere market square may contain 50+ entities) is an `[OPEN]` item — see §15. Phase 1 prototype: nearest-N within 5 tiles, deferred to Phase 2 for full implementation per §14.

Activated by a single accessible hotkey (default `Tab` while not in dialogue). Refreshes on Avatar movement.

---

## 7. Cognitive Accessibility

| Feature | Default | Detail |
|---|---|---|
| **Quest journal "next step" hint** | Off | Optional hint surfaces the suggested next action for the active quest. Off by default — Avermere is open-ended (Doc #2 design). On for cognitive accessibility, learning differences, returning players. |
| **Glossary tooltip** | On | Hovering on archaic words ("ye," "thee," "moongate," "Avatar's Garden") shows modern equivalent in tooltip. Per Doc #33 (vocabulary glossary lives there). |
| **Combat target indicator** | Off | Outlines currently-targeted enemy with a luminance-distinct ring. Off by default to preserve sprite aesthetic; on for clarity. |
| **Reduced text density mode** | Off | Strips non-essential lore text from UI panels (item flavor text moved behind a "Read more" affordance; quest journal shows current stage only by default). Combat log truncates to last 10 lines. |
| **Auto-pause on combat start** | Off | Single-player only. Pauses the simulation on first hostile detection so the player can plan. Off by default; on for cognitive accessibility, motor accessibility, or simply players who want planning time. |
| **Notes panel** | Always available | Player-authored notes panel. Markdown-light. Searchable. Persisted per-Avatar (Doc #21). |
| **Auto-bookmarks of recent dialogue** | On | Last 5 dialogue sessions auto-saved with NPC name, location, and full transcript. Reachable from the journal. Memory aid for any player; especially useful for cognitive accessibility. |
| **Difficulty slider** | Standard | Per Doc #2; orthogonal to accessibility but listed here because reduced difficulty is sometimes the right cognitive accommodation. |

---

## 8. Photosensitivity & Seizure Safety

Compliance:

- All effects audited against **ITPC 2014** (Photosensitive Epilepsy Analysis Tool) and **WCAG 2.3.1** (no flash > 3 Hz at > 25% screen area).
- Specific spells (Lightning, Fireball area effects, In Vas Por teleport flash) have a **dampened render variant** auto-selected when the photosensitivity option is on. The dampened variant preserves the spell's visual identity (color, shape) at lower luminance and frequency.
- Screen flash on damage capped at **10% luminance change** with the photosensitivity option on; default mode caps at 25%.
- High-frequency strobing (above 3 Hz) is **forbidden** in any UGC SFX or VFX. The Doc #19 §8 Virtue Validator extends to a Photosensitivity Validator that flags violations during compile (see §10).

Pre-launch external audit per §11 includes photosensitivity certification.

---

## 9. Multiplayer Fairness Considerations

Some accessibility options confer mechanical advantage. To keep PvP fair without blocking accessibility:

| Option | Single-player | Cooperative shard | PvP shard (Chaos, duels) |
|---|---|---|---|
| Combat slow mode (§5) | Allowed | Allowed (everyone in the cooperative party experiences slowdown) | **Disabled** |
| Auto-aim assist (Phase 2+) | Allowed | Allowed | **Disabled** |
| Auto-pause on combat start (§7) | Allowed | Allowed | **Disabled** (the world doesn't pause) |
| Auto-pickup (§5) | Allowed | Allowed | Allowed |
| All other accessibility options | Allowed | Allowed | Allowed |

**Server enforces.** Clients cannot override the fairness rules; the server inspects the per-Avatar accessibility profile (§12) on PvP shard entry and refuses to honor disabled options. The disabling is explicit: when the player enters a Chaos Shard, the UI shows "Combat slow mode unavailable on this shard" with the rationale.

Cooperative shards (private parties of friends) allow all options because the trade-off is between the player's fun and zero non-consenting parties.

This trade-off is documented transparently in the in-game accessibility settings UI, not buried in a EULA.

---

## 10. UGC Accessibility Requirements

UGC creators are required to meet a baseline of accessibility for content they publish. Enforced at compile time by the Doc #19 §8 style validator (extended in this doc):

| Requirement | Validator check |
|---|---|
| Subtitle for any voice line | UGC dialogue with attached voice clip must include `Response.text` (already required by Doc #17 §2; validator confirms non-empty) |
| Alternative for any color-only information | Validator flags UGC that relies on color alone to convey state (e.g., "the green door is locked, the red door is open"); creator must add a luminance-distinct sprite variant or text label |
| Description for any visual puzzle | Pure visual puzzles (e.g., a tile-rotation puzzle) must include an `examine` text that describes the puzzle's current state for screen-reader users |
| No flashing > 3 Hz | Photosensitivity validator (§8) rejects any UGC SFX or VFX above the threshold |
| Subtitled cinematics | Any cinematic with audio narration must ship with subtitle track |

Highly accessible UGC (passes all checks plus optional bonus criteria — e.g., described view tuned for the dungeon, color-blind-tested visual puzzles) earns an **Accessibility badge** displayed in the Hall of Wonders (UGC discovery surface, Doc #7).

The badge is a positive incentive, not a punitive lever — non-badged UGC is still publishable as long as it meets the baseline.

---

## 11. Testing Requirements

| Phase | Testing |
|---|---|
| Per-release internal QA | Accessibility test suite as part of every release branch CI: keyboard-only run-through of Highmere Town Opening; screen-reader run-through of Avatar's Garden; combat slow mode regression; subtitle sync regression |
| Beta program | Beta tester pool intentionally includes accessibility-focused testers (sourced via partnerships in §15) |
| Pre-launch external audit | External accessibility consultancy — AbleGamers Accessible Player Experience review, SpecialEffect consultation, or Game Accessibility Conference reviewer engagement. Vendor selection `[OPEN]` per §15. Audit outcomes published with launch notes per `[BR]` transparency commitment |
| Post-launch | Bug-tracker accessibility tag with prioritized triage; accessibility issues are P1 by default |

---

## 12. Settings Persistence

| Property | Detail |
|---|---|
| Storage | All accessibility settings stored on the Avatar's `PlayerInventory`-scoped settings record (Doc #21 save schema). |
| Per-Avatar default | Each Avatar carries its own profile. Useful for shared accounts (a household with one motor-accessibility player and one not). |
| Cross-shard sync | Optional. When enabled, the profile syncs across all of an account's Avatars on all shards. Default off (per-Avatar isolation). |
| Cross-account import / export | Profile exportable as a portable JSON blob; importable by a new account. Useful for new players who already know their needs from other games. The account portal (web) accepts the same blob. |
| Versioning | Profile schema versioned; engine upgrades migrate forward without resetting settings. |
| Telemetry | Aggregate-only. Counts of "how many Avatars have option X enabled" surface on the live-ops dashboard (Doc #28); per-Avatar profile is never surfaced to other players or admins beyond the Avatar's own session. |

---

## 13. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 13.1 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/avatar/{id}/accessibility_profile` | `{ visual: {...}, auditory: {...}, motor: {...}, cognitive: {...}, photosensitivity: {...}, screen_reader: {...}, version: int }` | `inspect.read` for **OWN avatar only** (per Doc #15 §7.3 cross-avatar gating rule). Reading another Avatar's profile returns `ERR_CAPABILITY`. |
| `forge://meta/accessibility/standards` | `{ wcag_version: "2.1 AA", cvaa: true, xag_tier: "Advanced", itpc_certified: bool, last_audit_date: Date \| null, audit_vendor: string \| null }` | `inspect.read` (no shard binding required — meta resource) |

### 13.2 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `set_accessibility_option` | `avatar.basic` | `key: string`, `value: bool \| int \| string` | `{ ok: true, applied_at: ServerTick, requires_restart: bool }` | Updates the per-Avatar profile. Most options are client-side and do not signal the server beyond profile sync. Options affecting simulation (combat slow mode) signal the server, which then enforces §9 fairness rules on PvP shards. |

```json
// set_accessibility_option
{
  "name": "set_accessibility_option",
  "input": {
    "envelope": "VerbEnvelope",
    "key": "string",
    "value": "boolean | int | string"
  },
  "returns": {
    "ok": "boolean",
    "applied_at": "ServerTick",
    "requires_restart": "boolean"
  }
}
```

Errors specific to accessibility tools: `ERR_UNKNOWN_OPTION` (key not recognized), `ERR_OPTION_DISABLED_ON_SHARD` (e.g., combat slow mode requested on Chaos Shard, see §9), in addition to standard codes from Doc #14 §5.

### 13.3 Capability Notes

- Most accessibility settings are client-side; only those affecting simulation (combat slow mode, auto-pickup as a verb-emit modifier, auto-pause on combat start) need server signaling.
- `accessibility_profile` is **own-avatar only**. Other players cannot enumerate accessibility options on a target Avatar — that would be both a privacy leak and a potential griefing vector ("I see this player has reduced precision tolerance, I'll exploit it").
- Subscriptions on `accessibility_profile` deliver one event per option change; useful for QA harnesses and the in-game settings UI confirming server-side acknowledgement.

---

## 14. Phase 1 Prototype Scope (12-Week "Highmere Alive")

Per Doc #11. Accessibility is a Phase 1 launch commitment, not a Phase 2 add-on.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Keyboard remap (§5) | **Full.** Every action remappable. | None |
| Subtitles (§4) | **Enabled by default**, all 8 Phase 1 voice lines (Doc #27 §12) subtitled | Audio-cue captions |
| Color-blind modes (§3) | 4 modes scaffolded; **Deuteranopia palette tested end-to-end** in Highmere | Protanopia, Tritanopia palettes tuned (scaffolded but not playtested) |
| Text size (§3) | 3 size steps (100/125/150%) | 175%, 200% steps and full UI reflow |
| Combat slow mode (§5) | Implemented (single-player vertical slice has no PvP — fairness rules trivially hold) | PvP shard enforcement (no PvP exists yet) |
| Reduced motion (§3) | Implemented — disables screen shake and bloom | Particle disable; camera transition disable |
| Per-channel volume (§4) | 5 sliders per Doc #27 §12 | None |
| Visual SFX cues (§4) | Deferred — Doc #27 §12 lists this as Phase 2 | All visual cue work |
| Mono audio mode (§4) | Deferred per Doc #27 §12 | |
| Screen reader (§6) | **Scaffolded** — UE5 Slate accessibility tree exposed to OS APIs; dialogue list announced; described view skeleton | Full audit on all UI panels (Phase 2); described view selection algorithm tuning (Phase 2) |
| One-handed control schemes (§5) | **Deferred to Phase 2** | All |
| Described view (§6.6) | Skeleton only — nearest-5-within-5-tiles fallback; no selection algorithm | Full implementation; dense-scene selection algorithm (`[OPEN]` §15) |
| Photosensitivity (§8) | Damage flash capped at 10%; spell dampening scaffolded for Lightning | Full audit; Fireball + In Vas Por dampened variants |
| UGC accessibility validator (§10) | Subtitle check + flashing check enforced at compile | Color-only and visual puzzle description checks (Phase 2 when more UGC is being made) |
| Settings persistence (§12) | Per-Avatar profile stored in shard DB | Cross-shard sync; cross-account import/export portal |
| MCP surface (§13) | `accessibility_profile` resource present (read-only); `set_accessibility_option` tool present | None |
| External audit (§11) | Initial review with one consultancy (vendor TBD per §15) before Phase 1 alpha closes | Full audit pre-launch |

**Phase 1 success metric:** a keyboard-only player completes the four Highmere milestones (Doc #24 §3.4) without ever touching the mouse; a Deuteranopia-mode player visually distinguishes the Companions from Highmere townsfolk and from a hostile rat without confusion; a HoH player completes the same milestones using subtitles only; a screen-reader user navigates the dialogue keyword list and learns one new keyword from Carlin the beggar (Doc #24 §3.3).

---

## 15. Open Questions

1. `[OPEN]` **External accessibility audit vendor selection.** AbleGamers (US-based, Accessible Player Experience formal review process), SpecialEffect (UK-based, hands-on player testing), or independent Game Accessibility Conference reviewer? Trade-offs: AbleGamers gives a structured rubric and badge; SpecialEffect gives more direct player feedback; an independent reviewer is cheaper. Recommendation: engage AbleGamers for the formal APX review and SpecialEffect for hands-on testing — twin-track pre-launch. Final call deferred to launch budget.
2. `[OPEN]` **WCAG vs XAG-MS priority where they conflict.** WCAG 2.1 AA and Xbox Accessibility Guidelines occasionally conflict — e.g., WCAG prefers persistent focus indicators on all interactive elements; XAG-MS prefers minimal HUD chrome in immersive modes. Working assumption: §2's tiered conflict resolution rule (XAG for game patterns, WCAG for shared-with-web patterns). Final call deferred until console certification submission.
3. `[OPEN]` **Console certification accessibility requirements.** PS5 and Xbox have specific platform-mandated accessibility requirements (text size minimums, captions on by default, screen-reader API conformance). When Avermere ships to console, the Phase 2/3 scope must explicitly meet those mandates — possibly including features not yet planned (e.g., haptic-feedback alternatives for audio cues on DualSense controllers). Defer to console-port doc.
4. `[OPEN]` **Described view (§6.6) selection algorithm for dense scenes.** A Highmere town square at noon may contain 50+ entities within 5 tiles (NPCs, items, fixtures). Reading all of them is unusable. Candidate algorithms: nearest-N (simple, may miss important distant entities); priority-weighted (NPCs > containers > items > fixtures, may surprise users with weird ordering); query-mode (player asks "what NPCs?" or "what doors?", limited but predictable). Recommendation: query-mode default with a "list everything" fallback. Needs UX research with screen-reader users; partner with audit vendor (`[OPEN]` 1).
5. `[OPEN]` **AbleGamers / SpecialEffect partnership form.** Formal sponsorship (badge in credits, joint marketing, structured review at every milestone) vs. arms-length consultation (paid review at milestones only). Sponsorship deepens commitment and credibility; arms-length is cheaper and lower-bandwidth. Recommendation: sponsorship if budget allows, arms-length as fallback. Intersects `[OPEN]` 1.
6. `[OPEN]` **Phase 1 Tutorial Shard accessibility playtesting.** Doc #24 §14 defers Tutorial Shard (Path B) to Phase 2; Phase 1 only ships Highmere Town Opening (Path A). Open: should at least one of the Phase 1 alpha accessibility playtests target Path A (the only path available)? Recommendation: yes — Path A is harder to accessibility-test (no diegetic tutors, learning is by trial), so testing Phase 1 on Path A surfaces real friction. Final call deferred to alpha test plan.
7. `[OPEN]` **Cognitive accessibility for the Eight Virtues.** The Virtue system (Doc #5) is inherently abstract — Truth, Mercy, Courage, Justice, Devotion, Honor, Insight, Humility are concepts learned through dialogue, consequence, and meditation, not explained in a tutorial. For cognitive disabilities (learning differences, abstract-reasoning challenges), the system may be opaque. Open: do we add an in-game Virtue glossary that explains each Virtue in concrete terms, with examples? Risk: makes the system feel "gamified" rather than discovered. Recommendation: yes, accessible via an opt-in cognitive-accessibility toggle in the journal; off by default to preserve the discovery experience. Final call deferred to Doc #5 amendment.
8. `[OPEN]` **Economy of accessibility for UGC.** §10 imposes accessibility requirements on UGC creators. For hobby creators (a single dungeon authored on a weekend), meeting all checks may be too much friction and they may abandon publishing. For professional creators, it is reasonable. Open: do we tier the checks (baseline-only for hobby, full for badged), give creators an "I will fix this in v2" grace period, or accept that some hobby UGC will not publish? Recommendation: baseline-only checks at compile; full checks gate the Accessibility badge but not publishing. Final call deferred to Doc #19 §8 amendment.
9. `[OPEN]` **Voice-chat transcription latency budget (Phase 3+).** §4 lists server-side STT for inbound voice. Latency target unknown; if the captioned text lags voice by > 1.5 s the HoH player loses social presence. Phase 3+ scoping concern.
10. `[OPEN]` **Dyslexia-friendly font licensing.** §3.4 lists OpenDyslexic (open-license, free) or "licensed equivalent" (e.g., Dyslexie, Sylexiad). OpenDyslexic is free but some users find it visually distracting; commercial alternatives are cleaner but cost per-seat. Recommendation: ship OpenDyslexic in Phase 1, evaluate commercial in Phase 2 based on player feedback.

---

## 16. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #2 §1 (mouse-driven default), Doc #24 §12 (resolves engine-wide TBD) |
| §2 Standards alignment | Doc #1 §5 (license alignment heritage) |
| §3 Visual | Doc #10 §2.2 (palette swap mechanism), §2.4 (font), Doc #11 (Phase 1 vertical slice) |
| §4 Auditory | Doc #27 §9 (subtitle/visual cue spec — extended here), Doc #17 §2 (`Response.text` always present), Doc #33 (`LocalizedString` for subtitles + cues) |
| §5 Motor | Doc #2 §4.1 §4.2 (mouse + keyboard baseline), Doc #13 §2 (verb registry coverage), Doc #16 (combat slow mode applies to combat verbs), Doc #15 §6.2 (auto-pickup still triggers `steal`) |
| §6 Screen reader | Doc #17 §2 §3 (keyword-driven dialogue surface), Doc #15 §5.4 (paperdoll), Doc #16 (combat verb result announcement), Doc #23 (spatial frame for described view) |
| §7 Cognitive | Doc #2 design (open-ended), Doc #5 (Virtue glossary `[OPEN]` §15-7), Doc #33 (archaic-word glossary intersection), Doc #21 (notes panel persistence) |
| §8 Photosensitivity | Doc #19 §8 (validator extension), Doc #16 (spell visuals) |
| §9 Multiplayer fairness | Doc #6 §2 (shard types), Doc #22 (server-enforced), Doc #14 §3 (capability gating) |
| §10 UGC | Doc #7 (UGC editor), Doc #19 §8 (validator extension), Doc #29 (moderation hooks for accessibility-flagged content) |
| §11 Testing | Doc #28 (telemetry for accessibility option uptake) |
| §12 Persistence | Doc #21 (save format — settings record), Doc #15 §1.5 (per-Avatar persistence) |
| §13 MCP | Doc #14 §3 (capabilities), §5 (tool envelope), §6 (resources), Doc #15 §7.3 (own-avatar only) |
| §14 Phase 1 | Doc #11 (vertical slice), Doc #14 §8 (minimal MCP), Doc #24 §14 (Highmere milestones), Doc #27 §12 (audio Phase 1 baseline) |

---

End of Document #34.
