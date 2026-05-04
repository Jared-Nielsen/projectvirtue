# 39 — Console Certification (PS5 & Xbox)

**Updated 2026-05-04 per Doc #41.** Console certification applies to the **UE5 CLIENT only**. The TS web client never ships to console (it is a web-browser prototype, not a console SKU; nothing in this document targets it for cert). The Rust server backend is platform-agnostic — it speaks Protobuf over the wire to any conformant client — and is unaffected by TRC/XR cert requirements. Cross-ref: **Doc #41 (Engine & Stack ADR)**.

Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Console Platform Lead]
Status: Living Technical Reference — Normative spec for PlayStation 5 and Xbox Series X|S submission of the **UE5 client**. Resolves Doc #34 §15 [OPEN] item 3 (console-mandated accessibility requirements). Cross-references Doc #37 (Voice Chat), Doc #38 (Data Export & GDPR Portability), and **Doc #41 (Engine & Stack ADR)**.

Depends on: #1 Vision §4 (success metrics), #2 GDD §1 (input model), #6 Persistent World §2 (shard types), §3 (cross-shard identity), #7 UGC §3 (publishing pipeline), #11 Prototype Scope & Milestone Roadmap, #14 MCP Server Surface §3 (capabilities), #15 Character/Party/Inventory §1 §5 §7.3, #21 Save Format & Shard DB §3.11 §7, #22 Network Protocol & Replication, #27 Audio System §6 (voice URI scheme), §9 (subtitles), #28 Telemetry §3 §4 §8, #29 Moderation & Admin Tools, #32 Anti-cheat & Security Hardening, #33 Localization & i18n §4 (locale tiers), §11 (cultural review), #34 Accessibility §2 (standards alignment), §13 (MCP surface), #37 Voice Chat (parallel doc), #38 Data Export & GDPR Portability (parallel doc).

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[U4]` = *Ultima IV: Quest of the Avatar* (1985). `[BR]` = original to Britannia Reborn.

Platform-program acronyms used throughout this doc:

- **TRC** — Sony's Technical Requirements Checklist (PS5).
- **XR / XBO** — Microsoft's Xbox Requirements / Xbox Best Observed (Xbox Series X|S, formerly XR for Xbox One).
- **Lotcheck** — Nintendo's certification program. Britannia Reborn is **not** targeting Switch in current scope (§1.4); Lotcheck addressed only briefly.
- **APX** — AbleGamers Accessible Player Experience review (per Doc #34 §11). Not a platform program but co-scheduled with cert (§16).

---

## 1. Console Certification Philosophy

Britannia Reborn is, at its heart, a PC-native simulation game [BG] — fullscreen mouse-driven UI, keyword-clickable dialogue (Doc #17 §3), 256-color isometric tile world (Doc #2 §1), and a verb-dispatched simulation core (Doc #13 §4). Per Doc #41, the **production client is UE5** (desktop + PS5 + Xbox); a separate **TS / PixiJS web client** exists as a prototype for browser play and **never ships to console** — every console requirement in this document applies to the UE5 client exclusively. Console support is therefore a deliberate translation of the UE5 client, not a default port: the input model becomes gamepad-first, the UI gains a focus-and-cursor hybrid mode, and the persistent-world server topology (Doc #6) gains platform-aware identity bridges (§3) and platform-mandated parental controls. The certification effort is sized accordingly — **one full submission cycle per platform per launch beat**, treated with the same engineering rigor as a major content drop, and budgeted into the milestone roadmap (Doc #11) starting at Phase 3. Two principles govern every design choice in this document. (1) **Parity by default, divergence by design.** The same Avatar, the same shard, the same Virtue (Doc #5) on every platform. Where a platform mandates divergence (e.g., PSN-required gamertag display rules), the divergence is documented here, defended in the cert submission notes, and visible to the player as a localized in-game disclosure rather than a silent platform behavior. (2) **Cert checklists are design constraints, not afterthoughts.** The top-50 most-failed TRC/XR items (§17) are validated in CI from the first console-targeted milestone, not at the end of the submission window. Every doc in this set whose surface a cert testers will touch — Onboarding (Doc #24), Audio (Doc #27), Telemetry (Doc #28), Localization (Doc #33), Accessibility (Doc #34), Voice Chat (Doc #37), Data Export (Doc #38) — is listed in the parity matrix in §4 with its responsible owner.

---

## 2. Cert Program Overview

### 2.1 PlayStation 5 — Sony TRC

Sony's submission program for PS5 titles is governed by the **Technical Requirements Checklist (TRC)**, distributed under NDA via DevNet (formerly the SDK developer portal). The TRC is versioned (TRC 5.x at time of writing); the version current at submission time is the binding contract.

| Phase | Activity | Owner |
|---|---|---|
| Pre-cert | TRC self-review against current revision; internal QA pass against checklist | Console QA Lead |
| Submission build | Build sent to Sony QA via SubmissionTool; binary signed with current PS5 dev cert | Build/Release Eng |
| Cert pass | Sony QA runs full TRC pass; returns a Cert Report with Pass/Fail per item, severity-graded | Sony |
| Bug-fix pass | Failing items addressed; new build resubmitted | Console QA + dev team |
| Release | TRC-passed build moves to Release Candidate; submitted to PlayStation Store backend | Release Eng |

Severity grading on TRC report items maps to cert outcome:

| Severity | Meaning | Outcome if not fixed |
|---|---|---|
| **Must** (red flag) | Hard cert failure — title cannot ship | Resubmit |
| **Should** (yellow flag) | Strong recommendation — title may ship with documented dispensation | Negotiated |
| **Comment** (info) | Notes / observations | No action required |

Britannia Reborn's policy (§17): every Must-flag is fixed; every Should-flag is fixed unless an explicit dispensation is filed and signed off by Console Platform Lead.

### 2.2 Xbox Series X|S — Microsoft XR

Microsoft's submission program is governed by the **Xbox Requirements (XR)** checklist for retail compliance, plus the **Xbox Best Observed (XBO)** advisory set. The Microsoft Game Development Kit (GDK) ships the XR checklist within the developer documentation; the version current at submission is binding, and XR is updated on a roughly quarterly cadence.

XR submissions follow the Xbox Submission Tool / Partner Center workflow:

| Phase | Activity | Owner |
|---|---|---|
| Pre-cert | XR self-review; XR Test App Lite local pass | Console QA Lead |
| Submission | Build + metadata uploaded via Partner Center; cert ticket opened | Build/Release Eng |
| Cert pass | Microsoft cert team runs full XR pass; returns Cert Report | Microsoft |
| Bug-fix pass | As §2.1 | Console QA + dev team |
| Release | XR-passed build flagged Release in Partner Center | Release Eng |

XR severity maps similarly to TRC (Critical / High / Medium / Low / Info).

### 2.3 Nintendo Switch — Lotcheck

**Nintendo Switch is not in current scope.** Should it become in scope (Phase 4+ or later), Lotcheck is the relevant certification program. Lotcheck differs from TRC/XR in that Nintendo's hardware constraints are tighter (memory, storage, CPU) and the simulation density of Britannia (Doc #6 §2 region-loading) requires explicit profiling against Switch SKUs. Lotcheck content guidelines are stricter on dismemberment, blood, and certain religious imagery — cross-link Doc #33 §11 (cultural review). A separate console-port doc would be required; this doc only flags the dependency.

### 2.4 PC console-equivalents (mention only)

Steam Deck, Steam Big Picture, ROG Ally, and similar handheld-PC form factors are **not console certifications** but share input/UI surface with consoles. Britannia Reborn's gamepad UI mode (§4.1) is shared between consoles and Steam Deck on the UE5 client; Steam Deck Verified is a separate certification program owned by the PC platforms doc (TBD), not this one.

### 2.5 TS / PixiJS web client — not in scope

Per Doc #41, the TS / PixiJS web client is a browser-only prototype for web play. It **never targets console** — there is no console SKU of the web client, no submission flow, no TRC/XR work, and no entries in §17's checklist apply to it. Wherever this document discusses "the client" in a cert context, the UE5 client is meant. The Rust server treats UE5 and TS clients identically over the wire (Protobuf), but only the UE5 build enters console submission.

---

## 3. Account & Identity

### 3.1 Linkage model

A Britannia Reborn account is a first-party identity (email + password, see Doc #38 §3 for portability) that links one or more platform identities. The link is bidirectional and platform-mandated:

```
   Britannia Account (br_account_id)
   ├── PSN account (psn_id, gamertag, country)
   ├── Xbox Live account (xuid, gamertag, country)
   └── PC account (steam_id_64 | epic_id | direct)
```

Each platform identity may link to **at most one** Britannia account. A second link attempt from the same platform identity returns a clear error (the existing link must be unlinked first via the account portal).

### 3.2 Sign-in flow on console

| Platform | Sign-in flow |
|---|---|
| PS5 | Player must be signed into PSN. Title launches → Britannia auth handshake uses the PSN auth ticket → Britannia account resolved via prior link or creates new account on first launch. |
| Xbox Series X|S | Player must be signed into Xbox Live. Title launches → Britannia auth handshake uses the Xbox auth ticket (XSAPI) → Britannia account resolved as above. |

First-launch on console with no prior link prompts an **in-game account-link flow** rather than a web redirect (TRC and XR both prefer in-game flows; deep web redirects are graded down).

### 3.3 Display name policy

| Surface | Display name source |
|---|---|
| Avatar nameplate (in-world) | Britannia Avatar name (the in-fiction character name, per Doc #15 §1) |
| Friends list, party UI | Platform gamertag (PSN ID or Xbox gamertag) |
| Voice chat overlay (Doc #37) | Platform gamertag |
| In-fiction dialogue, journal, NPC speech | Britannia Avatar name only |
| Trophy/achievement notification | Platform gamertag (platform-rendered overlay; not engine-controlled) |

This dual-name model resolves the otherwise-irreconcilable tension between platform display rules ("the player must always see the gamertag they signed in as") and Britannia's diegesis ("Iolo addresses you as `Avatar`, never as `xX_PvPGod_Xx`"). Both names display side-by-side in friends list and party panels; the in-world world is name-only Avatar.

### 3.4 Parental controls

Both PSN and Xbox Live expose per-account parental control settings the title **must** honor. The platform reports these settings in the auth ticket.

| Parental Control | Britannia behavior when restricted |
|---|---|
| Online play disabled | Persistent shards (Virtue, Chaos) refused; only Classic Shard (Doc #6 §2) and Avatar's Garden (Doc #24 §4) accessible. In-fiction prompt at moongate: "Thy guardians have not yet permitted thee to walk these wider lands." No retry, no nag. |
| Voice chat disabled | Doc #37 voice chat fully disabled — neither send nor receive. Text chat falls back per Doc #37 §6. |
| Text chat with strangers disabled | Text chat restricted to friends-list-only counterparties. Trade-chat (Doc #18) restricted similarly. |
| User-generated content disabled | UGC editor (Doc #7) hidden in main menu; UGC content browser ("Hall of Wonders") shows only first-party content. |
| Cross-platform play disabled | §5.3 enforces — player sees only same-platform players in party / shard browser. |
| Age-restricted content | Mature themes (Doc #2 GDD §3 — moral choice depictions, violence) not gated by age in current scope; if jurisdictional rating raises issues, the Doc #33 §11.3 Alternate Britannia mechanism applies. |

Parental control state is **read-only on the client**; no in-game UI offers to override. Changes require the parent / guardian to use the platform's account management UI.

### 3.5 Cross-progression

A single Britannia Avatar is reachable from any linked platform — that is the design promise. The Avatar lives on a Britannia shard (Doc #6 §3); platform identity controls *which Britannia account the session is signed in as*, not *which Avatar exists*. Concretely:

| Action | Source platform | Destination platform | Behavior |
|---|---|---|---|
| Resume a quest | PS5 | PC | Same Avatar, same shard, same quest state. The persistent world is authoritative (Doc #6 §3). |
| Resume a quest | PC | Xbox Series X | Same Avatar, same shard, same quest state. |
| Cross-platform party | PS5 + PC + Xbox | n/a | Subject to §5.3 crossplay opt-in. |
| Avatar reset (Doc #15 §1.5) | Any | All | Reset propagates globally; the Avatar is single-instanced. |

Cross-progression is **a property of the persistent world**, not a feature implemented per-platform. Single-player Classic Shard (which can play offline; Doc #21 §2.1) syncs on next online session per the standard cloud-save flow (§7).

---

## 4. Crossplay & Cross-Save Policy

### 4.1 Crossplay opt-in

By default, all platforms are **enrolled in crossplay** at account creation; the player may opt out via the in-game settings menu (which writes a flag the matchmaker honors). Some jurisdictions and parental control profiles require crossplay opt-out by default; the platform-reported parental flag (§3.4) overrides the user setting.

```
crossplay_state(account, session) =
    if parental_controls.cross_platform_disabled then "disabled"
    elif user_pref == "off"                       then "disabled"
    else                                              "enabled"
```

When `crossplay_state == "disabled"`, the matchmaker filters peers to the **same platform family** (PS5 family vs. Xbox family vs. PC family). Persistent shards that are predominantly cross-platform (which is most of them) display a clear notice on entry: "Crossplay is disabled for thy session; thou wilt see only fellow players from thy platform."

### 4.2 Parity expectations

Crossplay obligates content parity. The shipping rule is unambiguous:

| Surface | Parity rule |
|---|---|
| Maps, regions, content | **Identical.** No platform exclusives. (Cosmetic platform-themed UGC is permitted but not bundled with the title.) |
| Game-mechanical balance | **Identical.** Same combat formulas, same Virtue weights (Doc #5), same recipe yields. |
| Patches and content drops | **Simultaneous.** Submission cadence (§16) coordinates platform cert windows so all platforms receive the same week. Where a platform's cert misses the window, the other platforms hold the patch — the persistent world remains on the prior version on all platforms until parity is restored. |
| Microtransactions catalog | **Identical SKUs at identical prices in local currency** (subject to platform price-tier rounding; §13.3). |
| Console-platform features (haptics, Quick Resume, Activities) | **Platform-divergent by design.** These are the features in §10–§11 that platform expects you to use on its hardware. PC users see no DualSense haptics; that is not a parity violation. |

### 4.3 Currency & entitlement reconciliation

The hardest part of crossplay. A player buys 500 "Sovereigns" (premium currency, see §13.2) on PS5; later they sign in on Xbox and use those Sovereigns on the same Avatar. The currency is account-level, not platform-level — but the **purchase** is platform-level (Sony took 30%; Microsoft did not).

The model:

| Concept | Storage | Notes |
|---|---|---|
| **Premium currency balance** | Britannia account (server-authoritative) | Account-wide; reachable from any platform. |
| **Earned in-game currency** (gold pieces, Doc #18) | Britannia Avatar | As §3.5; cross-progression by default. |
| **Purchase of premium currency** | Platform-of-purchase (PSN, Microsoft Store, Steam, Epic) | Platform handles payment, refund, dispute resolution. Britannia receives a server-side webhook from the platform's commerce backend confirming purchase; the balance is then granted account-wide. |
| **Entitlements** (cosmetics, named items, season passes) | Britannia account | Granted on purchase. **Never revoked** unless platform-level refund is processed (§4.4). |
| **Refund** | Platform-of-purchase | Platform processes; webhook tells Britannia to revoke the entitlement and decrement the granted balance. |

This model is platform-acceptable on PS5 and Xbox provided two conditions: (1) the platform's own purchase flow is the only purchase path on that platform (no in-game web redirect to a third-party store, which both Sony and Microsoft prohibit for paid content under their TRC/XR), and (2) the entitlement is granted **only after** the platform's commerce backend confirms purchase (no optimistic grants).

### 4.4 Refund and dispute handling

| Trigger | Behavior |
|---|---|
| Platform refund issued | Platform sends refund webhook → Britannia revokes the entitlement; if balance has already been spent, the account goes negative until earned via gameplay or further purchase. Negative balances do not block play; they simply cap further purchases. |
| Chargeback | Platform sends chargeback webhook → as refund, plus account is flagged for manual review (Doc #29). |
| Player disputes purchase in-game | Title directs the player to the platform's purchase history UI. **Britannia does not refund directly**; both platforms reserve refunds to themselves. |

---

## 5. Networking

### 5.1 Network model

Britannia Reborn uses authoritative servers (Doc #22). The console client connects out to Britannia's region servers; there is no peer-to-peer matchmaking, no listen server, no console-hosted shard. This simplifies cert significantly:

| Cert concern | Why it's mitigated |
|---|---|
| NAT type traversal (TRC requires graceful fallback) | All traffic is client → server, outbound TCP/UDP. No inbound connections required on console. NAT type does not affect connectivity. |
| Port forwarding documentation | Outbound only; no port forwarding required. The title's network help screen says exactly this. |
| Server outage messaging | Single authoritative server domain; outage messaging is centralized (§5.4). |

### 5.2 Port and protocol usage

| Protocol | Port | Purpose |
|---|---|---|
| HTTPS (TCP 443) | 443 | Auth handshake; CDN asset fetch (UGC, voice clips); REST control plane (account portal, Doc #38 export). |
| WSS (TCP 443) | 443 | Persistent connection to region server (Doc #22 protocol); WebSocket-over-TLS. |
| QUIC (UDP 443) | 443 | Optional: replication channel where Doc #22's QUIC profile is enabled. Falls back to WSS if blocked. |

All traffic on port 443 is the deliberate design — corporate firewalls, hotel networks, and consumer ISPs allow 443 by default. The title's connection-troubleshooting screen lists exactly two endpoints (`auth.britanniareborn.com` and `region-{us,eu,ap}.britanniareborn.com`) and the single port `443`.

### 5.3 Crossplay enforcement at the protocol layer

The matchmaker tags every session with its platform family. Region servers honor crossplay opt-out by filtering replicated player list (Doc #22 replication scope) to the same-family subset. **Players who crossplay-opted-out cannot see, party with, or trade with cross-platform players** — even if those players are physically standing next to them in the world. This is enforced server-side; the client cannot override.

### 5.4 Server outage messaging

TRC and XR both require graceful messaging when online services are unavailable. Britannia's outage states and player-facing messages:

| State | UI surface | Localized [Doc #33] |
|---|---|---|
| Routine maintenance (planned) | Pre-launched: in-fiction Royal Herald NPC announcement on shard with maintenance window. At maintenance start: title-screen banner. | Yes |
| Authoritative server unreachable (this client) | Login flow shows: "Britannia is dreaming. Try again in a moment." Auto-retry with exponential backoff. | Yes |
| Service-wide outage (all clients) | Title-screen banner with status URL: "Britannia rests. See {status_url} for tidings." The status URL is a static page on a separate CDN that does not depend on the game server. | Yes |
| Single-player Classic Shard available offline (Doc #21 §2.1) | When online services unreachable AND player has a Classic Shard Avatar: option offered to play offline. | Yes |
| Title update available | "A new chapter awaits. Restart to install." Mandatory if version skew with server exceeds the configured tolerance. | Yes |

All outage strings live in `i18n://strings/{locale}/system.outage.*` per Doc #33 §2.

### 5.5 Online-service certification specifics

| Cert item | Britannia behavior |
|---|---|
| Title must handle PSN / Xbox Live sign-out gracefully | Sign-out triggers a server disconnect notice with auto-resume on sign-in. Saves are flushed before disconnect. |
| Title must handle network change (WiFi to mobile hotspot) | TCP/UDP reconnection logic per Doc #22; player sees a "Reconnecting..." overlay; if reconnection succeeds within 60s, session resumes; else returned to title with a clear reason. |
| Title must not present the user with Sony / Microsoft service errors verbatim | All platform errors are translated into Britannia's in-fiction messaging via the §5.4 table. The platform error code is logged (Doc #28) for QA / support but never shown raw. |
| Online play available without a paid subscription where platform allows free online for free-to-play (Xbox does) | Britannia Reborn's monetization model (Doc #11 §16 candidate) is `[OPEN]`; if free-to-play, Xbox Live Gold / Game Pass Core not required. If paid title, platform's standard subscription requirement applies. |

---

## 6. Save Data

### 6.1 Save model recap

Britannia's save model is split (Doc #21):

| Category | Storage | Console relevance |
|---|---|---|
| Persistent shard state (Virtue, Chaos, etc.) | Server-authoritative shard DB | No client-side save. The world is what it is; the player Avatar's state is server-stored. |
| Avatar state (inventory, Virtue, journal) | Server-authoritative on persistent shards; client-local on Classic Shard offline mode | §6.2 cloud save applies to Classic Shard local saves. |
| Settings (graphics, audio, accessibility, controls) | Per-Avatar in shard DB (Doc #34 §12) AND a per-account settings blob synced to platform cloud save (§6.2) | Cloud sync ensures settings persist across console sign-outs and reinstalls. |
| Screenshots / clips | Platform's media gallery (PS5 captures, Xbox captures) | §11.3 — engine respects platform capture API. |

### 6.2 Cloud save

| Platform | Cloud save provider | What's stored |
|---|---|---|
| PS5 | PlayStation Plus cloud storage (when player has PS Plus) | Settings blob (small, ≤ 256 KB). Local Classic Shard save (≤ 16 MB per Avatar). |
| Xbox Series X|S | Xbox cloud saves (always available, free) | Same as above. |

Both platforms require the title to register save sets with the platform cloud-save API; the engine treats save writes as atomic with cloud sync (write local → enqueue cloud upload → confirm sync in-frame status).

> **Save format & UE5 platform APIs (per Doc #41 / Doc #21 update).** The Rust server owns the canonical save format. On console, the cert-compliant write path is the **UE5 platform save APIs** (PS5 `sceSaveData*` / Xbox `XGameSave*` / Gen4-equivalent wrappers exposed by UE5's online subsystem). The UE5 client **wraps** the Rust save blob into a platform-save container on write and **unwraps** it on load — Rust never speaks the platform save APIs directly. This keeps the Rust backend platform-agnostic (per the top-of-doc note) while satisfying TRC/XR cert requirements (e.g., save-set registration, atomic-write hooks, corruption-recovery integration) that only the UE5 client can satisfy. The wrap/unwrap is mechanical: payload bytes round-trip unchanged; the wrapper carries platform metadata (icon, slot title, timestamp) the platform requires.

### 6.3 Local save quotas

| Slot | Quota | Notes |
|---|---|---|
| Settings blob | 256 KB | Hard cap; ICU-MessageFormat catalog references not inlined. |
| Classic Shard save (one per Avatar) | 16 MB | Sufficient for a fully-explored Britannia per Doc #21 size estimates; warns at 14 MB; fails write at quota with a clear "Britain's chronicles are full" message and a save-slot-management UI. |
| Per-account total | 256 MB | Hard cap matching both platforms' default quota. |

Persistent shard Avatars consume **zero** local save quota — they live on the server.

### 6.4 Corruption recovery

TRC and XR both require save corruption to be detected and recovered without loss of progress where possible.

| Layer | Recovery |
|---|---|
| Save file integrity | Every save is written with a SHA-256 checksum trailer. On load, mismatch → file marked corrupt → fall back to N-1 backup (engine retains last 3 saves per slot). |
| All backups corrupt | Player offered a "Recover from cloud" flow that pulls the platform cloud save. |
| Cloud save also corrupt | Player offered a "Start fresh" flow with a clear warning; corrupt save retained in a quarantine slot for support investigation. |
| Mid-write power loss | Atomic-write pattern: write to `.tmp`, fsync, rename. The replaced file is never half-written. |

A corruption event emits a `save_corruption` event into Doc #28 telemetry (essential-only, fires regardless of consent state per Doc #28 §4.3).

### 6.5 Suspend / Resume

Both PS5 and Xbox suspend the title to RAM when the user presses the home button or switches to another title; resume restores RAM state. The title's responsibility:

| State | Behavior on suspend |
|---|---|
| Single-player Classic Shard | Sim pauses (already true per Doc #34 §5 "Pause on focus loss"). On resume, sim resumes. No save required. |
| Persistent shard | Sim does **not** pause (the world keeps running for everyone else). On suspend, the client gracefully holds the network connection if possible (Doc #22 connection state); if the platform terminates the connection, on resume the client reconnects to the same Avatar at the same shard. |
| Long suspend (> 30 min) on persistent shard | Server-side disconnect timeout per Doc #22 has fired. On resume, the client lands on the title screen with a clear "Welcome back to Britannia" message and reconnects. |

### 6.6 Save data not stored on platform

Per cert policy, sensitive data must not be saved to platform cloud storage:

| Forbidden in save | Reason |
|---|---|
| Email address | PII — stored in operational DB only, not save (Doc #28 §4). |
| Password hash | Authentication is server-side only; no credential lives in save. |
| Payment tokens | Payment is platform-mediated; no Britannia-side payment artifacts in save. |
| Friends list | Platform-managed; we read it via API at runtime. |

---

## 7. Trophies & Achievements

### 7.1 Design principles

Trophies (PS5) and achievements (Xbox) celebrate player accomplishment. Britannia's design constraints (Doc #2 — open-world, no hand-holding, virtue-driven) shape the slate:

| Principle | Application |
|---|---|
| Reward exploration over completion | A trophy for "speak to 50 named NPCs" trumps a trophy for "complete the main quest" because Britannia rewards talking to people (Doc #17). |
| Reward Virtue, not its absence | Trophies for high Virtue exist; trophies for committing all Eight Sins do **not** (would incentivize anti-Virtue play purely for trophy farming). However, **Redemption** trophies exist (cross from severe-drop to neutral, per Doc #28 §5.3) — these celebrate the arc, not the sin. |
| Avoid grind trophies | Trophies that require N hours of repetition without further design depth are forbidden. The slate is curated, not metric-driven. |
| Spoiler safety | Late-game trophies are **secret** (TRC and XR support this) — title and description hidden until earned, to preserve story moments. |
| Cross-platform parity | Same slate on PS5 and Xbox (§7.6). |

### 7.2 Slate composition (Phase 3 launch target — full game)

Target: **50 trophies / achievements** (Sony's standard mid-range count; Xbox uses gamerscore equivalent):

| Tier | PS5 | Xbox gamerscore | Count | Examples |
|---|---|---|---|---|
| Platinum | Platinum | n/a (Xbox has no platinum equivalent) | 1 | "True Avatar" — earn all other trophies. |
| Gold | Gold | 90G | 4 | "Codex Bearer" — speak the eight Words of Power; "Restorer" — complete main story; "Ascendant" — reach maximum Virtue in all eight; "Archmage" — cast every Linear Magic spell at least once. |
| Silver | Silver | 30G | 12 | "Friend of the Companions" — recruit all eight Companions; "Master Smith" — craft a Legendary item; "Cartographer" — visit every named region; etc. |
| Bronze | Bronze | 15G | 33 | Story milestones, virtue thresholds, exploration discoveries, social moments (e.g., "Alms" — give a coin to Carlin the beggar in the Britain Town Opening). |

Total Xbox gamerscore: 1000G (4×90 + 12×30 + 33×15 = 360 + 360 + 495 = 1215; we tune to land at exactly **1000G**, the standard launch budget — Xbox's expectation is 1000G base + DLC).

### 7.3 Secret trophies / achievements

Secret items hide their title and description until earned. Used for:

| Reason | Example |
|---|---|
| Late-game story spoiler | "Through the Black Gate" — finish the main story. Title hidden because the Black Gate's role is the central twist. |
| Surprise discovery | "What lies beneath" — find the hidden chamber under Lord British's castle. Hidden because surprise is the reward. |
| Anti-griefing | "Redemption" arc trophies are visible only after Avatar enters the redemption arc (i.e., severe drop already occurred). Hidden before to avoid signaling "drop your virtue then recover for a trophy". |

Roughly **8 of 50 trophies are secret** in the launch slate.

### 7.4 Platinum requirements

PS5 Platinum requires earning all other 49 trophies. Britannia's policy:

| Constraint | Impact on Platinum |
|---|---|
| No grind for grind's sake | Platinum is achievable in roughly 80–120 hours of focused play. Verified during cert prep with internal completionist runs. |
| No PvP-required trophies for Platinum | A player on a Virtue Shard who never enters a Chaos Shard can still Platinum. PvP-flavored trophies count for gamerscore on Xbox but are excluded from the Platinum chain. |
| No multiplayer-required trophies for Platinum on Classic Shard | A player who only ever plays Classic Shard offline (Doc #21 §2.1) can Platinum. UGC-related trophies have a "play 5 community creations" tier that counts first-party content if the player is offline-only. |
| No time-limited / live-event trophies for Platinum | Live events (Doc #28 §6) award unique titles and cosmetics, not trophies. |
| All Platinum-counting trophies are achievable on the version of the game in the player's hands | A patch may add new trophies (rare; coordinated as DLC trophy lists per §7.5) but never remove or modify Platinum-counting trophies post-launch. |

### 7.5 DLC trophy lists

| Concept | Detail |
|---|---|
| DLC trophies | Each major DLC expansion ships its own trophy list (separate from base game's 50 trophies / 1000G). Sony allows up to 7 DLC trophy lists; Xbox allows additional gamerscore in 250G chunks per DLC. |
| Parity | Same DLC trophy list on PS5 and Xbox. |
| Unlock timing | DLC trophies enabled at DLC release; players who haven't bought the DLC see the lists as locked but visible. |

### 7.6 Platform parity

The same accomplishment unlocks the corresponding trophy and achievement; the engine emits a single `accomplishment_id` event and the platform layer maps to PSN trophy ID or Xbox achievement ID via a manifest:

```ts
type AccomplishmentManifest = {
  accomplishment_id:      string                 // canonical, e.g., "alms_to_carlin"
  ps5_trophy_id:          int                    // 0..N within title's trophy set
  ps5_grade:              "platinum" | "gold" | "silver" | "bronze"
  xbox_achievement_id:    int
  xbox_gamerscore:        int
  is_secret:              bool
  unlock_predicate:       PredicateExpr          // server-evaluated; same DSL as Doc #28 §6.2
}
```

The predicate is evaluated server-side (no client-side trophy logic — Doc #32 anti-cheat consideration). On predicate-true, the server tells the client to fire the platform's trophy / achievement API.

---

## 8. PS5-Specific Features

### 8.1 Activities & Game Help

PS5's Activities surface lets players jump directly into a game from the home screen ("Continue main quest", "Find Iolo", "Visit Trinsic"). Game Help offers in-context hints. Both are TRC-recommended (not strictly required) but expected for premium titles.

| Britannia integration | Detail |
|---|---|
| Activities | Active main-quest stage and active side-quest stages exposed as Activities. Each Activity carries a region anchor (the moongate or NPC the player should walk to next). Activated Activities deep-link into the running game session, fast-traveling the Avatar to the moongate gate of the relevant region (subject to player confirmation — TRC requires the player consent to fast-travel from outside the game). |
| Game Help | Context-sensitive hints (≤ 30s video clips with captions) for tutorial-equivalent moments: "How to open dialogue with an NPC", "How to combine items", "How to enter a moongate". The hints overlap with Doc #34 §7 cognitive accessibility's "next step hint" — Game Help is the platform-mandated surface; the in-engine hint setting toggles whether the hint also appears in-engine. |
| Spoiler safety | Activities for late-game stages remain hidden until reachable. Game Help videos for late-game mechanics likewise gated. |

### 8.2 DualSense haptics & adaptive triggers

DualSense's distinctive features are leveraged where they add to immersion without violating the period-correct audio/visual identity:

| Feature | Britannia usage |
|---|---|
| Haptic feedback (high-fidelity rumble) | Combat hits (per weapon type — sword has a different haptic curve than mace); spell cast (per spell circle — minor circle = light pulse, major circle = sustained vibration); environmental events (earthquakes during certain late-game story beats, rain pattering as ambient background haptics). |
| Adaptive triggers | Drawing a bow (L2 trigger gains tension as the bow is drawn, releases on shot); blocking with a shield (L2 firms when shield is raised); spell channeling (L2 holds spell mid-cast with increasing tension until release). |
| Speaker (controller speaker) | Optional NPC-voice routing — when a Companion speaks (Iolo, Shamino) and the player has DualSense as audio output, the voice plays on the controller speaker for added presence. Falls back to TV speakers if controller-speaker output is disabled in player settings. |
| Light bar | Reflects party leader's selected Virtue alignment (subtle hue shift). Off by default; opt-in. |

Haptic profiles are versioned and live in an asset manifest; UGC creators (Doc #7) **do not** get to define haptic profiles in launch scope (limits cert surface; Phase 4 candidate).

### 8.3 3D Audio (Tempest)

PS5's Tempest 3D audio engine is supported via the platform's audio API. Britannia's audio system (Doc #27 §6) routes through it on PS5. The §4.1 Doc #34 mono audio mode (single-ear hearing) collapses 3D to mono per platform-supported behavior.

### 8.4 PS5 storage

| Concern | Britannia behavior |
|---|---|
| Install size | Targeting **≤ 60 GB** at Phase 3 launch (TRC has no hard cap; player expectation drives this — modern AAA averages 60–100 GB). |
| External SSD playable | Yes — Britannia is loaded from any SSD the platform allows; no SSD-specific assets. |
| Selective install (e.g., language packs, single-player vs. multiplayer) | Locale voice packs (Doc #33 §7) shipped as separate selective-install bundles. Player downloads only their language by default. |

### 8.5 PS5 / PS4 generation policy

PS4 is **out of current scope.** Britannia's simulation density (Doc #6 region loading, Doc #16 combat, Doc #23 pathfinding) targets PS5 hardware. A PS4 backport would require a separate doc and significant per-region budget cuts.

---

## 9. Xbox-Specific Features

### 9.1 Quick Resume

Xbox Series X|S retains multiple titles in a suspended state, allowing rapid switching. Britannia's responsibility: handle restoration from any duration of suspension, including system reboot (Quick Resume survives reboot).

| Suspend duration | Behavior on resume |
|---|---|
| Short (< 30 min) | Local sim resumes immediately; persistent-shard reconnect happens in background (§6.5). |
| Medium (30 min – 24 h) | Persistent-shard connection stale; reconnect on resume with "Welcome back" UI. Local sim re-anchors to last server-authoritative state. |
| Long (> 24 h) | Same as medium plus a content-update check; if title update is available, soft prompt before resume. |
| Across system reboot | Quick Resume restores the suspended state; engine detects reboot via OS API and treats as "long" suspend. |

### 9.2 Smart Delivery

Xbox Smart Delivery delivers the optimal version of the title for each console (Series X = full-feature; Series S = scaled). Britannia's implementation:

| Variant | Target | Differences |
|---|---|---|
| Series X | 4K render scale, 60 FPS target | Full feature set. |
| Series S | 1440p render scale, 60 FPS target | Reduced shadow resolution, lower particle density (still inside Doc #34 §3.5 reduced-motion baseline). |

A single title package ships both variants; the platform delivers the right one per player console. **No separate SKU.**

### 9.3 Game Pass

If Britannia ships on Xbox Game Pass (negotiation, `[OPEN]` §18.1), platform-required surface includes:

| Concern | Behavior |
|---|---|
| Game Pass entitlement check | Platform-validated at launch via XSAPI; entitlement loss (Game Pass subscription lapses) returns the title to "buy or subscribe to play" state. Persistent-shard Avatars are retained server-side; player resumes on resubscription or one-time purchase. |
| Crossplay with non-Game-Pass players | Yes — crossplay is identity-based, not entitlement-source-based. |
| Cloud Gaming (xCloud) | Title is xCloud-compatible; gamepad-only UI mode (§4) is the default in cloud mode. Bandwidth-tolerant: replication-rate (Doc #22) tunes to xCloud session profile. |

### 9.4 Auto HDR

Xbox's Auto HDR will apply to Britannia automatically (it's an SDR title rendered with HDR mapping). We test against Auto HDR; if the result clashes with the period palette (Doc #10 §2), we ship a native HDR profile (§11.1) that supersedes Auto HDR.

### 9.5 Xbox Live features

| Feature | Britannia usage |
|---|---|
| Friends, parties, party chat | Doc #37 voice chat hooks into Xbox party chat (§14). |
| Looking For Group (LFG) | Britannia publishes shard recruitment posts (Virtue Shard "looking for shop owner", Chaos Shard "duel circle scheduled") to LFG. Capability extension to Doc #29 moderation: posts are moderated like UGC. |
| Game DVR / Captures | Standard platform capture; engine respects DRM-protected scenes (very rare; one or two narrative cutscenes flagged) per platform API. |
| Achievements (§7) | Same accomplishment manifest as PS5. |

### 9.6 Xbox storage

| Concern | Britannia behavior |
|---|---|
| Install size | ≤ 60 GB target (parity with PS5 §8.4). |
| Xbox SSD vs. expansion card | Performance parity with internal SSD on official expansion card; no asset variant. |
| External HDD | Title can be stored on external HDD but must be moved to internal SSD or expansion to play (Series X|S behavior; engine handles the move-to-fast-storage prompt via platform API). |

---

## 10. Performance & Quality of Service

### 10.1 Platform framerate targets

| Platform | Target | Floor | Render resolution |
|---|---|---|---|
| PS5 | 60 FPS | 50 FPS p99 | 4K (dynamic, 1440p–2160p) |
| Xbox Series X | 60 FPS | 50 FPS p99 | 4K (dynamic, 1440p–2160p) |
| Xbox Series S | 60 FPS | 50 FPS p99 | 1440p (dynamic, 1080p–1440p) |
| PC | uncapped | n/a | per user setting |

Britannia is a 2D-rendered isometric title (Doc #2 §1) with a 60 FPS sim tick; hitting 60 FPS render is well within hardware capability. The interest is in **stability** — a tile-based renderer should never frame-drop on hardware this powerful, and frame drops are flagged per Doc #28 §8.3.

### 10.2 Dynamic resolution

The renderer does not need to scale resolution under load (the GPU is over-provisioned for 2D iso); **dynamic resolution is implemented as a safety net**, not a load-shedder. Triggered only if frame time exceeds 18 ms (60 FPS budget = 16.67 ms, plus 1.33 ms margin).

### 10.3 Load time budgets

| Operation | Target | Cert reference |
|---|---|---|
| Cold launch to title screen | ≤ 8 s | TRC and XR both expect ≤ 10 s; we target tighter. |
| Title screen to playable Avatar | ≤ 10 s | Includes auth handshake. |
| Region transition (within Britannia, e.g., Britain → Trinsic) | ≤ 3 s | A persistent world can't afford long region loads — players walk between regions freely. |
| UGC content load (a community dungeon, Doc #7) | ≤ 5 s | Includes content download from CDN if not cached. |
| Moongate transition (special-cased, animated) | ≤ 4 s | Animation masks the region load. |

### 10.4 Memory budgets

| Bucket | PS5 / Xbox X | Xbox S |
|---|---|---|
| Engine + simulation | 1.5 GB | 1.5 GB |
| Resident region (current) | 768 MB | 512 MB |
| Resident region (adjacent, predictive) | 256 MB | 128 MB |
| UGC content | 256 MB | 128 MB |
| Voice clips (cached) | 128 MB | 64 MB |
| UI / fonts | 64 MB | 64 MB |
| OS reservation | per platform | per platform |

Series S is the binding constraint; budgets are sized to fit it.

### 10.5 Suspend behavior performance

Per §6.5: suspend is graceful, sim pauses on single-player, persistent-shard sim continues server-side. **No memory leak on repeated suspend / resume cycles** — verified in QA via 100-cycle automated test as part of Phase 3 cert prep.

### 10.6 Networking QoS

| Metric | Target | Cert reference |
|---|---|---|
| RTT to authoritative region server | ≤ 80 ms p50, ≤ 150 ms p99 | Doc #22 |
| Packet loss tolerance | Up to 5% sustained without disconnect | Doc #22 |
| Reconnection success after 30s outage | ≥ 99% | TRC / XR network change handling |
| Bandwidth at idle (player standing still) | ≤ 5 KB/s | Tested under cellular tether for cert review |
| Bandwidth at peak (combat in dense region) | ≤ 80 KB/s | Doc #22 replication budget |

---

## 11. HDR, VRR, 120 Hz, Platform-Mandated Accessibility

### 11.1 HDR

Britannia ships an HDR10 profile (PS5, Xbox Series X|S, and HDR-capable PCs):

| Concern | Behavior |
|---|---|
| Native HDR rendering | Yes — the 2D renderer pipes through an HDR-aware tone-mapper. Period 256-color sprites are luminance-extended into HDR range with palette-preserving curves (avoids over-bright colors that would clash with the Doc #10 art bible). |
| HDR calibration screen | Shown on first launch; player adjusts max-luminance and paper-white using the platform's recommended calibration patterns. Skippable; default profile applied on skip. |
| SDR fallback | Always available. Player can switch SDR/HDR in-engine without restart. |
| Doc #34 photosensitivity intersection | HDR's expanded luminance range is dampened with photosensitivity option on (Doc #34 §8); spell-flash caps lower in HDR than SDR by an additional 30%. |

### 11.2 VRR (Variable Refresh Rate)

Both PS5 and Xbox Series X|S support VRR on compatible displays. Britannia enables VRR by default; the 60 FPS target with VRR results in a smoother-feeling image even when frame time varies slightly. No code-level work is required beyond ensuring frame pacing is monotonic and not vsync-locked.

### 11.3 120 Hz

| Platform | 120 Hz support |
|---|---|
| PS5 | Optional — player selects "Performance Mode (120 Hz)" in title settings if display supports it. Render scales down to 1440p to hit 120 FPS. |
| Xbox Series X | Same. |
| Xbox Series S | 120 Hz at 1080p as opt-in. |

Sim tick remains at 60 Hz regardless (Doc #22 protocol is 60 Hz authoritative); 120 Hz is render-only with frame interpolation on UI overlays. Combat input latency benefits from the higher render rate.

### 11.4 Platform-mandated accessibility (resolves Doc #34 §15-3)

Both platforms specify accessibility requirements that Britannia's accessibility spec (Doc #34) must explicitly meet:

| Mandate | Source | Doc #34 reference | Cert behavior |
|---|---|---|---|
| Subtitles enabled by default | TRC, XR | Doc #34 §4 | Default On — already met. |
| Minimum subtitle text size (legible at 10 ft from a 4K TV) | TRC, XR | Doc #34 §3.3 | Doc #34 §3.3 step 2 (125%) is the launch console default; on console builds, the **default scale is 125%** (PC default remains 100%). |
| Color-blind accommodations available in-game | TRC | Doc #34 §3.1 | Met — four palette modes. |
| Remappable controls (gamepad) | TRC, XR | Doc #34 §5 | Met — full gamepad remap added; preset layouts include one-handed schemes per Doc #34 §5. |
| Text-to-speech for chat (where text chat exists) | XR | Doc #34 §6.2 (chat-message readout via screen reader hook) + Doc #37 (text chat) | Met via screen-reader integration; standalone chat-TTS not separately provided in Phase 3 launch. |
| Speech-to-text for voice chat (Communication accessibility) | XR (CVAA expectation) | Doc #34 §4 last row | Phase 3+ live captions for inbound voice; Phase 3 launch ships with live captions enabled by default per Doc #37 §X. |
| Screen-reader / narration support for menus | TRC partially, XR | Doc #34 §6 | Engine-wide screen reader covers menus, dialogue, journal at Phase 3 launch. |
| Haptic-feedback alternatives for audio cues (DualSense) | TRC recommendation | Doc #34 §4 (visual SFX cues) | DualSense-specific: Doc #34 §4's "visual SFX cues" augmented with haptic SFX cues on PS5 — opt-in. |
| Photosensitivity warning at title launch | TRC, XR | Doc #34 §8 | Met — boot screen displays the Doc #34 §8 warning before any flashing content. |

Console builds ship Doc #34 settings with **slightly different defaults** from PC (subtitle scale 125%, photosensitivity dampening enabled by default, audio-cue captions enabled by default). All settings remain user-overridable; the platform's expectation is a generous default, not a forced setting.

---

## 12. Storefront & Monetization

### 12.1 SKU layout

| SKU | Platforms | Description |
|---|---|---|
| Britannia Reborn — Standard Edition | PS5, Xbox Series X|S, PC | Base game; full Britannia content; access to all persistent shards; UGC editor. |
| Britannia Reborn — Avatar's Edition | PS5, Xbox Series X|S, PC | Standard + soundtrack + lore book + Companion-themed cosmetics (period-appropriate, non-mechanical). |
| Britannia Reborn — Steward's Edition (digital only) | PS5, Xbox Series X|S, PC | Avatar's Edition + first-year season pass + exclusive in-fiction title ("Steward of the Codex") shown on Avatar nameplate to other players. |

DLC (post-launch):

| DLC | Type |
|---|---|
| Region expansions | Paid; unlock new regions in the persistent world (Doc #8 §5). |
| Cosmetic packs | Paid; cosmetic items only; no mechanical advantage. |
| Companion stories | Paid; expanded story arcs for individual Companions. |
| Live event content | Free; ships with live events (Doc #28 §6); not separately purchasable. |
| Major content seasons (akin to expansion packs) | Paid; ships ~yearly. |

Cross-platform parity per §4.2: the same SKUs available on the same platforms simultaneously, modulo platform-specific cosmetic preorder bonuses (which are cosmetic and tradeable in-game post-launch — no platform exclusives that confer permanent advantage).

### 12.2 Microtransactions policy

| Item type | Sold | Constraint |
|---|---|---|
| Cosmetics | Yes | No mechanical advantage. Period-appropriate (Doc #10 §5.3). |
| Consumables (potions, scrolls) | **No.** | Britannia's economy (Doc #18) is closed; selling consumables would inflate gold supply. |
| Premium currency ("Sovereigns") | Yes | Direct purchase or via cosmetic bundles. Account-wide balance per §4.3. |
| Loot boxes / gachas | **No.** | Forbidden by design. Cert and regional regulators (Belgium, Netherlands) increasingly hostile; Britannia avoids the entire category. |
| Battle pass | Phase 4 candidate | If shipped, a paid pass that unlocks cosmetic tiers as the player plays — not a paid pass that unlocks gameplay or speeds progression. |
| Pay-to-win | **Forbidden.** | A Virtue-driven game cannot sell shortcuts. Hard rule. |

Both TRC and XR require microtransactions to be disclosed in-game (the listing screen carries the platform's standard "in-game purchases" indicator). Britannia goes further — every premium item shows its price in local currency at point of view (no "100 Sovereigns" without "= $X.XX displayed" on the item card).

### 12.3 Age ratings

| Region | Body | Target rating |
|---|---|---|
| North America | ESRB | T (Teen) — fantasy violence, mild language, mild blood. |
| Europe | PEGI | 12 — same dimensions; PEGI uses different age boundaries. |
| Japan | CERO | C (15+) — CERO assesses violence stricter than ESRB. |
| Germany | USK | 12 — German body separate from PEGI; alternate Britannia mode (Doc #33 §11.3) may apply for symbol-related content. |
| Brazil | DJCTQ | 14 — alignment with PEGI. |
| Korea | GRAC | 15+ — alignment with CERO. |
| Australia | ACB | M — alignment with PEGI 12 / ESRB T. |

| Concern | Behavior |
|---|---|
| Rating descriptors | Fantasy Violence, Mild Blood, Mild Language, Use of Alcohol (NPC-tavern depiction), Suggestive Themes (none currently planned), Crude Humor (none). |
| Per-region content variants | Where a regional body imposes a constraint (e.g., USK on Nazi-symbol-adjacent imagery — irrelevant to Britannia but example), the Doc #33 §11.3 Alternate Britannia mode is the mechanism. No region-specific code changes; only catalog and asset-variant swaps. |
| Pre-cert rating submission | The content is reviewed by each rating body separately; the cert window (§16) reserves time for rating turnaround (typically 4–8 weeks pre-launch). |

### 12.4 Regional restrictions

Where a region's rating body, censorship law, or platform-policy bars launch:

| Restriction case | Behavior |
|---|---|
| Region banned outright (rare) | Title not listed on platform store in region. Persistent-shard players with Avatars from that region see an in-fiction farewell on next sign-in: "Britannia must rest from thy land for a season." Avatar data retained per Doc #38 (data export available via portal). |
| Region requires content variant | Doc #33 §11.3 Alternate Britannia mode applies. |
| Region requires age verification (e.g., South Korea adult-content laws) | Platform-mediated (PSN / Xbox Live perform age verification per regional KYC); Britannia honors the result. |

---

## 13. UGC Submission Flow on Console

UGC is the most cert-sensitive surface on a console because it bypasses the publisher's authoring oversight (Doc #7 ethos: anyone can publish). PS5 in particular has rigorous UGC TRCs (introduced post-Dreams and post-LBP era) and we design for them as the binding constraint.

### 13.1 Platform UGC TRC overview

PS5 and Xbox both require UGC platforms (any title that lets players publish content other players can consume) to provide:

| Requirement | Britannia mechanism |
|---|---|
| Pre-publication moderation pipeline | Doc #29 moderation queue. UGC published on console enters the queue with a **stricter pre-publication review** than PC (PS5 TRC is hard on this; Xbox slightly lighter). All UGC accessible to console players is human-reviewed before going public. |
| Reporting tools available within ≤ 2 clicks from any UGC content | In-game "Report Creation" button on every UGC content card and in-context within played UGC. |
| Block / mute users available within ≤ 2 clicks from any user touch point | "Block Avatar" available from friends list, party, voice overlay, name plate, dialogue panel, etc. Block is platform-honored — blocked players are also blocked at the platform layer (PSN block / Xbox block). |
| No bypass of platform moderation | UGC content cannot embed unmoderated text, images, or audio — all media slots route through the moderation pipeline. |
| Time-to-takedown SLA | ≤ 24 hours from report-with-evidence to action on egregious content; tighter for hate / CSAM / threats (≤ 4 hours). |

### 13.2 Submission flow

```
Creator publishes (Doc #7)
         |
         v
+----------------------------+
| Auto-validators            |    (Doc #34 §10 accessibility validators,
| (synchronous)              |     Doc #19 §8 style validator,
+----------------------------+     i18n validator §15 Doc #33)
         |
         v
+----------------------------+
| ML pre-screen               |    (text + image + audio classifiers;
| (asynchronous, ≤ 5 min)     |     flagged if hate / NSFW / violence
+----------------------------+     above thresholds)
         |
         v
   ┌─────┴─────┐
   |           |
[Auto-pass]  [Flagged]
   |           |
   |           v
   |     Doc #29 human moderator queue (≤ 24h SLA)
   |           |
   |     ┌─────┴─────┐
   |     |           |
   |  [Approved]  [Rejected]
   |     |           |
   v     v           v
 +-----+----+   +----------+
 | Live in  |   | Returned |
 | Hall of  |   | to       |
 | Wonders  |   | creator  |
 +-----+----+   +----------+
       |
       v
+----------------------------+
| Post-publication monitoring|    (community reports re-route to moderator queue)
+----------------------------+
```

**On-console**, the ML pre-screen is **mandatory for all UGC**, and the flagged path is **default for all UGC** until the creator has accumulated a clean moderation history (≥ 5 approved publications without rejection). This is stricter than the PC flow per Doc #7 §3 — console UGC defaults to human review.

### 13.3 Reporting tools

Every UGC content card carries a "Report Creation" button. Every player nameplate carries a "Report Player" button. Both deepen into a modal:

| Field | Behavior |
|---|---|
| Reason | Selected from a curated list (hate, harassment, NSFW, copyright, cheating, other). |
| Evidence | Auto-attached: last 60s of UGC content state, last 60s of player's own session window (per Doc #28 §3 buffered), and the target identifier. Evidence is encrypted with a moderator-readable key per Doc #29. |
| Reporter notes | Free text; localized; rate-limited per Doc #29. |
| Submission | Generates a Doc #29 ticket; emits a `report_filed` Doc #28 event (consent-gated per Doc #28 §4.3 — actually this event is essential, not consent-gated, because moderation is operations-essential). |

A reporter's identity is **not disclosed** to the reportee. Both platforms require this.

### 13.4 PSN-specific UGC TRCs

Sony's UGC TRCs (revised post-Dreams) include:

| Item | Britannia compliance |
|---|---|
| All player-authored text reviewable | Yes — UGC strings flow through the i18n catalog (Doc #33), and authored strings are mod-queued. |
| All player-authored images reviewable | UGC editor (Doc #7) does not allow free image upload — only placement of authored sprite assets (a curated palette). Removes the open-ended-image problem entirely. |
| All player-authored audio reviewable | Same — only authored sound banks placeable, no free audio upload. |
| No real-time text input from players in unmoderated channels | Trade chat (Doc #18) and party chat (Doc #37) are moderated per Doc #29; voice has Phase 3+ live transcription for safety review (§14). |
| Profile vanity text reviewable | Avatar nameplate name reviewed at character creation (Doc #15 §1) against the same moderation pipeline. |

### 13.5 UGC takedown propagation

When moderation removes a UGC item:

| Player state | Behavior |
|---|---|
| Has the UGC item bookmarked | Bookmark fades to "Unavailable — removed by moderation"; gentle, no further detail. |
| Currently playing the UGC item | Session ends gracefully with a "Britannia has called thee back" message; Avatar returns to a safe town. |
| Has spent earned currency in the UGC item (Doc #18 economy on UGC quests) | Currency refunded to Avatar. |

The takedown reason is not disclosed to consumers (preserves moderator independence) but **is** disclosed to the creator via creator dashboard with platform-mandated appeals path (Doc #29).

---

## 14. Voice Chat Platform Integration (cross-link Doc #37)

Doc #37 owns the voice chat system. This section enumerates the platform integration layer.

> **Voice cert hooks live on the UE5 client (per Doc #41).** Sony's PSN party-chat integration and Microsoft's Game Chat / Xbox party-chat integration are platform-mandated certification surfaces; both are implemented **on the UE5 client only** (the TS web client does not ship to console and therefore has no party-chat cert obligation). The in-game (Britannia channel) voice path is **LiveKit** per Doc #41, with the Rust server handling signaling/permissions/moderation. **Both must be supported on console**: a player can be in a Sony / Microsoft party (platform-managed audio) and in a Britannia LiveKit room (in-game proximity / party / raid voice) simultaneously, with the Voice Mode selector (§14.1, §14.3) routing between them. The UE5 client owns the audio I/O for both paths; LiveKit is the SFU for the in-game path; Sony/Microsoft own their party path end-to-end.

### 14.1 PSN Party Chat hooks

| Hook | Behavior |
|---|---|
| Party detection | Title detects an active PSN party at sign-in via PSN API. |
| In-game voice routing | If the player joins a Britannia in-game proximity voice channel (Doc #37) and is also in a PSN party, the player's voice routes to whichever channel they last spoke in (or, if simultaneous routing is platform-supported, to both). The setting is exposed as "Voice Mode: Britannia / Party / Both" in the in-game audio menu. |
| Party chat captioning | Britannia's live transcription (Doc #34 §4) does not access PSN party chat audio (PSN-managed); platform-side party chat captions are a future PSN feature outside our control. |
| Block propagation | Avatar block in Britannia → also blocks the underlying PSN identity from reaching any in-game voice; PSN block of an account → blocks the corresponding Avatar. |

### 14.2 Xbox Party Chat hooks

| Hook | Behavior |
|---|---|
| Party detection | Via Xbox party API. |
| In-game voice routing | Same modes as PSN: Britannia / Party / Both. |
| Game DVR audio capture rules | Xbox party chat audio is not captured in Game DVR clips per platform rule; Britannia in-game proximity voice **is** captured if the player's Game DVR settings allow voice capture. The audio capture indicator (Doc #37) reflects the active mode. |
| Block propagation | Same as PSN. |

### 14.3 Push-to-talk vs. open mic

| Default | Console |
|---|---|
| Push-to-talk | Default on console (mic key configurable; default to controller's microphone-enabled button per platform). |
| Open mic | Opt-in per Doc #37; players in proximity voice with open mic display an "open mic" indicator on their nameplate. |
| Mic input level meter | Always visible when active, per Doc #37. |
| Profanity filter on transcription | Player-controlled per Doc #37 — separate from platform's text profanity filter. |

### 14.4 Live transcription for accessibility

Per Doc #34 §4 and §11.4 of this doc: Phase 3 launch ships live captions for in-game voice (Britannia-channel only; not PSN/Xbox party chat) enabled by default on console. The captions are local-only and not transmitted; speech-to-text happens on a server-side worker per Doc #28 §3 telemetry pipeline.

---

## 15. Privacy & Data Export on Console (cross-link Doc #38)

Doc #38 owns the data portability spec. Console-specific surface:

### 15.1 GDPR / CCPA on console

Both PS5 and Xbox provide a path to the title's privacy policy and data export request flow:

| Surface | Behavior |
|---|---|
| In-game "Privacy" menu | Available from the main menu and in-game settings. Lists: privacy policy URL, data export request button, account deletion request button. |
| Privacy policy display | In-engine, not a web redirect (TRC and XR require this). Localized (Doc #33). |
| Data export request | Initiates the Doc #38 export flow; result (a portable archive) is delivered via email link, not in-game (the archive is too large for console-side delivery). |
| Account deletion request | Initiates the Doc #38 deletion flow; cooling-off period applies; in-game prompt confirms. |

### 15.2 Telemetry consent on console (cross-link Doc #28 §4.3)

| Surface | Behavior |
|---|---|
| First-launch consent prompt | At first sign-in, before any non-essential telemetry, the player sees a clear prompt: "Wouldst thou allow Britannia to record thy play sessions to improve the realm?" Clear Yes/No with explanation. Default No. |
| Per-session reminder | Not shown — once consented, the choice persists per Doc #28 §4.3. Player may revoke in Privacy menu at any time. |
| Console-platform telemetry | Platform's own telemetry (PSN and Xbox each collect platform-side play stats) operates under platform's own privacy regime; Britannia is not the controller. |

### 15.3 Personal data on console saves

Per §6.6 — no PII in saves. Cloud save is bound to the platform account; deletion of the platform account causes the platform to garbage-collect cloud saves per platform policy.

---

## 16. Submission Cadence & Cert Test Passes

### 16.1 Submission cadence

| Beat | Cadence |
|---|---|
| Major version (1.0, 2.0, ...) | One full TRC + XR pass per platform; submission window 6–8 weeks before public launch. |
| Minor version (1.1, 1.2 — adds content, not gameplay-changing) | Standard cert pass; window 4–6 weeks. |
| Patch version (1.1.1 — bugfix) | Expedited cert path on both platforms (TRC has a "rapid path" for clearly-scoped bugfixes; XR similar). Window 1–2 weeks. |
| Hotfix (server-side only, no client patch) | No cert; pushed via game server. |
| Live event activation (Doc #28 §6) | Server-side payload; no cert. |
| Configuration change | Server-side; no cert. |

The persistent world (Doc #6) means that **not every change is a cert change**. The vast majority of live ops happens entirely server-side.

### 16.2 Internal TCR / XR test passes

Two pre-submission test cycles per major beat:

| Cycle | Timing | Scope |
|---|---|---|
| **TCR/XR Self-Test 1 (broad)** | T-12 weeks before public launch | Console QA team runs the full internal cert checklist (§17). Issues triaged and assigned. |
| **TCR/XR Self-Test 2 (focused)** | T-8 weeks | Re-run on the items that failed Self-Test 1. New items only retested if their area changed since Self-Test 1. |
| **Submission** | T-6 weeks | Build sent to Sony / Microsoft. |
| **Cert pass** | T-4 to T-2 weeks | Platform cert team reviews. |
| **Bug-fix and resubmit** | T-2 to T-0 weeks | Fixes for any failed items; resubmission. |
| **Public launch** | T-0 | Both platforms simultaneous. |

If either platform's cert blocks past T-0, **all platforms hold** to maintain parity (§4.2). The risk of this drives the conservative T-12 internal-test start.

### 16.3 Cert dispensations

For Should / Yellow flags that the design intentionally does not address:

| Process |
|---|
| 1. Console Platform Lead drafts a dispensation memo: cert item, design rationale, mitigation if any. |
| 2. Memo signed by Console Platform Lead + Game Director. |
| 3. Memo submitted to Sony / Microsoft cert account manager. |
| 4. Platform reviews and accepts / rejects. |
| 5. Accepted dispensations recorded in cert ticket; carry forward to subsequent submissions until the underlying item is addressed. |

Britannia's posture: dispensations are rare. Better to address than negotiate.

---

## 17. Cert Checklist — Top 50 Most-Failed Items

Based on platform-published cert-failure analytics (PS5 publisher portal, Xbox Partner Center), this is the curated top 50 items most-failed across the industry — cross-referenced with how Britannia's design avoids them.

| # | Cert item (paraphrased; canonical text in TRC/XR) | Platform | Severity | Britannia mitigation |
|---|---|---|---|---|
| 1 | Title hangs on sign-out from PSN / Xbox Live | Both | Must | §5.5 — graceful handler with auto-resume on sign-in. |
| 2 | Title fails to handle a network change (cable unplug, WiFi switch) | Both | Must | §5.5; Doc #22 reconnection logic. |
| 3 | Save corruption on power loss mid-write | Both | Must | §6.4 atomic-write pattern (write tmp → fsync → rename). |
| 4 | Save fails when cloud save quota full | Both | Must | §6.3 quota-management UI; clear in-fiction messaging. |
| 5 | Trophy / achievement does not trigger reliably | Both | Must | §7.6 server-side predicate evaluation; idempotent platform call. |
| 6 | Platinum trophy unobtainable post-patch | PS5 | Must | §7.4 — Platinum achievable on shipped version; never broken. |
| 7 | DLC trophy list breaks base game progress | Both | Must | §7.5 separate trophy lists; no overlap. |
| 8 | UGC content displayable without moderation | Both | Must | §13.2 — pre-publication moderation default on console. |
| 9 | Player block does not propagate to all surfaces | Both | Must | §13.1 + Doc #29 — block is system-wide. |
| 10 | Voice chat audible from blocked player | Both | Must | §14 + Doc #37 — block propagates to voice. |
| 11 | Mic is hot when game is suspended | Both | Should | Mic disabled on suspend per Doc #37. |
| 12 | Reporting tool > 2 clicks from offending content | Both | Must | §13.3 — single Report button on every relevant surface. |
| 13 | Title shows raw platform error string to player | Both | Should | §5.5 — all errors translated into in-fiction messaging. |
| 14 | Login flow redirects to web | Both | Should | §3.2 — in-game account-link flow. |
| 15 | Microtransaction price not shown in local currency | Both | Should | §12.2 — every premium item shows local price. |
| 16 | Title does not honor parental controls (online play, voice chat, UGC) | Both | Must | §3.4 explicit honor table. |
| 17 | Title does not honor cross-platform parental control | Both | Must | §3.4 — same table; platform-reported flag honored. |
| 18 | Cloud save not synced before sign-out | Both | Must | §6.2 — atomic sync on save; flush before sign-out. |
| 19 | Save data exceeds platform quota | Both | Must | §6.3 hard caps. |
| 20 | Quick Resume restoration loses player input mid-frame | Xbox | Must | §9.1 — explicit restoration test; 100-cycle automated test. |
| 21 | Suspend / resume causes audio desync | Both | Must | Audio system (Doc #27) re-syncs on resume; test in cert. |
| 22 | HDR brightness exceeds platform-recommended max | Both | Should | §11.1 — capped at calibration max. |
| 23 | VRR causes stutter on display change | Both | Should | §11.2 — VRR re-init on display-change event. |
| 24 | Title does not run at 60 FPS on Xbox Series S in standard scenes | Xbox | Should | §10.4 Series S budget sized to fit; verified in cert. |
| 25 | UI not legible at 10 ft | Both | Should | §11.4 — console default subtitle 125%; UI scaled accordingly. |
| 26 | Color-only UI states without alternative encoding | Both | Should | Doc #34 §3.1 + this doc §11.4. |
| 27 | Photosensitive content without warning at title launch | Both | Must | §11.4 — boot screen warning. |
| 28 | Subtitle missing speaker identification | Both | Should | Doc #34 §4 — speaker prefix always present. |
| 29 | Voice chat without consent / disclosure | Both | Must | Doc #37 §X — explicit consent; mic indicator always visible. |
| 30 | Crossplay opt-out not honored at matchmaker | Both | Must | §4.1 + §5.3 server-side enforcement. |
| 31 | Different content available per platform without disclosure | Both | Must | §4.2 parity rule; divergences explicitly listed in this doc. |
| 32 | Title accesses platform restricted API without manifest entry | Both | Must | All API calls reflected in submission manifest; reviewed pre-submission. |
| 33 | Title does not handle account-level age restriction | Both | Must | §3.4 — parental controls cover age-restricted features. |
| 34 | Title presents sign-up / payment outside platform store | Both | Must | §4.3 — no third-party stores; platform commerce only on platform. |
| 35 | Subscription churn confusion (Game Pass / PS Plus lapse) | Both | Should | §9.3 + §6.2 — clear messaging on entitlement loss; persistent Avatar retained. |
| 36 | UGC contains unmoderated audio | Both | Must | §13.4 — no free audio upload in UGC editor. |
| 37 | UGC contains unmoderated images | Both | Must | §13.4 — no free image upload. |
| 38 | UGC contains unmoderated player text in vanity fields | Both | Must | §13.4 — Avatar nameplate moderated at character creation. |
| 39 | Privacy policy not in-game | Both | Should | §15.1 — in-engine display, localized. |
| 40 | Data export not honored within legal SLA | Both | Must (regulatory) | §15.1 + Doc #38 — 30-day legal, 7-day target. |
| 41 | Account deletion incomplete | Both | Must (regulatory) | Doc #38 — full pipeline including re-id rotation per Doc #28 §4. |
| 42 | Telemetry collected without consent | Both | Must (regulatory) | Doc #28 §4.3 — opt-in for non-essential. |
| 43 | Title does not display rating before gameplay | Both | Must | Boot splash sequence shows ESRB / PEGI / CERO / USK rating per region. |
| 44 | Cert build differs from review build | Both | Must | Build hash recorded in submission; same hash advances to Release. |
| 45 | Title crashes on enumerated edge inputs (controller disconnect, mid-cutscene) | Both | Must | Cert prep includes a curated edge-input test pass; passes in CI. |
| 46 | Title does not support both controllers (in two-controller test) | Both | Must | Console supports controller swap mid-session; QA-tested. |
| 47 | Title does not survive a 24-hour soak test (memory leak) | Both | Must | §10.5 — 24h soak in QA; memory growth bounded. |
| 48 | Idle title does not pause / dim per platform standard | Both | Should | After 30s of input idle on title screen, dim to 50% luminance per platform standard. |
| 49 | Title does not respond to system shutdown signal | Both | Must | Engine handles platform-shutdown signal: flush save, disconnect, exit cleanly within 5s budget. |
| 50 | Trophy data not retained on title reinstall | PS5 | Must | Trophies are PSN-stored; reinstall does not lose them. Verified via reinstall test. |

This list is the canonical Britannia cert-prep checklist. CI for console-targeted branches runs an automated subset (items 1, 2, 5, 8, 18, 20, 21, 24, 27, 29, 30, 42, 45, 47); the rest are QA-tested manually each cert pass.

---

## 18. MCP Surface Additions

Amendments to Doc #14 §3 (capabilities), §5 (tools) and §6 (resources).

### 18.1 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://meta/cert/platforms` | `{ ps5: PlatformStatus, xbox_xs: PlatformStatus, xbox_s: PlatformStatus, pc: PlatformStatus }` where `PlatformStatus = { last_cert_pass: Date | null, current_build_version: string, dispensations: DispensationRef[] }` | `inspect.read` |
| `forge://meta/cert/checklist` | The Top 50 cert checklist (§17) with current Britannia-mitigation status per item | `inspect.read` |
| `forge://shard/{s}/avatar/{id}/platform_identity` | `{ platform_family: "ps5" | "xbox" | "pc", parental_controls: ParentalFlags, crossplay_enabled: bool, gamertag: string }` for **OWN avatar only** | `inspect.read` (own-avatar gating per Doc #15 §7.3) |

### 18.2 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `set_crossplay_pref` | `avatar.basic` | `enabled: bool` | `{ ok: true, applied_at: ServerTick }` | Updates the per-account crossplay opt-in. Subject to parental-control override (§4.1). |
| `link_platform_identity` | `avatar.full` (account-level operation) | `platform: "ps5" | "xbox" | "pc"`, `platform_token: string` | `{ ok: true, linked_account: BritanniaAccountId }` | Links a platform identity to the calling Britannia account. Verifies the platform token via platform's auth API. |
| `unlink_platform_identity` | `avatar.full` | `platform: "ps5" | "xbox" | "pc"` | `{ ok: true, unlinked_at: Timestamp }` | Reverses §3.1 link. |

```json
// set_crossplay_pref
{
  "name": "set_crossplay_pref",
  "input": {
    "envelope": "VerbEnvelope",
    "enabled": "boolean"
  },
  "returns": {
    "ok": "boolean",
    "applied_at": "ServerTick"
  }
}

// link_platform_identity
{
  "name": "link_platform_identity",
  "input": {
    "envelope": "VerbEnvelope",
    "platform": "ps5 | xbox | pc",
    "platform_token": "string"
  },
  "returns": {
    "ok": "boolean",
    "linked_account": "string"
  }
}
```

Errors specific to console tools: `ERR_PLATFORM_TOKEN_INVALID`, `ERR_PLATFORM_ALREADY_LINKED`, `ERR_PARENTAL_CONTROLS_DENY` (parental controls block the requested action), in addition to standard codes from Doc #14 §5.

### 18.3 Capability composition

The console-platform tools (`link_platform_identity`, `unlink_platform_identity`) are account-level operations, so they require `avatar.full` capability (highest tier for player-bound clients per Doc #14 §3) and additionally the calling session's bound platform must match the operation's `platform` parameter (a PSN-bound session can only link / unlink the PSN platform identity; cross-platform unlinks are routed through the account portal, not in-game MCP).

---

## 19. Phase 1 / Phase 2 / Phase 3 Scope

### 19.1 Phase 1 (12-week vertical slice, Doc #11)

**Console certification is out of scope for Phase 1.** Phase 1 is PC-only (Britain Town Opening, single shard, 8-player co-op). Cert-relevant pieces present in Phase 1 architecture but not exercised:

| Area | Phase 1 state |
|---|---|
| Account + identity | PC-only, direct accounts; no platform linkage. |
| Save | Local file only; no cloud save. |
| Achievements | Steam achievements as a low-stakes pilot of the §7.6 manifest pattern. |
| Storefront | Single SKU on Steam; no cross-platform parity considerations. |
| UGC moderation | Doc #29 pipeline exists; no console UGC TRC compliance work yet. |
| Voice chat | Out of scope (Doc #27 §7); Doc #37 also Phase 3+. |
| Privacy / data export | Doc #38 in flight; no console submission. |
| MCP | None of §18's tools required. |

### 19.2 Phase 2 (post-prototype, full-game development)

Phase 2 expands to the full Black Gate campaign and adds shard infrastructure (Virtue Shard, Chaos Shard, Doc #6 §2). Cert-relevant work begins **as architecture readiness**, not as submission:

| Area | Phase 2 work |
|---|---|
| Account + identity | Britannia account schema finalized; portal built. |
| Cross-progression | Server side complete for PC accounts (single-platform but architected for multi-platform). |
| Save | Cloud-save abstraction layer in place (PC-side stub; console adapters added in Phase 3). |
| Achievements | Steam achievements complete; manifest pattern proven. |
| UGC moderation | Doc #29 mature; ML pre-screen production-ready; appeals path complete. |
| Live transcription | Phase 2 candidate; depends on Doc #37. |
| Cert checklist (§17) | All items reachable in CI; PC equivalents validated. |

### 19.3 Phase 3 (console launch)

| Area | Phase 3 work |
|---|---|
| PS5 SDK integration | DualSense haptics, adaptive triggers, Activities, Tempest 3D, trophy API. |
| Xbox GDK integration | Smart Delivery split build, Quick Resume robustness, achievement API, Auto HDR / native HDR profile. |
| Account linkage | Both PSN and Xbox Live linkage flows live. |
| Crossplay | End-to-end across PS5, Xbox, PC. |
| Cross-save | Cloud save adapters live on both platforms. |
| Microtransactions | Account-wide premium currency; platform commerce webhook pipeline live. |
| UGC TRC compliance | Pre-publication moderation default for console; ML pre-screen latency to ≤ 5 min p99. |
| Voice chat (Doc #37) | Phase 3 launch; party-chat hooks live; live transcription default-on for accessibility. |
| Data export (Doc #38) | Console-launch parity with PC; in-engine privacy menu. |
| Submission | T-12 weeks: Self-Test 1; T-8: Self-Test 2; T-6: submit; T-0: launch. |

**Phase 3 success metric:** Britannia Reborn passes TRC and XR on first cert submission with ≤ 5 fixable Should-flag items and zero Must-flag items, launches simultaneously on PS5 and Xbox Series X|S, and a player buying premium currency on PS5 sees the balance reflected on Xbox within 60 seconds of cross-platform sign-in.

---

## 20. Open Questions

1. `[OPEN]` **Free-to-play vs. premium business model on console.** Free-to-play unlocks Xbox Live free online (no Game Pass Core required) and lowers the entry barrier; premium ($60 launch) gives a cleaner SKU and avoids loot-box-adjacent monetization scrutiny. Decision drives §5.5 (online subscription requirement), §12.1 (SKU layout), §12.2 (microtransaction policy). Cross-link Doc #11 monetization decision pending.
2. `[OPEN]` **Game Pass deal.** Is Britannia Reborn included in Xbox Game Pass at launch (Microsoft funds development partially in exchange) or post-launch (added 6–12 months in)? Affects §9.3, marketing budget, and Phase 3 timeline.
3. `[OPEN]` **PS Plus tier requirement for persistent shards.** Sony's PS Plus tiers (Essential, Extra, Premium) determine which players can access which features. PS Plus Essential is required for online multiplayer on most titles; if Britannia is free-to-play, PS Plus is **not** required (Sony exempts F2P MMOs). Cross-references `[OPEN]` 1.
4. `[OPEN]` **Cross-platform party chat policy detail.** §14.1 / §14.2 specify hooks but don't decide whether Britannia's in-game proximity voice can route alongside platform party chat by default. Working assumption: Britannia channel is opt-in; party chat is the default voice when in a party. Final call deferred to Doc #37 voice-chat lead.
5. `[OPEN]` **Trophy / achievement count for live-event participation.** §7.4 excludes time-limited content from Platinum-counting trophies, but commemorative trophies (non-Platinum-counting) for participating in live events would be a strong engagement signal. Open: do we ship 2–4 such commemorative trophies at launch or accumulate them through DLC slates?
6. `[OPEN]` **Console-specific UGC features.** PS5's Dreams-style "play in editor" instant playtest and Xbox's Game Bar-driven creative tools are console-specific UGC paradigms. Britannia's UGC editor (Doc #7) is unified across platforms by design — but should console-specific creator surface (e.g., DualSense haptic authoring, since haptics are console-only per §8.2) be permitted as cosmetic-only authoring? Recommendation: defer to Phase 4. Cross-link Doc #7 §6.
7. `[OPEN]` **Submission cadence for live ops vs. cert.** §16.1 distinguishes server-side from client-side changes, but a balance change that moves a Virtue scoring coefficient (Doc #5) is server-side **and** changes player perception. Open: do we treat such a change as cert-relevant for transparency, or only for client-side changes? Recommendation: server-side balance changes are not cert-relevant; transparency is provided via patch notes on the title's news blog. Final call deferred to Doc #28 §11 dashboard team.
8. `[OPEN]` **Nintendo Switch port viability.** §1.4 explicitly out of scope, but the question recurs as Britannia's pixel-art aesthetic and turn-based-adjacent combat (Doc #16) are Switch-friendly. A Switch port would require Lotcheck and a separate region-loading budget pass; doc TBD. Decision deferred to post-launch.
9. `[OPEN]` **Steam Deck Verified vs. Playable rating.** Phase 3 PC build runs on Steam Deck; verified rating requires gamepad-only UI parity with console. Working assumption: Verified at Phase 3 launch (gamepad UI is shared with console). Final verification depends on Steam Deck Verified test pass.
10. `[OPEN]` **PSVR2 / Xbox Cloud-only modes.** Britannia is not a VR title; PSVR2 is not in scope. Xbox Cloud Gaming (xCloud) is in scope per §9.3. Open: do we author a Britannia-specific cloud-streaming-optimized profile (lower bandwidth, larger UI elements for variable display sizes), or rely on the platform's default cloud rendering? Recommendation: light platform-specific tuning — UI scale 125% default in cloud sessions.
11. `[OPEN]` **Console-only QA staffing.** Cert is QA-heavy work. Phase 3 staffing budget allocates a dedicated Console QA team of 4 (one lead + three testers, one per platform plus one floater). Is this enough for two-platform parallel cert? Working assumption: yes for major cert; expedited and patch certs may stretch the team. Recommendation: budget for one additional contracted tester per cert window.
12. `[OPEN]` **Pre-launch closed beta on console.** Sony and Microsoft both support pre-launch closed beta programs (a separate cert-light path for invited testers). Open: do we run a console closed beta as part of Phase 2→3 transition, or go straight to public launch after cert? Recommendation: closed beta on each platform 4 weeks pre-launch; gives real-hardware feedback that the internal QA team cannot replicate. Final call deferred to launch plan.
13. `[OPEN]` **Microtransaction price tier alignment across platforms.** Both platforms enforce price tiers (Sony's price tiers, Microsoft's price tiers); the same USD price may map to a slightly different GBP / EUR / JPY tier on each. Open: do we round to the nearer tier for cross-platform price parity (preferred for fairness perception), or accept platform-native tiers (saves accounting complexity)? Recommendation: nearer-tier rounding with the absolute closest match on USD anchor.
14. `[OPEN]` **Live transcription source language.** §11.4 ships Phase 3 live captions for inbound voice; the speech-to-text model needs a source-language hint. Open: do we honor the speaker's account-language setting (most accurate but may mismatch what they're actually speaking) or auto-detect (lower confidence, additional latency)? Recommendation: account-language default with auto-detect override per session. Cross-link Doc #34 §15-9.
15. `[OPEN]` **HDR profile for the period palette.** §11.1 says we extend the 256-color palette into HDR with palette-preserving curves. Open: does the curve preserve perceptual hue (preferred for art-bible compliance — Doc #10) or absolute luminance (preferred for HDR purists)? Recommendation: perceptual hue preservation, validated with art lead. Cross-link Doc #10 §2 amendment if curves change the visual identity.

---

## 21. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #1 §4 (success metrics), Doc #2 §1 (input model), Doc #11 (Phase 1 scope) |
| §2 Cert programs | Doc #11 (milestone roadmap — cert windows added to Phase 3 schedule) |
| §3 Account & identity | Doc #15 §1 (Avatar name), Doc #15 §7.3 (cross-Avatar gating), Doc #38 (account portability) |
| §4 Crossplay & cross-save | Doc #6 §2 (shard types), §3 (cross-shard identity), Doc #18 (economy crossplay) |
| §5 Networking | Doc #22 (network protocol — outbound only), Doc #28 §3 (telemetry pipeline outage handling), Doc #33 (localized outage messaging) |
| §6 Save data | Doc #21 §2.1 (Classic Shard offline), §3.11 (replication_log), §7 (retention) |
| §7 Trophies & achievements | Doc #5 (Virtue framework — trophies for Virtue arcs), Doc #28 §5.3 (severe-drop redemption), Doc #32 (server-side predicate to defeat client-side cheats) |
| §8 PS5 features | Doc #10 §5.3 (period audio for controller-speaker NPC voice), Doc #27 §6 (audio system), Doc #34 §4 (haptic-feedback alternatives) |
| §9 Xbox features | Doc #34 §3 (HDR + photosensitivity intersection), Doc #6 §2 (Game Pass crossplay) |
| §10 Performance & QoS | Doc #22 (network QoS targets), Doc #28 §8 (perf telemetry) |
| §11 HDR / VRR / 120 Hz / Accessibility | **Resolves Doc #34 §15-3** (console-mandated accessibility); Doc #10 §2 (palette + HDR), Doc #34 §3 §4 §6 §8, Doc #37 (live transcription) |
| §12 Storefront & monetization | Doc #18 (in-game economy parity), Doc #33 §11 (regional rating cultural review), Doc #29 (regional content variants moderation) |
| §13 UGC submission flow | Doc #7 §3 (publishing pipeline), §6 (UGC editor), Doc #19 §8 (validators), Doc #29 (moderation queue + appeals), Doc #34 §10 (UGC accessibility validators) |
| §14 Voice chat platform integration | Doc #37 (parallel doc — voice chat system); Doc #28 §3 (telemetry pipeline for live transcription) |
| §15 Privacy & data export on console | Doc #28 §4 (privacy boundary), §4.3 (consent), Doc #38 (parallel doc — full data export pipeline) |
| §16 Submission cadence | Doc #11 (release plan extended to Phase 3 cert windows), Doc #28 §11 (live ops console for patch coordination) |
| §17 Cert checklist top 50 | Composite — touches every doc indirectly |
| §18 MCP surface additions | Doc #14 §3 (capabilities), §5 (tools), §6 (resources), Doc #15 §7.3 (own-avatar gating) |
| §19 Phase scoping | Doc #11 (vertical slice → full game → console launch progression) |
| §20 Open Questions | Doc #11 (monetization), Doc #1 §5 (Garriott review intersect), Doc #6 (shard types intersect with PS Plus tier requirement) |

---

End of Document #39.
