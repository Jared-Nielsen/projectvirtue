Document #33: Localization & Internationalization
Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Localization Lead]
Status: Living Technical Reference — Normative spec for string externalization, locale-keyed catalogs, keyword-dialogue localization, per-locale voice, UGC translation, and the `translator` capability tier. Resolves Doc #17 §14 [OPEN] item 2 (`LocalizedString`); resolves Doc #24 §15 [OPEN] item 3 (path-choice prompt archaic register).

Depends on: #1 Vision §5 (Garriott as Creative Steward), #3 World Bible §7 (Alternate Britannia mode), #5 Virtues, #7 UGC Modding §3 §4 (multilingual UGC), #10 Art & Audio Style Bible §5.3 (British-accented period delivery), #11 Phase 1 Vertical Slice, #13 Core Schema, #14 MCP Server Surface §3 (capabilities), §5 (tools), §6 (resources), #17 Dialogue & NPC Schedule §2 (keyword model, `LocalizedString`), §3 (universal keywords), #24 Onboarding & Tutorial Flow §4 (Tutor NPCs), §15 (path-choice prompt), #27 Audio System §6 (per-locale voice files), #28 Telemetry & Live Ops, #29 Moderation, #34 Accessibility (in flight).

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Project Virtue.

---

## 1. Localization Philosophy

The original Ultima VII used archaic-English register ("Faithful Avatar! Hast thou returned?") as an immersion anchor, equal in weight to the painted tiles and orchestral score `[BG]`. Project Virtue must localize to many languages without flattening that register where the target language supports an analogous one (German `Du`/`Ihr`, Spanish `vos`, Japanese keigo levels, etc.); modern i18n tooling (ICU MessageFormat, locale-keyed catalogs, glossary-driven translation memory) is the means, never the end `[BR]`. The keyword-driven dialogue surface (Doc #17 §1) and the silent-Avatar tradition (Doc #10 §5.3) further constrain the problem: keywords must localize while preserving uniqueness within an NPC tree, and player dialogue is never voiced — so the localization burden lives in NPC text, NPC voice, UI, journal, and item names. UGC content (Doc #7) authored by players in their own primary language adds a multi-source, multi-target translation pipeline that no prior Ultima attempted.

---

## 2. String Externalization Architecture

### 2.1 Catalog addressing

Every player-facing string lives in a locale-keyed catalog, addressed by:

```
i18n://strings/{locale}/{namespace}.{key}
```

| Component | Form | Example |
|---|---|---|
| `locale` | BCP-47 language tag, optionally with a register suffix `{lang}-{region}-{register}` | `en-US-archaic`, `de-DE`, `ja-JP`, `es-ES` |
| `namespace` | one of: `dialogue`, `ui`, `system`, `journal`, `item_name`, `quest`, `region_name`, `keyword`, `cutscene`, `tutorial`, `error`, `audio_caption` | `dialogue` |
| `key` | dot-segmented stable identifier; never a free-text English string | `lord_british.greeting.first_meet` |

Reference catalog: **`en-US-archaic`** — Britannia's "King's English with archaic register". All other locales translate from this reference. A secondary `en-US-modern` catalog exists for accessibility (Doc #34) and TTS fallback (§7.5).

### 2.2 Catalog format — ICU MessageFormat

Catalogs are JSON-encoded; values are ICU MessageFormat strings. ICU is mandatory because it is the only widely-supported format that handles plurals, gender, ordinals, select, and nested arguments correctly across the Tier 1–3 locales (§4).

```json
{
  "lord_british.greeting.first_meet": "Faithful Avatar! Hast thou returned?",
  "shop.purchase.confirm": "{name} hath {item_count, plural, =0 {nothing in mind} one {a single # to purchase} other {# items to purchase}}.",
  "journal.virtue.deltas.gained": "{virtue, select, Honesty {Thou hast acted with Honesty.} Compassion {Thou hast shown Compassion.} other {Thy {virtue} hath risen.}}"
}
```

Engine **never concatenates** strings. The dispatcher always passes a context-var dictionary to the MessageFormat formatter; per-locale grammar is the formatter's responsibility.

### 2.3 Locale fallback chain

```
resolve(locale, namespace, key) -> string:
  1. try i18n://strings/{locale}/{namespace}.{key}
  2. try i18n://strings/{locale-lang-only}/{namespace}.{key}     // de-AT → de
  3. try i18n://strings/en-US-archaic/{namespace}.{key}          // reference
  4. try i18n://strings/en-US-modern/{namespace}.{key}           // accessibility/TTS baseline
  5. return "⟦{namespace}.{key}⟧"                                // visible placeholder; CI fails build if observed in QA
```

The placeholder form is intentionally ugly so that missing strings cannot ship undetected through QA. The l10n validator (§15) rejects any build where any reachable key in any Tier 1 locale falls past step 1.

### 2.4 Hot-reload (dev only)

In `dev` mode the catalog server watches the catalog directory; on file change, all open dialogue sessions, journals, and UI panels re-resolve their strings. Production catalogs are immutable per build; live patches ship as full catalog re-deploys versioned alongside the build.

---

## 3. String Types and Registers

### 3.1 StringRecord schema

```ts
type Locale          = string                       // BCP-47, optionally with -{register}
type Namespace       = "dialogue" | "ui" | "system" | "journal" | "item_name"
                     | "quest" | "region_name" | "keyword" | "cutscene"
                     | "tutorial" | "error" | "audio_caption"
type StringKey       = string                       // dot-segmented stable identifier
type Register        = "Archaic" | "Period" | "Modern" | "Casual"

type StringRecord = {
  namespace:           Namespace
  key:                 StringKey
  locale:              Locale
  register:            Register
  content:             string                       // ICU MessageFormat string
  translator_notes:    string                       // context for translators; not shipped
  voice_clip_uri:      string | null                // when string has VO; null otherwise
  source_revision:     string                       // git SHA of the en-US-archaic source last translated from
  last_modified:       Timestamp
  reviewed_by:         TranslatorId | null          // cultural review sign-off (§11)
}
```

`source_revision` lets the translation memory (§12) flag stale translations whose English source has changed.

### 3.2 Register table

| Register | Speakers | Example (en-US) | Notes |
|---|---|---|---|
| `Archaic` | Lord British, Companions, formal NPCs, ritual contexts | "Hast thou the courage, Avatar?" | Default for all named NPCs in Britannia per Doc #10 §5.3 period-delivery target |
| `Period` | Guards, clergy, scholars, shopkeepers | "Wouldst tell me thy business, friend?" | Slightly less archaic; standard medieval-fantasy register |
| `Modern` | Beggars, children, low-rank or comic NPCs | "Can you tell me where the bakery is?" | Class/age signal; never used by named principals |
| `Casual` | Tutorial Shard tutors only (Doc #24 §4) | "What's up? Try clicking the apple." | **Restricted to Toridan, Avila, Quill** (Doc #24 §4.2); clarity > immersion is permitted only inside the instanced garden. **Forbidden in any persistent shard.** |

Per-locale register equivalents are documented in the per-locale **Translator Brief** (§12.4) — e.g., `de-DE` Archaic uses `Ihr` formal address, archaic verb conjugations, and uncommon vocabulary; `ja-JP` Archaic uses 候文-leaning sentence endings and `〜じゃ` for Lord British.

### 3.3 Register selection

Each NPC archetype declares its `default_register`; each `Response` may override per-line. The dispatcher passes both `locale` and `register` to the catalog resolver, which expects the catalog file to provide a per-register variant where the language supports it; languages without an analogous register fall back to a single "elevated formal" variant flagged in the per-locale Translator Brief.

---

## 4. Locale Tier List

| Tier | Locales | Target | Voice | Cultural Reviewer |
|---|---|---|---|---|
| **Tier 1 (launch)** | `en-US-archaic`, `en-GB` | Phase 2 launch | Full VO per Doc #27 §6.4 | Internal |
| **Tier 2 (within 6 months)** | `de`, `fr`, `es-ES`, `ja`, `zh-Hans` | Launch + 6mo | Subtitles at launch; VO incremental (§7.4) | One per locale |
| **Tier 3 (within 18 months)** | `es-LA`, `pt-BR`, `it`, `ko`, `ru`, `pl`, `zh-Hant` | Launch + 18mo | Subtitles only; TTS optional (§7.5) | One per locale; RTL readiness (§9) |
| **Tier 4 (community)** | any | Triggered when a language community demand reaches **1,000 active Avatars** | Subtitles only; community TTS opt-in | Community translator collective |

Tier counts: **Tier 1 = 2**, **Tier 2 = 5**, **Tier 3 = 7**, **Tier 4 = open**. `en-US-archaic` is reference; `en-GB` differs in spelling and a small set of lexical items (lift/elevator etc., though Britannia is a fantasy setting, so divergence is small).

Tier promotion: Tier 4 → Tier 3 occurs when a community-maintained locale crosses (a) 1k active Avatars, (b) 95% string coverage, and (c) cultural-review sign-off. Promotion grants in-house QA support and the Tier-3 budget for VO incremental recording.

---

## 5. Keyword Dialogue Localization

### 5.1 The hard problem

Doc #17 §3 establishes that the dialogue surface is the player **clicking** keywords, not typing free text. Localizing keywords requires that:

1. The displayed string in the player's locale feels natural and in-period.
2. Within a single NPC's currently-visible keyword set, no two displayed strings collide (a guard tree with `name`, `job`, `bye`, `watch`, `gate` must, in every locale, render five distinct displayable terms).
3. The engine matches the player's click against a stable identifier, not the displayed text — so the dispatcher logic never needs to know the locale.

### 5.2 Schema

```ts
type CanonicalKeyword = string                      // ALL_CAPS_STABLE_ID, e.g. "FELLOWSHIP", "WATCH", "GATE"

type Keyword = {
  canonical_id:        CanonicalKeyword
  locale_strings:      Map<Locale, KeywordRendering>
  default_register:    Register
}

type KeywordRendering = {
  display:             string                       // rendered token, e.g., "Wahrheit", "vérité"
  short_form:          string | null                // for tight UI; null = use display
  pronunciation_hint:  string | null                // IPA; for TTS NPCs (§7.5)
}
```

The Doc #17 §2 dialogue tree changes: `keywords: Map<Keyword, ResponseId>` becomes `keywords: Map<CanonicalKeyword, ResponseId>`. The engine matches `say_keyword(canonical_id)` against the map; the UI renders `locale_strings[active_locale].display`.

### 5.3 Universal keywords (Doc #17 §3)

| Canonical | en-US-archaic | de-DE | fr-FR | es-ES | ja-JP |
|---|---|---|---|---|---|
| `NAME` | name | Name | nom | nombre | 名 (na) |
| `JOB` | job | Werk | métier | oficio | 仕事 (shigoto) |
| `BYE` | bye | Lebewohl | adieu | adiós | さらば (saraba) |
| `THIEF` | thief | Dieb | voleur | ladrón | 盗人 (nusubito) |
| `MURDERER` | murderer | Mörder | meurtrier | asesino | 人殺し (hitogoroshi) |
| `LIAR` | liar | Lügner | menteur | mentiroso | 嘘つき (usotsuki) |
| `FELLOWSHIP` | fellowship | Gefährtenschaft | Confrérie | Hermandad | 同志会 (dōshikai) |
| `AVATAR` | avatar | Avatar | Avatar | Avatar | アバタール |

Universal keyword renderings are locked once Tier 1 ships; changes require lore-team + cultural-reviewer sign-off and a build-version bump (because old saves reference these IDs in dialogue history).

### 5.4 Uniqueness validator

For every `(locale, dialogue_tree, session-state)` triple, the validator (§15) computes the set of visible keywords (per Doc #17 §4) and ensures the displayed strings are mutually unique under a normalized comparison (case-folded, accent-normalized, whitespace-collapsed). Collision = build-fail.

```
for tree in all_dialogue_trees:
  for locale in catalog_locales:
    for state in enumerate_visible_subsets(tree):
      displays = [render_keyword(kw, locale) for kw in state]
      if has_collisions(displays):
        report_error(tree, locale, state, displays)
```

The enumeration is bounded: most NPC trees have ≤ 16 keywords with ≤ 8 visible at any moment, so the visible-subset count stays manageable (< 256 per tree per locale).

### 5.5 Archaic-register translator pass

After the standard translation pass, the per-locale archaic-register translator does a second pass over keywords specifically. Worked example: German `WAHRHEIT` ("truth", modern) vs. `WAHRLICH` ("verily", archaic) for the conceptual cluster around `HONESTY`. The choice depends on the NPC's register: a Lord-British-tier NPC takes the archaic form; a beggar takes the modern. Both forms point to the same `CanonicalKeyword`; the rendering is per-NPC-register, supplied by `KeywordRendering.display` resolved against `Response.register`.

### 5.6 Keyword discovery from world events

Reactive keywords (Doc #17 §3.1) are injected per-locale at session-open time; the canonical IDs are the same (`THIEF`, `MURDERER`, etc.) but the rendered display draws from the active locale's catalog. Auto-discovery from rumors (Doc #17 §9.4) — where a rumor's `subject` becomes a dynamic keyword — uses `slugify(subject_canonical_name)` for the `CanonicalKeyword`, with the per-locale display resolved from the entity's `region_name` or `item_name` namespace.

---

## 6. Dynamic String Assembly

### 6.1 ICU formatting contract

```
format(locale, namespace, key, vars: Record<string, any>) -> string:
  template = resolve(locale, namespace, key)
  return ICU.format(template, vars, locale)
```

The engine **never** does string interpolation in code. Any `+`, template literal, or `printf`-style format reaching player-facing text is a build-fail flagged by the linter (§15.2).

### 6.2 Plural / select / ordinal

ICU plural categories vary by locale (English: one/other; Russian: one/few/many/other; Polish: one/few/many/other with different boundaries; Japanese: other only). Translators write the categories the language requires; the engine passes a numeric var.

```
"{count, plural, =0 {no apples} one {an apple} other {# apples}}"
"{count, plural, =0 {keine Äpfel} one {ein Apfel} other {# Äpfel}}"
"{count, plural, =0 {りんごはありません} other {りんごが#個}}"
```

### 6.3 Gender awareness

NPC and Avatar gender are stored on the entity (Doc #13 `IdentityComponent`); both are exposed as ICU select vars when relevant.

```
"{npc_gender, select,
  feminine {Sie sagt: ...}
  masculine {Er sagt: ...}
  other {Es spricht: ...}
}"
```

For locales with grammatical gender on adjectives or past participles (es, fr, de, ru, pl, etc.), translators may reference both `avatar_gender` and `npc_gender` in any string. The Translator Brief (§12.4) per locale enumerates the genders the language supports.

### 6.4 Vocative and case forms

Slavic locales (ru, pl) frequently require declined name forms (vocative for direct address). The glossary (§12) stores per-name declension tables for principal characters; ICU `select` is used with a `case` var:

```
"{case, select,
  nom {Lord British awaits.}
  voc {Lord British, hear me!}
  other {Lord British's word is law.}
}"
```

For Tier 1–2 locales, only nominative and vocative are typically required for principals.

---

## 7. Voice Acting Per-Locale (extends Doc #27 §6)

### 7.1 Storage and addressing

Doc #27 §6.1's URI scheme is preserved:

```
voice://{locale}/{npc_id}/{response_id}.opus
```

The locale segment carries the same BCP-47 form as the catalog. A missing voice file is **not an error**; the client falls back to text-only render (Doc #27 §6.3).

### 7.2 Locale-VO presence matrix

```ts
type VoicePresence = {
  npc_id:              EntityId
  response_id:         ResponseId
  locales_with_vo:     Locale[]
  tts_locales:         Locale[]                     // §7.5 fallback marker
}
```

Resolved at dialogue-update time; the client receives `locales_with_vo` for the current response so the UI can show a "voiced" indicator only when appropriate.

### 7.3 Tier 1 production

Tier 1 launch: full English VO for all named NPCs per Doc #27 §6.4. The `en-GB` catalog reuses the same Tier 1 `en-US-archaic` voice files (the actor is directed in British-accented period delivery per Doc #10 §5.3), so `en-US-archaic` and `en-GB` share VO assets with separate text catalogs.

### 7.4 Tier 2+ launch

Subtitles at locale launch; VO recorded incrementally based on player demand and budget. Demand signal: the Doc #28 telemetry tracks per-locale dialogue-session counts; locales crossing 10k weekly sessions enter the VO budget queue, prioritized by player-survey support.

### 7.5 TTS fallback

For Tier 4 community locales and any Tier 3 response without recorded VO, optional TTS rendering fires server-side, cached to CDN under `voice://tts/{locale}/{model_version}/{npc_id}/{response_id}.opus`, using the per-NPC `NpcVoiceProfile` (Doc #27 §6.5). The client prepends a one-time-per-session audible disclaimer ("This NPC's voice is machine-generated.") and an on-screen badge on every TTS-rendered subtitle. TTS is opt-in per player; default off.

---

## 8. UGC Content Localization (extends Doc #7)

### 8.1 Authoring locale

UGC creators author in their primary language. The submission carries:

```ts
type UgcManifestL10n = {
  original_locale:     Locale
  translations:        Map<Locale, UgcTranslationManifest>
}

type UgcTranslationManifest = {
  locale:              Locale
  translator_id:       AccountId | "MACHINE"
  reviewed_by:         AccountId | null             // human-review approver, if any
  coverage_pct:        f32                          // 0..1; enforced ≥ 0.95 to be browseable in {locale}
  approved_by_creator: bool                         // creator must accept community translations
  submitted_at:        Timestamp
}
```

### 8.2 Auto-translation

Popular UGC (≥ 100 plays in the past 30 days, per Doc #28 telemetry) qualifies for auto-translation into Tier 1–3 locales via the Doc #29 moderation-grade translation pipeline. Auto-translated content is:

- tagged `MACHINE_TRANSLATED` in the in-game browser ("Hall of Wonders", Doc #7 §3),
- shown alongside an "awaiting human review" badge,
- queued for community translator review (§8.3).

### 8.3 Community translation contributions

Any account with the `translator` capability tier (§14.3) may submit translations for any UGC. The original creator receives a notification and must approve before the translation goes live. If the creator is inactive (no login in 90 days), a Doc #29 moderator may approve on their behalf (community-good fallback).

### 8.4 Translator credit

The UGC content browser surfaces translator credit alongside creator credit. Translators accumulate a public credit log on their profile; this enters the Doc #28 leaderboards as a separate "Translator" category (no revenue share at launch; see §16 [OPEN]).

### 8.5 Quality gating

A UGC translation is only browseable in `{locale}` when `coverage_pct ≥ 0.95` AND (`reviewed_by != null` OR `translator_id ∈ verified_translators`). Below threshold, the UGC item appears in `{locale}`'s Hall of Wonders only with a "partial translation; English fallback" badge.

---

## 9. Right-to-Left (RTL) Support

### 9.1 Scope

Tier 3 reserves capacity for RTL targets (Arabic primarily); engine UI must support text mirroring without engine refactor when the locale ships.

### 9.2 What mirrors and what does not

| Surface | RTL behavior |
|---|---|
| Game world (isometric Britannia) | **Not mirrored.** Geometry, NPC walk paths, sprite faces are unchanged. The world is the world. |
| Inventory paperdoll (Doc #15 §5) | Mirrored: equipment slots flip horizontally; armor visual on Avatar sprite is unchanged |
| Dialogue panel (Doc #17 §5) | Mirrored: keyword list right-aligned; response text right-aligned; portrait flipped to right edge |
| Journal | Mirrored: page layout, entry order in column |
| HUD overlays (status, virtues) | Mirrored |
| In-world text (signs, books) | Read in target language; sign sprites themselves are not mirrored. A book opened from inventory presents an RTL-laid-out reading panel |
| Map / region overlays | Compass and labels mirrored; map tiles are not |

### 9.3 Phase plan

| Phase | RTL state |
|---|---|
| Phase 1 | Out of scope; no RTL locales. |
| Phase 2 | Architectural readiness: every UI panel built with a `text_direction` property; flip transforms wired; no production RTL locale yet. |
| Phase 3 | Implementation: at least one RTL locale (likely `ar`) shipped with full UI mirror QA pass. |

---

## 10. Number, Date, Time, Currency Formatting

### 10.1 ICU per locale

All numbers, dates, real-world times, currencies, percentages format via ICU on the client, locale-aware. The engine passes raw numeric / timestamp values; the catalog string places them with `{value, number, ...}`, `{date, date, ...}`, `{amount, number, ::currency/USD}` etc.

### 10.2 Britannian fictional time and units

Britannia uses a fictional calendar (Doc #3) and fictional units (gold pieces; stones for weight per Doc #15). The fictional system is **canonical**; the locale only affects digit shape and separator characters, not the fictional names.

| Surface | Locale effect |
|---|---|
| In-game time ("Trinsic, 14:30 of the third day") | Hour digits formatted per locale digit script (e.g., Arabic-Indic); separator per locale |
| Coin amounts ("47 gold pieces") | Number formatted per locale; "gold pieces" is a translatable noun in `item_name.gold_pieces` |
| Weight ("3 stones") | Number formatted per locale; "stones" stays canonical (translated word, but the unit system is unchanged); see §16 [OPEN] for the alternative-units question |
| Real-world live-event scheduling (Doc #28) | Standard ICU date/time format per locale |

---

## 11. Cultural Review

### 11.1 Reviewer per locale

Each Tier 1/2/3 locale has a contracted regional games-industry consultant who performs a cultural review pass before each major content release.

### 11.2 Review checklist

| Dimension | Scope |
|---|---|
| Religious imagery | The Eight Virtues are presented with religious-adjacent ritual (shrines, abbeys, vows, Codex). Reviewer flags imagery that reads as offensive or proselytizing in target culture. |
| Violence presentation | Blood, dismemberment, undead, demonic depictions checked against regional ratings authority guidelines (CERO, USK, PEGI, etc.). |
| Gender presentation | NPC gender distribution, romance content (if any), companion dynamics. |
| Sensitive topics | Region-specific (e.g., depictions of historical violence, swastika-adjacent symbology, censored color/word lists). |
| Naming collisions | Personal names, place names that map to slurs or politically loaded terms in target culture. The glossary (§12) blocks known collisions; reviewer adds region-specific entries. |

### 11.3 Alternate Britannia mode (Doc #3 §7)

Where a region requires content edits that affect canon (e.g., a banned symbol on a tapestry, a rephrased oath), the reviewer may push a region-specific UGC variant via Doc #3 §7's Alternate Britannia mechanism. The variant is gated to the affected region's locale-default players; canonical content remains accessible via locale switch.

### 11.4 Garriott approval (Doc #1 §5)

Per Doc #1 §5, Garriott as Creative Steward retains final word on lore-affecting changes. Cultural-edit changes that touch named principals, the Eight Virtues, the Codex, or Lord British's domain require Garriott sign-off through the standard Doc #1 §5 review channel before the cultural-reviewer change ships.

---

## 12. Translation Memory & Glossary

### 12.1 Translation Memory (TM)

Centralized TM database. Every translation submitted to any locale is stored with `(source_revision, source_text, target_text, translator_id, context_namespace)`. Subsequent translations of the same source segment surface the prior translation as a suggestion, ensuring consistency across documents and dialogue trees.

```ts
type TmEntry = {
  source_locale:       Locale                       // always en-US-archaic at present
  source_revision:     string                       // git SHA
  source_text:         string
  target_locale:       Locale
  target_text:         string
  context_namespace:   Namespace
  translator_id:       AccountId
  approved:            bool
  created_at:          Timestamp
}
```

### 12.2 Glossary

Canonical translations for game terms. Owned by the lore team plus per-locale cultural reviewer; **locked once published** (changes require version bump and migration of existing strings).

| Term type | Translation policy | Examples |
|---|---|---|
| Character names | **Do not translate** the personal name. Honorifics translate per locale's archaic register. | "Lord British" stays; the honorific "Lord" maps to a per-locale archaic-register equivalent (de: "Fürst" or "Herr"; ja: 卿 or 様 depending on register) |
| Place names | Do not translate Britannia, Trinsic, Yew, Empath Abbey, etc. (proper nouns) | "Britannia" stays in all locales |
| Eight Virtues | **Do translate** (they are common-noun concepts) | Honesty / Ehrlichkeit / honnêteté / 誠 |
| The Codex | Do not translate "Codex"; do translate the appositive ("Codex der Höchsten Weisheit") | |
| Item types | Translate (common nouns) | "longsword" → "Langschwert" |
| Magical reagents | Do not translate the canonical name; gloss in journal | "Mandrake Root" stays canonical with a gloss panel showing local name |
| Spell names | Do not translate the casting word (canonical magic syllables); translate the descriptive name | "Vas Flam" stays; "Great Flame" → per-locale |

The glossary is enforced at translation-submission time: a translator-submitted catalog string that translates a "do-not-translate" term is flagged for review.

### 12.3 Glossary as resource

Exposed via MCP at `forge://i18n/glossary` (§14.2) read-only for all clients with the `inspect.read` capability.

### 12.4 Per-locale Translator Brief

A markdown brief per locale, owned by the cultural reviewer, containing:

- archaic-register guidance (e.g., German `Ihr`/`Du` policy for Britannian formal speech),
- gender enumeration the language supports,
- declension/case requirements (Slavic),
- plural categories (ICU),
- name declension tables for principals,
- forbidden-symbol list (cultural review),
- known-collision name list,
- example translations for each register × namespace pair.

Briefs are versioned; translators reference `brief_revision` in their submissions.

---

## 13. Accessibility Intersection (cross-link Doc #34)

### 13.1 Subtitle font selection per locale

Subtitle font is locale-aware: CJK locales require different font weight, size, and line-height than Latin scripts. The Doc #34 accessibility doc owns the per-locale font selection table; this doc contributes the locale signal.

### 13.2 Screen reader support

Doc #34's screen-reader pipeline reads the active-locale string content. The screen reader uses the same catalog resolver (§2) plus a locale-aware speech synthesizer; per-locale voice characteristics (rate, pitch defaults) live in Doc #34.

### 13.3 Audio captions (Doc #27 §9)

Audio-cue captions (`[door creaks open]`) are `LocalizedString` and resolve through this doc's catalog. The placeholder caveat in Doc #27 §9 is **resolved by this doc**: captions live under namespace `audio_caption`.

### 13.4 Cross-link

Full accessibility surface in Doc #34 (in flight). This doc provides the localization plumbing; Doc #34 owns the accessibility policy.

---

## 14. MCP Surface Additions

> Amendments to Doc #14 §3 (capabilities), §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 14.1 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://i18n/locales` | `{ locales: LocaleStatus[] }` — `LocaleStatus = { locale, tier, coverage_pct, vo_coverage_pct, last_updated, status: "live" \| "beta" \| "community" }` | `inspect.read` |
| `forge://i18n/strings/{locale}/{namespace}` | full `StringRecord[]` for the (locale, namespace) | **`translator` capability** (§14.3); `inspect.read` denied |
| `forge://i18n/glossary` | full glossary (§12.2) | `inspect.read` |
| `forge://i18n/tm?source_text=...&target_locale=...` | `TmEntry[]` matching the query | `translator` capability |
| `forge://i18n/translator_brief/{locale}` | per-locale Translator Brief markdown (§12.4) | `translator` capability |

### 14.2 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `submit_translation` | `translator` | `string_key: { locale, namespace, key }`, `content: ICU_message`, `register: Register`, `translator_notes: string` | `{ ok: true, awaits_review: bool, tm_entry_id: string }` | Writes to draft catalog; live after review per §15.3. |
| `submit_ugc_translation` | `ugc.author` (creator) **or** `translator` (community contribution; creator approval required per §8.3) | `creation_id`, `manifest: UgcTranslationManifest`, `strings: StringRecord[]` | `{ ok: true, pending_creator_approval: bool }` | Adds translation to UGC manifest; goes live on creator approval (or 90-day inactive override per §8.3). |
| `report_string_issue` | any (`inspect.read`+) | `string_key`, `locale`, `issue_type: "incorrect" \| "stale" \| "offensive" \| "missing"`, `notes` | `{ ok: true, ticket_id: string }` | Creates a ticket in the Doc #29 moderation queue's localization sub-queue. |

```json
// submit_translation
{
  "name": "submit_translation",
  "input": {
    "envelope": "VerbEnvelope",
    "string_key": { "locale": "Locale", "namespace": "Namespace", "key": "string" },
    "content": "string",
    "register": "Archaic | Period | Modern | Casual",
    "translator_notes": "string"
  },
  "returns": {
    "ok": "boolean",
    "awaits_review": "boolean",
    "tm_entry_id": "string"
  }
}

// submit_ugc_translation
{
  "name": "submit_ugc_translation",
  "input": {
    "envelope": "VerbEnvelope",
    "creation_id": "string",
    "manifest": "UgcTranslationManifest",
    "strings": "StringRecord[]"
  },
  "returns": {
    "ok": "boolean",
    "pending_creator_approval": "boolean"
  }
}
```

Errors specific to l10n tools: `ERR_TRANSLATOR_CAPABILITY` (caller lacks `translator`), `ERR_GLOSSARY_VIOLATION` (translation rewrites a do-not-translate term), `ERR_KEYWORD_COLLISION` (submitted keyword translation collides with another visible keyword in some tree), `ERR_COVERAGE_BELOW_THRESHOLD` (UGC translation `coverage_pct < 0.95`), `ERR_STALE_SOURCE` (source_revision behind current).

### 14.3 New Capability Tier — `translator`

A new capability tier inserted into Doc #14 §3:

| Capability | Tools enabled | Resources enabled | Typical client |
|---|---|---|---|
| `translator` | `submit_translation`, `submit_ugc_translation`, `report_string_issue` | `inspect.read` set + `forge://i18n/strings/{locale}/{namespace}`, `forge://i18n/tm`, `forge://i18n/translator_brief/{locale}` for the locales the translator is approved on | community translators, contracted localization agencies |

`translator` is **read+write l10n catalogs only, no game state**. A `translator` capability cannot submit any verb (no `talk`, no `move_to`, no `examine`); cannot read player state; cannot read non-public NPC dialogue trees. Translators see strings (the leaves) without the dialogue-tree context that would reveal quest secrets — context for translation comes from the `translator_notes` field and the per-locale Translator Brief.

A translator approved for one locale (e.g., `de-DE`) cannot read or write other locales without separate approval. Approval is per-locale, granted by the localization lead via Doc #29 admin tools.

### 14.4 Capability composition

A single account may hold both `avatar.full` (for play) and `translator` (for l10n work) on separate sessions; the bindings are session-scoped per Doc #14 §3, so a translator session cannot accidentally submit a verb to the game.

---

## 15. Phase 1 Prototype Scope

Per Doc #11. Single-locale; the externalization scaffold and validator deliver the architectural payoff so Phase 2 can add locales without code change.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Catalog format | ICU MessageFormat; JSON files; `i18n://strings/{locale}/{namespace}.{key}` resolver | Hot-reload in production; CDN-served catalogs |
| Locale set | **`en-US-archaic` only** (single-locale build); `en-US-modern` skeleton present for accessibility/TTS | All Tier 1+ locales |
| String externalization | All ~200 Phase 1 strings catalog-loaded; **no hard-coded player-facing strings in code** (linter-enforced) | Per-locale full string set |
| Registers | `Archaic` and `Casual` registers used (`Archaic` for Britain NPCs; `Casual` permitted only inside the Phase 2 Tutorial Shard, which is deferred per Doc #24 §14) | `Period`, `Modern` registers (no NPCs require them in Phase 1) |
| Keywords | `CanonicalKeyword`-based dispatch with single-locale `KeywordRendering`; uniqueness validator runs in CI | Multi-locale keyword renderings |
| Voice | English VO for the 8 Phase 1 voice lines per Doc #27 §12, addressed via `voice://en-US-archaic/...` | Per-locale VO; TTS |
| Dynamic assembly | ICU plurals + select for the Phase 1 strings that need them (~12 strings) | Gender-aware grammar (no Phase 1 strings require it); declension tables |
| RTL | **Not in scope.** UI panels written with hard-coded LTR; `text_direction` property added in Phase 2. | All RTL work |
| Number/date/time | ICU formatting active; Britannian fictional time renders correctly | Real-world live-event localization |
| UGC localization | **Not in scope.** Phase 1 UGC editor (Doc #7 §6) is single-locale (English). | All §8 |
| Cultural review | Not yet relevant (single locale, internal team is reviewer) | Per-locale reviewers Phase 2+ |
| Translation memory | TM database scaffold present; only seeded with the `en-US-archaic` source corpus | Multi-locale TM, suggestions UI |
| Glossary | Glossary file present (canonical names locked) | Per-locale glossary entries |
| MCP | None of §14 tools required for Phase 1 (matches Doc #14 §8 minimal-MCP posture); `forge://i18n/locales` and `forge://i18n/glossary` resources available read-only | All §14 tools, `translator` capability tier wired in Phase 2 |
| Validator | L10n validator runs in CI: missing-key check, unused-key check, ICU-syntax check, keyword-uniqueness check (single-locale trivially passes) | Multi-locale collision check, register-coverage check |

### 15.1 Phase 1 success metric

A Phase 1 build passes CI with zero hard-coded player-facing strings in any code file, all ~200 dialogue/UI/journal strings load from catalog, the Britain demo (Doc #11) renders identically to the pre-externalization build, and a deliberate experiment of swapping `en-US-archaic` → a placeholder `xx-pseudo` catalog (each string wrapped in `[XX ... XX]`) produces a visibly pseudo-localized build with no missing strings.

### 15.2 Linter / validator rules

| Rule | Enforcement |
|---|---|
| No hard-coded player-facing string in `.cpp`, `.h`, `.cs`, `.lua`, `.bp` files (except test fixtures and dev-mode debug overlays) | Pre-commit hook + CI |
| All `format(...)` calls supply both `namespace` and `key` from `string_key` constants, never literals | CI |
| ICU MessageFormat parses cleanly for every catalog string | CI |
| Every `(locale, namespace, key)` referenced in code exists in the catalog | CI (pre-commit check on the Tier 1 catalog) |
| Every key in the catalog is referenced from at least one code site or designer tool (no dead entries) | CI warning |
| Keyword-uniqueness validator (§5.4) | CI |
| Glossary do-not-translate enforcement | CI on translation submit |

### 15.3 Translation review flow

Translator submits via `submit_translation` → ICU-syntax + glossary checks pass → `awaits_review = true` → cultural reviewer or l10n lead approves via Doc #29 review tool → string promoted from draft to live catalog → next build picks up the new string. For Tier 1 launch, all strings require human review; Tier 2+ allows trusted translators (≥ 100 approved submissions) to ship low-risk strings without per-string review.

---

## 16. Open Questions

1. `[OPEN]` **Translation Management System (TMS).** Crowdin vs. Lokalise vs. Smartcat. Affects API integration with the catalog, translator UX, glossary import/export format, and cost. Working assumption: Crowdin (broadest community translator base, mature API); decision deferred to localization lead's contract review.
2. `[OPEN]` **Volunteer translator recruitment model.** Doc #7's UGC revenue-share (70/30) is the obvious analog — should community translators get a share of premium UGC sales for translations they produced? Pro: aligns with Doc #7 ethos; con: introduces revenue accounting per-string. Working alternative: cosmetic-credit-only for community translators, contracted rate for Tier 1/2/3 production translators.
3. `[OPEN]` **Voice cast across locales.** Different actors per language (regional authenticity, higher cost) vs. single contracted multilingual studio (consistency, lower cost). Working assumption: per-language casting for Tier 1 principals (Lord British, the Companions); studio-block for Tier 2+ named NPCs.
4. `[OPEN]` **Player-name Unicode handling.** Player names contain characters from one locale played by users in another (e.g., a Cyrillic-named Avatar visible to a `ja-JP` player). Open: Unicode normalization form (NFC vs. NFKC), per-locale profanity filter (`Бля` is profanity in ru but innocuous Latin transliteration in fr), display-font fallback chain. Cross-link Doc #29 moderation.
5. `[OPEN]` **Britannian unit/coinage localization.** Stones (weight), gold pieces (currency), Britannian months (calendar) are canonical — but should a `de-DE` player see "47 Goldstücke" (translated noun, canonical concept) or have a regional variant ("47 Dukaten") for flavor? Working assumption: translated nouns only, canonical concepts preserved.
6. `[OPEN]` **Per-locale legal review.** Does Garriott's Doc #1 §5 sign-off requirement apply to every per-locale cultural-edit change, or only to changes that affect canonical principals/Virtues? Recommendation: per-locale changes affecting only flavor text are reviewer-only; anything touching named principals or the Eight Virtues escalates to Garriott. Final call deferred to Doc #1 amendment.
7. `[OPEN]` **AI-generated UGC translation pipeline.** As Doc #7 grows, AI-assisted UGC authoring is plausible. Open: should AI-generated original UGC content be translated by the same auto-translation pipeline (§8.2), or held to a stricter human-review gate (since the source itself is machine-generated)? Cross-link Doc #29 moderation policy.
8. `[OPEN]` **Register inference for community-submitted UGC strings.** A community UGC creator writing in `fr-FR` may not know the Britannian register conventions. Should the editor (Doc #7) prompt for register per string, infer from NPC archetype, or default-to-Period and let the creator override? Working assumption: infer from NPC archetype with override.
9. `[OPEN]` **Re-recording cost when a source string changes.** Editing a translated `en-US-archaic` source line invalidates all per-locale VO clips for that line. Open: budget envelope for re-recording vs. accepting "subtitles updated; voice unchanged" with subtitle-takes-precedence indicator. Cross-link Doc #27 §6.

---

## 17. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #10 §5.3 (period-delivery), Doc #1 §5 (Garriott steward) |
| §2 Externalization | Doc #17 §2 (`LocalizedString` resolved here), Doc #27 §9 (subtitle text), Doc #34 (in flight) |
| §3 Registers | Doc #10 §5.3, Doc #24 §4 (Casual register restricted to Tutorial Shard) |
| §4 Locale Tiers | Doc #28 (per-locale telemetry signal for promotion) |
| §5 Keyword L10n | **Resolves Doc #17 §14 [OPEN] item 2**; Doc #17 §2 (`Keyword` schema), §3 (universal keywords), §3.1 (reactive keywords) |
| §6 Dynamic Assembly | Doc #13 (gender on entity), Doc #17 §2 (`Response.text` formatting) |
| §7 Voice Per-Locale | Doc #27 §6 (extends `voice://` URI scheme), Doc #27 §6.5 (TTS hooks), Doc #27 §12 (Phase 1 VO scope) |
| §8 UGC L10n | Doc #7 §3 (publishing pipeline), §4 (creator economy), Doc #28 (popularity signal), Doc #29 (translation moderation) |
| §9 RTL | Doc #15 §5 (paperdoll), Doc #17 §5 (dialogue panel) |
| §10 Number/Date/Time | Doc #3 (Britannian calendar), Doc #15 (stones, gold pieces), Doc #28 (live-event scheduling) |
| §11 Cultural Review | Doc #3 §7 (Alternate Britannia), Doc #1 §5 (Garriott sign-off), Doc #29 (admin tooling) |
| §12 TM & Glossary | Doc #3 (canonical names), Doc #5 (Virtue names) |
| §13 Accessibility | Doc #34 (in flight); **resolves Doc #27 §9 LocalizedString placeholder** |
| §14 MCP | Doc #14 §3 (capabilities — adds `translator` tier), §5 (tools), §6 (resources) |
| §15 Phase 1 | Doc #11 (vertical slice), Doc #14 §8 (minimal MCP), Doc #24 §14 (Tutorial Shard deferred) |
| §15.1 Resolves | **Doc #24 §15 [OPEN] item 3** (path-choice prompt archaic register) — the prompt is now `i18n://strings/en-US-archaic/tutorial.path_choice.prompt` with per-locale archaic-register translations specified in the Translator Brief (§12.4) |
| §16 Open Questions | Doc #1 §5 (Garriott review), Doc #7 §4 (creator economy), Doc #27 §6 (VO budget), Doc #29 (moderation policy) |

---

End of Document #33.
