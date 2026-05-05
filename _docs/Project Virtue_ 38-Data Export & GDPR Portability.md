# 38 — Data Export & GDPR Portability

Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Trust-and-Safety + Privacy Engineering Lead]
Status: Living Technical Reference — Normative spec for data subject access, portability, erasure, rectification, restriction, objection; consent management; identity verification; cross-border transfer; breach notification; DPIA process. Resolves Doc #28 §4.2 deferred GDPR/CCPA endpoint specification and Doc #21 §11.2 deferred per-Avatar export format.

Depends on: #5 §3, #6 §3, #13, #14 §3, #15 §1.5, #19 §5, #21 §3, §3.4, §3.7, §3.11, §11.2, §11.3, #26 §12, #27 §6, #28 §4, §4.2, #29 §5, §9, §12, #32 §10, §11, #33.

Resolves: Doc #28 §4.2 (`/privacy/export`, `/privacy/delete` endpoint contracts), Doc #28 §14 item 2 (per-jurisdiction retention), Doc #21 §15 item 5 (export-bundle encryption keys, partial — §10.4).

---

## 1. Privacy Philosophy

Project Virtue is a global persistent world. Its EU, California, Brazilian, Korean, and Australian players each carry distinct statutory rights against the operator of the shard their Avatar lives on, and an EU Avatar logged into a US-region Virtue shard still holds GDPR rights against the data the operator stores. The doc takes the strictest applicable regime as the design floor — **GDPR-as-baseline** — and lets other regimes layer on top. Two operating principles. **(1) The account is the data subject's primary handle.** A natural person owns one or more accounts; each account holds one or more Avatars per shard. Statutory rights attach to the natural person, who reaches the operator through their account and proves identity through §9. Privacy machinery is keyed on `(account_id, avatar_id?)` with `avatar_id` optional to support both per-Avatar and account-wide requests. **(2) Other players' data is sacrosanct.** A subject access request on Avatar A must not exfiltrate Avatar B's PII when A and B are entangled in trades, chats, party formations, or witness rosters. The redaction pass in §6 is a hard contract, not a courtesy.

The verb dispatcher (Doc #13 §4) and `replication_log` (Doc #21 §3.11) make this tractable: every act is keyed on `actor_id` with `target_id` and `affected_entities[]` exposed, so a portability export is a query, not an excavation. The challenge is regulatory completeness, identity verification, redaction of cross-actor PII, and timely fulfilment under SLA.

---

## 2. Regulatory Scope

Project Virtue launches with player populations expected across all five named regimes. The compliance posture treats all five as in-scope from day one; no regime is "deferred to launch+1."

### 2.1 Regulation Matrix

| Regime | Jurisdiction | Subject's primary rights | Operator response window | Notable obligation distinct from GDPR |
|---|---|---|---|---|
| **GDPR** | EU + EEA (Iceland, Liechtenstein, Norway) | Access (Art. 15), Portability (Art. 20), Erasure (Art. 17), Rectification (Art. 16), Restriction (Art. 18), Object (Art. 21), Withdraw consent (Art. 7§3), Object to automated decisioning (Art. 22) | 30 days (extensible by 60 with notice) | DPO appointment if core activity is large-scale processing; DPIA for high-risk processing; 72-hour breach notification to lead supervisory authority |
| **UK GDPR + DPA 2018** | United Kingdom | Mirrors GDPR (post-Brexit retained law) | 30 days (extensible by 60) | ICO is the supervisory authority; same 72-hour breach window |
| **CCPA / CPRA** | California (US) | Right to know, right to delete, right to correct (CPRA), right to opt out of "sale or share" of personal info, right to limit use of sensitive personal info, right against retaliation | 45 days (extensible by 45) | "Do Not Sell or Share" link in primary footer; Sensitive Personal Information (SPI) special handling; private right of action for breaches involving certain categories |
| **LGPD** | Brazil | Confirmation/access, correction, anonymization or deletion of unnecessary data, portability, deletion, info on data sharing, withdraw consent, review of automated decisions | 15 days (confirmation of receipt + initial response); fulfilment "reasonable" — operator practice 30 days | DPO ("Encarregado") public contact mandatory; ANPD is supervisory authority |
| **PIPA** | South Korea | Access, correction, deletion, suspension of processing, withdrawal of consent | 10 days (extensible by 10 with notice) | Mandatory localized privacy policy in Korean; resident-data residency requirement is `[OPEN]` (§16); separate consent for marketing vs. service |
| **Privacy Act 1988 (APPs)** | Australia | Access (APP 12), correction (APP 13), complaint right | 30 days (reasonable period) | Notifiable Data Breach scheme — eligible breach must be notified to OAIC and affected individuals "as soon as practicable" |

**Cross-cutting:** all six recognise *purpose limitation*, *data minimisation*, *storage limitation*, and *security*. The 30-day GDPR window is the design SLA target across all regimes (§11), with a 7-day automated-pipeline objective. PIPA's 10-day clock is the binding floor — Korean residents' requests are routed to a fast-path queue (§9.4).

### 2.2 Children & Age Gating

| Regime | Threshold | Operator obligation |
|---|---|---|
| GDPR / UK GDPR | Under 16 (member-state floor 13) | Verifiable parental consent for any processing relying on consent as legal basis |
| CCPA / CPRA | Under 13 (COPPA) and 13–15 special opt-in for sale/share | COPPA-compliant verifiable parental consent under 13; opt-in (not opt-out) for sale/share for 13–15 |
| LGPD | Under 18 (under 12 strict; 12–18 with parental consent or in best interest) | Specific & highlighted parental consent; data only for clear best-interest purposes |
| PIPA | Under 14 | Verifiable parental consent for processing |
| Privacy Act | No specific child threshold; reasonable steps required | Account terms reflect APP 1 transparency expectations |

The age-gate is enforced at account creation (§13.4). The minimum age for a Project Virtue account is **13** in all regions; processing for accounts where the registered DOB indicates 13–17 (or local equivalent) is restricted to service-essential purposes only — no marketing, no ad personalization, no "sale or share" — until the account-holder reaches the regional adult threshold.

### 2.3 Lawful Bases

The operator processes player data under the following GDPR Art. 6 / equivalent bases:

| Processing | Lawful basis | Withdrawable? |
|---|---|---|
| Account creation, authentication, gameplay state | Contract (Art. 6(1)(b)) | No (would terminate the contract) |
| Payment processing | Contract + legal obligation (tax, anti-fraud) | No (necessary to provide & document the service) |
| Anti-cheat detection, security-event logging, fraud prevention | Legitimate interest (Art. 6(1)(f)) | Restricted; subject may object — operator weighs interest |
| Telemetry, analytics, A/B testing | Consent (Art. 6(1)(a)) | Yes, freely; default OFF (Doc #28 §4.3) |
| Marketing communications | Consent (Art. 6(1)(a)) | Yes, freely; default OFF |
| Voice chat with cross-region routing | Consent + contract | Voice opt-in per session |
| Moderation, abuse reports, ban administration | Legal obligation + legitimate interest | Restricted (cannot disable moderation) |

This split governs which records are subject to erasure on consent withdrawal (§7.4) versus retained on a non-consent basis.

---

## 3. Data Inventory — Where PII and Player-Generated Data Live

A complete export must enumerate every subsystem that holds data linkable to the data subject. The table below is the canonical inventory; new subsystems must register here before processing player data.

### 3.1 Operational Stores

| Store / Table | Data classes | Doc reference |
|---|---|---|
| `accounts` (auth DB) | Email, hashed password, 2FA secret, recovery codes, last-login IP, country, DOB, consent flags | Doc #32 §10 |
| `account_payment_profiles` | Tokenized PAN, billing address, country, last-4, brand, expiry, gateway customer ID | §3.3 |
| `account_consents` | Per-purpose consent state with timestamp + policy version | §13 |
| `auth_session_log` | Login events, IPs, user-agents | Doc #32 §10 |
| `player_avatars` | Display name, portrait, gender, class skew, virtues, current region/position, login times | Doc #21 §3.2 |
| `player_inventory` | All Avatar-owned entity rows (paperdoll + nested containers) | Doc #21 §3.3 |
| `player_virtue_log` | Append-only Virtue deltas per Avatar | Doc #21 §3.4 |
| `player_quest_journal` | Per-Avatar quest progression flags | Doc #21 §3.5 |
| `housing_instances` | Player-owned plots, building blob | Doc #21 §3.6 |
| `ugc_creations` | Author-attributed UGC payload, title, review state, virtue audit | Doc #21 §3.7, Doc #19 |
| `market_stalls` | Player vendor stalls, listings, reputation | Doc #21 §3.9 |
| `replication_log` | Every committed `VerbInvocation` by the Avatar | Doc #21 §3.11 |
| `admin_audit_log` | Staff actions against the Avatar (warns, mutes, bans, restores) | Doc #29 §9 |
| `report_records` / `appeal_records` | Reports filed by/against; appeals submitted | Doc #29 §3, §12 |
| `gm_session_audit` | Sessions hosted, joined, decisions logged | Doc #26 §12 |
| `chat_log` | Public/party/DM message bodies by the Avatar | §3.4 |
| `voice_session_metadata` / `voice_buffers` | Session metadata + rolling 60s audio buffer (snapshotted only on report) | Doc #27 §6 |
| `screenshot_attachments` | Player-uploaded screenshots on reports/appeals | §3.4 |
| `support_tickets` | Help-desk tickets, message threads, attachments | §3.4 |
| `device_fingerprints` | Hardware fingerprints linked to the account | Doc #32 §12 |

### 3.2 Analytics / Derived Stores

| Store | PII status | Reference |
|---|---|---|
| ClickHouse raw `TelemetryEvent` (90d) | Pseudonymous via `actor_anon_id`; re-identifiable only via re-id service | Doc #28 §3.3, §4.1 |
| ClickHouse daily aggregates (5y) | Non-PII (statistical) | Doc #28 §3.3 |
| Anomaly tickets | Pseudonymous in storage; re-id on moderator triage | Doc #28 §7 |
| MCP invocation log | Pseudonymous | Doc #28 §3.3 |
| Re-identification service DB | `(anon_id ↔ player_id)`; highest sensitivity; segregated IAM | Doc #28 §4.1 |

### 3.3 Payment Records

PCI-DSS posture: tokenize at gateway, store token only. Exported payment view:

| Field | In export? |
|---|---|
| Gateway customer ID | Yes (token; not actionable without gateway access) |
| Card brand, last-4, expiry m/y, billing address & country | Yes |
| Transaction history (date, amount, currency, SKU, status) + refunds | Yes |
| Raw PAN / CVV | NEVER STORED |
| Bank statement descriptor | Yes (informational) |

Tax-relevant transaction records carry retention obligations (§7.5) that override erasure — they persist as hashed-buyer ledger entries.

### 3.4 Communications & Media

| Channel | Storage | Retention | In export? |
|---|---|---|---|
| Public / zone / world chat | `chat_log` | 30d raw; 1y aggregated | Own messages; others redacted to `<other_anon>` |
| Party / guild chat | `chat_log` | 90d raw | Own messages; others redacted |
| Direct messages | `chat_log` (private) | 90d raw | Conditional — §6.2 |
| Voice (live) | Doc #27 §6 — RTP-only, not persisted | N/A | N/A |
| Voice rolling buffer | `voice_buffers` (60s rolling) | 60s rolling; 90d on report-snapshot | If snapshot involves subject — §6.3 |
| Voice metadata | `voice_session_metadata` | 90 days | Yes; peers redacted |
| Screenshots (player-uploaded) | `screenshot_attachments` | Per-ticket lifecycle | Subject's own uploads only — §6.4 |
| Support tickets | `support_tickets` | 5y (dispute-defense hold) | Subject's messages + operator replies; CSR PII redacted to role title |
| Mod-tool freeform text | `admin_audit_log.reason` | Indefinite (Doc #29 §9.2) | Text concerning the subject; staff IDs → role title |

### 3.5 Backups & Replication

PostgreSQL backups (Doc #21 §11.1) include all §3.1 stores. Backup-resident data is subject to erasure on a delayed cycle (§7.6): standby is overwritten in normal operation; logical dumps retained 30d encrypted; WAL retained 7d. Within those windows the data is encrypted, isolated, unreachable from any production query path; restorable only via a documented incident process. Beyond windows the data ages out fully.

---

## 4. Right of Access — Article 15 (and Equivalents)

Subject is entitled to a copy of personal data being processed plus contextual metadata (purposes, recipients, retention, source, automated decisioning).

### 4.1 Endpoint

```
POST /privacy/export
  Headers: Authorization: Bearer <session-token>
           X-Identity-Verification: <verification-receipt-id>     (§9)
  Body:    { account_id: string,
             scope: "account" | "avatar",
             avatar_id?: string,            // required if scope=avatar
             format: ["json", "html", "fdsave"],
             include_archive?: bool         // include backup-resident state if recoverable; default false
           }
  Response (202 Accepted):
    { request_id: string,
      sla_due_at: ISO8601,
      poll_uri: string,
      contact: { dpo_email, ticket_id }
    }
```

Always asynchronous — full Avatar history can run hundreds of MB; synchronous return is incompatible with latency budgets and the redaction pass.

### 4.2 What Is Included

| Section | Contents |
|---|---|
| `manifest.json` | Bundle metadata (§14) |
| `account/` | Auth-DB rows for the account: profile, consents, payment profile (tokenized), session log |
| `avatars/<avatar_id>/` | Per-Avatar dump: profile, inventory, virtues, virtue log, quest journal, housing, market stalls, UGC, chat (own messages), voice metadata, GM session audit, replog slice |
| `transactions/` | Payment / refund / dispute records (subject's own) |
| `support/` | Support tickets the subject filed or was directly involved in |
| `moderation/` | Reports filed BY the subject, reports filed AGAINST the subject, warns/mutes/bans/restores from `admin_audit_log` (subject-side rows) |
| `analytics/` | All `TelemetryEvent` rows in raw retention tied via re-id service to the subject (re-identified for export only); aggregate rows are not subject-specific and are not included |
| `metadata/` | Contextual metadata required by Art. 15(1)(a–h): purposes, categories, recipients, retention, source, rights notice |
| `human-readable.html` | Single-file rendering of the JSON above for non-technical readers (§4.4) |

### 4.3 What Is Excluded

| Excluded | Reason |
|---|---|
| Other Avatars' Virtue log entries | Other person's PII (Art. 15(4) — rights of others) |
| Other Avatars' chat content (incl. DMs the subject did not send) | Other person's PII; participant-only rule (§6.2) |
| Other Avatars' display names in trade / report rows | Pseudonymized to `<other_anon_<n>>` per redaction pass (§6) |
| Anti-cheat detector internal weights and ML model parameters | Trade secret; legitimate interest |
| `admin_audit_log` rows where the subject is `cosigner_staff_id` rather than the target | Other staff's data |
| Internal moderator notes and free-text on tickets *about* the subject's psychological state, written for triage | Disclosure would chill moderation; redacted with audit-trail explanation. **`[OPEN]`** §16 — UK ICO guidance differs; review per-jurisdiction. |
| Re-id service raw `(anon_id, player_id)` mappings | Internal; the subject already has both anchors implicitly via their account |
| Aggregate analytics rows | Not personal data once aggregated below k-anonymity threshold |
| UGC by *other* creators that the subject merely played | Other creator's data |
| Discord conversations and Discord-side data (messages, voice activity, server membership, presence history, reactions, voice-channel logs) | Discord is a third-party community-augmentation platform (Doc #37 §Discord-interop, Doc #41); not in our perimeter, not our controllership. Players exercising data rights against Discord must do so directly with Discord. **Our export DOES include the player's `discord_id` linkage record** (so the subject can see what we stored about the link itself: the linked Discord user ID, link timestamp, scopes granted, link state) but NOT message contents or any Discord-side data. |

This Discord-side gap MUST be explicitly disclosed in the customer-facing privacy policy (`_docs/legal/privacy.md`, drafting owner per §19): players linking a Discord account need to understand that (a) we store only the link record, (b) Discord conversations are outside our export and outside our deletion authority, and (c) data rights against Discord are exercised through Discord's own privacy machinery. Cross-reference: Doc #37 §Discord-interop (interop spec), Doc #41 (Engine & Stack ADR — Discord bot process placement).

### 4.4 Human-Readable HTML

`human-readable.html` is a self-contained file (CSS/JS inlined, no external requests, no analytics) presenting data in a portal-style UI with tabs for Account, Avatars, Inventory, Quest Journal, Virtue Timeline, Chat, Transactions, Moderation. Required by Art. 12(1) "concise, transparent, intelligible and easily accessible form, using clear and plain language" — raw JSON does not satisfy this for non-technical subjects. Localized to the subject's preferred language (Doc #33).

---

## 5. Right to Portability — Article 20 (and Equivalents)

Stricter than access: data in a "structured, commonly used and machine-readable format" suitable for direct transmission to another controller where technically feasible.

### 5.1 Format

Portability bundles use the §16 layout with these guarantees: JSON Schema files in `_schemas/` versioned per `bundle_schema_version`; ISO-8601 UTC timestamps; subject's own identifiers in cleartext, cross-actor refs pseudonymized; `.fdsave` SQLite snapshot (Doc #21 §5) included for round-trippable Avatars (the "transmit to another controller" format); UTF-8 free-text.

### 5.2 Bundle Schema Versioning

```json
{
  "manifest": {
    "bundle_schema_version": 1,
    "engine_version": "0.4.2",
    "ugc_schema_version": 3,
    "produced_at": "2026-05-15T12:34:56Z",
    "produced_by": "avermere-reborn-privacy-pipeline/1.0",
    "subject": { "account_id": "acct_xyz", "scope": "account" },
    "request_id": "req_abc",
    "redaction_pass_version": 1,
    "regime_basis": ["GDPR", "UK_GDPR"]
  }
}
```

`bundle_schema_version` evolves independently of engine schema; forward-only migration per Doc #21 §4; schema changes shipped with notes in `_schemas/CHANGELOG.md`; old bundles remain valid; consumer tools must tolerate older versions.

### 5.3 What's Included In Portability vs. Access

Portability is a subset of access: only data the subject **provided** or that was **observed** from their interaction. Derived analytics (telemetry, anomaly scores, ML features) are NOT portable under Art. 20 — they are processor-derived. They ARE returned under access (§4). Manifest declares which regime / right the bundle was produced under; `analytics/` is omitted from portability bundles.

### 5.4 Direct Transmission

`POST /privacy/portability/transmit` accepts `{ request_id, target_controller: { name, contact, transport } }`. No industry-standard inter-MMO portability exists; launch supports transmission only between Project Virtue shard providers using `.fdsave`. Cross-operator transmission deferred pending standards or bilateral agreements (none anticipated).

---

## 6. Cross-Actor Redaction Pass

The most load-bearing mechanism in this document. Misimplementation is a P0 privacy incident.

### 6.1 Redaction Contract & Pseudonyms

Every record runs through the pass: (1) identify all identifiers (entity, avatar, account refs, IPs, emails, free-text mentions); (2) replace non-subject identifiers with stable per-bundle pseudonyms `<other_anon_<n>>` consistent across the bundle; (3) free-text scan and replace matched display names / known identifiers; (4) strip foreign IPs (subject's own remain); (5) record pseudonymization in `metadata/redaction_log.json`. Pseudonyms are stable **within** a bundle but **not across** bundles — stable cross-bundle pseudonyms would let a malicious requester correlate two bundles to re-identify a third party.

### 6.2 Direct Messages (Hardest Case)

DM thread between subject A and other party B: A's messages returned in full (B's identity redacted in metadata). B's messages NOT returned — listed as redacted stubs `{ from: "<other_anon_3>", at: "...", redacted: true }` so A sees the conversation *shape* (right to know) without leaking B's content. Where B quotes A, the quote is B's content (B is author) and is redacted; A's content already exists in A's own exported corpus. GDPR-compliant default; UK ICO and similar may differ — see `[OPEN]` §19.

### 6.3 Voice Buffer Snapshots

A snapshot retained for moderation (§3.4) carries audio of every speaker. If it involves the subject: a per-speaker time-segmented transcript is generated; subject's own segments returned as audio + transcript; others' segments as `{ speaker: "<other_anon_n>", duration_s, redacted: true }` with no audio. Transcript generation is itself processing — biometric-sensitive jurisdictions (notably PIPA) `[OPEN]` §19.

### 6.4 Reports & Screenshots Filed *About* the Subject

A third-party report filed against the subject: existence + reason category + outcome returned (right to know). Reporter's free-text redacted to category summary except for direct quotes of the subject. Reporter-uploaded screenshots redacted (`{ screenshot_id, uploaded_by: "<other_anon>", redacted: true }`); subject-uploaded returned in full.

### 6.5 Trade, Witness, Group Records

Trade records: subject's side full (items, gold delta, timestamp); counterparty pseudonymized. Witness counts returned as integers; witness identities redacted unless the witness is the subject. Party / guild / GM-session rosters: subject's own membership full; other members pseudonym-only. Guild internal comms follow chat-redaction posture.

---

## 7. Right to Erasure — Article 17 (and Equivalents)

### 7.1 Endpoint

```
POST /privacy/delete
  Headers: Authorization: Bearer <session-token>
           X-Identity-Verification: <verification-receipt-id>     (§9)
  Body:    { account_id, scope: "account" | "avatar", avatar_id?,
             reason_code: "no_longer_use" | "withdrew_consent" | "unlawful" | "other",
             reason_text?: string,
             confirm_understands_irreversibility: true   // explicit acknowledgment
           }
  Response (202 Accepted):
    { request_id, sla_due_at, contact, ticket_id, ledger_entry_id }
```

### 7.2 Cascade Rules

Each table has a posture:

| Table / Store | Erasure posture |
|---|---|
| `accounts` | Tombstone — PII cleared; row retained 30d for reversal (§7.7), then deleted |
| `account_payment_profiles` | Tokenized fields cleared; gateway customer revoked via API; tax-ledger hashed (§7.5) |
| `account_consents` | Retained (consent-history audit); subject id → deletion ledger entry id |
| `auth_session_log` | Retained 90d for security-incident investigation; IPs hashed |
| `player_avatars` + `player_inventory` / `_virtue_log` / `_quest_journal` / `market_stalls` | FK CASCADE per Doc #21 §11.3; hard delete after reversal window |
| `housing_instances` | Hard delete; plot returns to claimable pool (Doc #6 §3) |
| `ugc_creations` | Special — §7.3 |
| `replication_log` | NOT cascade-deleted (audit integrity); `actor_id → 0`, `params` sentinel-redacted (Doc #21 §11.3) |
| `admin_audit_log` | Never deletes (Doc #29 §9.2 hash chain); subject id → deletion ledger entry id; chain integrity preserved |
| `chat_log` | Subject's own messages hard-deleted; others' threads keep stub `{from: "<deleted_user>"}` |
| `voice_session_metadata` / `voice_buffers` | Subject's row + audio segments wiped; counterparty refs replaced; transcripts scrubbed for subject's name |
| `screenshot_attachments` | Subject-uploaded hard-deleted; about-subject by others retained with redaction tag |
| `support_tickets` | Deleted after legal-hold window (§7.5); operator-side notes redacted |
| `report_records` / `appeal_records` | BY subject: deleted. AGAINST subject: retained 5y, fields hashed |
| `gm_session_audit` | Subject removed from rosters; aggregate session metadata retained |
| `device_fingerprints` | Account binding deleted; raw fingerprint retained on confirmed-ban denylist (security legitimate interest) |
| Telemetry raw + anomaly tickets | Re-id severance (§7.4); signal payload retained for detector evaluation |
| Re-identification mappings | Subject's `(anon_id, player_id)` deleted; analytics rows become unresolvable forever |
| Aggregate analytics | Untouched (statistical, non-personal) |

### 7.3 UGC Treatment on Erasure

UGC poses a tension: subject's right to erasure of authorship metadata vs. other players' legitimate expectation of continued access to bookmarked quests / Hall of Wonders entries. Resolution:

- **Author identity erased.** `ugc_creations.author_avatar_id = NULL`; `provenance_note: "previous author requested erasure"`.
- **Published works remain** (`review_state IN ('approved','retired')`) under legitimate interest of others' enjoyment. Subject may separately request takedown via moderation queue (Doc #29 §4) — auto-approved within the 30-day post-erasure reversal window.
- Pending / rejected works (`review_state IN ('pending','rejected')`) are deleted.
- Paid earnings retained as anonymized ledger entries (§7.5).

### 7.4 Anonymization vs. Deletion (Telemetry & Analytics)

ClickHouse column-store rows cannot be efficiently deleted; erasure is implemented as **identifier severance**: the re-identification mapping `(actor_anon_id ↔ player_id)` is deleted from the re-id service DB. Without it, analytics rows are no longer linkable to the natural person. A new shard salt is **not** rotated (would re-key all current users); the deleted mapping is the single authoritative breaking link. This satisfies Art. 17 to the extent the data is no longer "personal data" once the link is severed (Recital 26 framing — privacy counsel sign-off pending, §19).

### 7.5 Legal-Hold Exceptions — Records That Must Persist

| Record | Retention basis | Form after erasure | Final disposition |
|---|---|---|---|
| Tax-relevant transactions | Statutory (US 7y, CA 4y, EU 5–10y, KR/BR 5y) | Hashed-buyer entry: `(transaction_id, amount, currency, sku, country, hash(email))`; name/address removed | Deleted at end of statutory window |
| Anti-fraud on confirmed-fraud accounts | Repeat-offender defense; consumer-protection holds | Hashed device fingerprint + behavioral signature | 7y from confirmation |
| Confirmed-ban audit chain | Doc #29 §9.2 hash-chain integrity | Subject id → ledger entry id; chain hash preserved | Indefinite |
| CSAM / harmful-content evidence | NCMEC, INHOPE, jurisdiction reporting | Per legal directive; no operator discretion | Per legal directive |
| Active-litigation hold | Court-ordered preservation | Full preservation under hold | Until hold released |
| Pending dispute / chargeback | Card-network retention (Visa/MC 540d) | Full transaction + subject id | Until dispute window closes |
| Criminal-investigation preservation request | Stored-communications laws | Full preservation under hold | Until order released |

Each legal-hold record carries `legal_hold_basis` and `legal_hold_until`. The deletion pipeline checks the flag and retains, partial-redacts, or refers to legal counsel.

### 7.6 Backup-Resident Data

Erasure cannot reach into encrypted, sealed daily logical dumps. Posture: the deletion ledger (§7.7) records the erasure date; on any future restore from backup, the deletion pipeline replays against the restored data before exposing it to any production query path. Backup retention is bounded (Doc #21 §11.1 — 30 days logical, 7 days WAL); within those windows the data is technically present but unreachable, and is aged out beyond. The 30-day worst-case is documented to the subject in the privacy policy and the deletion-confirmation email.

### 7.7 Deletion Ledger

```sql
-- privacy_deletion_ledger — append-only record of every erasure executed.
-- Migration filename: YYYYMMDDHHmmss_add_privacy_deletion_ledger.{pg,sqlite}.sql per Doc #21 §4.

CREATE TABLE privacy_deletion_ledger (
  ledger_entry_id          BIGSERIAL    PRIMARY KEY,
  account_id_hashed        TEXT         NOT NULL,                -- SHA-256 of original account_id with deletion-pepper
  scope                    TEXT         NOT NULL CHECK (scope IN ('account', 'avatar')),
  avatar_id_hashed         TEXT         NULL,
  reason_code              TEXT         NOT NULL,
  regime_basis             TEXT[]       NOT NULL,                -- e.g. ['GDPR', 'CCPA']
  requested_at             TIMESTAMPTZ  NOT NULL,
  executed_at              TIMESTAMPTZ  NOT NULL,
  completed_at             TIMESTAMPTZ  NULL,                    -- NULL until backup-window has fully aged out
  legal_hold_active        BOOLEAN      NOT NULL DEFAULT false,
  legal_hold_basis         TEXT         NULL,
  legal_hold_until         TIMESTAMPTZ  NULL,
  cascade_summary          JSONB        NOT NULL,                -- counts per table affected
  identity_verification_id TEXT         NOT NULL,                -- §9 receipt id
  prev_chain_hash          TEXT         NOT NULL,
  row_hash                 TEXT         NOT NULL                  -- SHA-256(canonical_json(row_minus_hash) || prev_chain_hash)
);
CREATE INDEX idx_pdl_executed ON privacy_deletion_ledger (executed_at);
CREATE INDEX idx_pdl_account_hashed ON privacy_deletion_ledger (account_id_hashed);
```

Hash-chained per Doc #29 §9.2. Records the *fact* of erasure + cascade summary; does NOT retain deleted PII. `account_id_hashed` uses a deletion-pepper distinct from any other salt — sufficient to confirm an erasure occurred, insufficient to re-identify.

### 7.7 30-Day Reversal Window

Account-scope erasure is reversible within 30 days from execution by the original holder via the recovery-code flow (Doc #32 §10). After 30 days, cascade is committed and `completed_at` is set; reversal no longer possible. Avatar-scope erasure within an active account is **not reversible** — cascade runs immediately and the operational backup window does not support partial-Avatar restore.

---

## 8. Right to Rectification, Restriction, Object

### 8.1 Rectification (GDPR Art. 16)

`POST /privacy/rectify { field, current_value, requested_value, reason }`.

| Field | Direct? | Operator-mediated? |
|---|---|---|
| Email | Yes — portal (Doc #32 §10) | N/A |
| Display name | Yes — within naming rules (Doc #15) | N/A |
| DOB | No — age-gate-sensitive | Yes; requires identity verification |
| Country of registration | No — payment-region-binding | Yes; requires re-verification |
| Marketing / telemetry flags | Yes — portal toggle | N/A |
| Avatar gender / class skew | No — locked at creation (Doc #15 §1.5) | One-time per Avatar via support |
| Virtue values | Never directly | Via Doc #29 §5 `restore_virtue` only, on bug-class evidence |

### 8.2 Restriction (GDPR Art. 18)

Account flagged `processing_restricted = true` while a rectification or objection is being resolved. Login permits read-only Avatar viewing; no new mutations beyond what's needed to process the restriction request; telemetry and analytics pause for the account; flag clears on resolution.

### 8.3 Objection (GDPR Art. 21)

| Category | Treatment of objection |
|---|---|
| Anti-cheat / security-event logging | Compelling legitimate interest; honored only by contract termination |
| Telemetry / analytics | Honored — equivalent to consent withdrawal |
| Marketing | Absolute honor (Art. 21(2)) |
| Aggregate public KPI reporting | No-op — already anonymized |

### 8.4 Withdraw Consent (Art. 7§3)

Toggle in portal; withdrawal does not affect lawfulness of pre-withdrawal processing.

### 8.5 Object to Automated Decisioning (Art. 22)

The only automated-decisioning surfaces are anti-cheat (Doc #32 §11) and Virtue Watch (Doc #29 §10), both with human-in-the-loop on consequential outcomes. Art. 22 review is handled via the Doc #29 §12 appeal flow.

---

## 9. Identity Verification

A privacy request the operator cannot authenticate is an impersonation vector. The verification flow gates every privacy request.

### 9.1 Verification Tiers

| Tier | Requirements | Used for |
|---|---|---|
| `verified.session` | Authenticated session + recent (≤ 5 min) password OR 2FA re-entry | Read-only: rectify marketing flags, restriction toggle |
| `verified.stepup` | `verified.session` + force-prompt 2FA + email-loop confirmation | Access (Art. 15), portability (Art. 20) |
| `verified.elevated` | `verified.stepup` + 7-day cooling-off (cancellable any time) | Erasure (Art. 17), account_terminate, payment-profile rectification |

### 9.2 Account-Compromise Flag

If `auth_session_log` shows recent (≤ 30d) login from unusual country/device, all requests force to `verified.elevated`, cooling-off extends to 14 days, with notifications to registered email and any verified backup contact.

### 9.3 Out-of-Band Recovery Path

Subject who cannot authenticate (lost credentials, 2FA device, recovery codes) reaches DPO via `dpo@virtu3.example` (§12) with a notarized identity attestation. Slow path; up to 30 days to verify; response window does not begin until verification completes.

### 9.4 Region-Specific Fast Paths

| Region | Special handling |
|---|---|
| KR (PIPA) | 10-day clock — `verified.elevated` with 48-hour cooling-off (vs. 7-day default) for KR-residence accounts |
| BR (LGPD) | Receipt acknowledged ≤ 24h per ANPD guidance |
| EU / UK | 30-day standard; Art. 12(3) extension available |
| CA | 45-day; extension available |
| AU | 30-day standard |

### 9.5 Verification Receipt

```json
{
  "verification_receipt_id": "vr_abc123",
  "tier": "verified.stepup",
  "issued_at": "2026-05-15T10:00:00Z",
  "expires_at": "2026-05-15T10:30:00Z",
  "account_id": "acct_xyz",
  "challenge_factors": ["password", "totp", "email_loop"]
}
```

The receipt is a short-lived (30 min) bearer token presented in `X-Identity-Verification` on the privacy endpoint call.

---

## 10. Storage of Export Bundles

### 10.1 Location & Encryption

Bundles live in a dedicated `privacy-exports` **S3-compatible object-storage** bucket (per the Doc #41 Engine & Stack ADR third-party services list), regionally pinned per §14. Encryption layers:

| Layer | Mechanism |
|---|---|
| At rest | AES-256-GCM server-side encryption, KMS-managed key per region |
| Per-bundle | Envelope encryption — one-time data-key derived from server master + `request_id`; wrapped to recipient's account-derived KEK on download |
| In transit | TLS 1.3 (Doc #32 §5) |
| Bundle archive | `.zip` with cleartext manifest + AES-256-GCM-encrypted `.dat` payload; password delivered separately to registered email AND in-portal |

### 10.2 Single-Use Download Links

```
GET /privacy/download?token=<single-use-token>
```

| Property | Value |
|---|---|
| Token lifetime | 7 days |
| Redemption | Single-use; new request required for re-download |
| Bandwidth | Direct serve up to 5 GB; chunked flow above |
| Auth | Token + `verified.stepup` re-auth if > 1h elapsed |
| Revocation | Subject can revoke unredeemed token from portal |
| Rate limit | 1 export per 24h per account (Doc #21 §11.2) |

### 10.3 Expiry

| Stage | Lifetime |
|---|---|
| Bundle awaiting redemption | 7 days, then purged |
| Bundle redeemed | Purged immediately on download confirmation |
| Generation failed | 30-day failure record; no payload produced |
| Verification receipt | 30 minutes (§9.5) |
| Privacy ticket | 5 years (dispute-defense legal hold) |

### 10.4 Key Custody

Per-region KMS-managed keys, HSM-backed root, annual minimum rotation. Resolves Doc #21 §15 [OPEN] item 5 for export-bundle encryption; backup-substrate keys remain Doc #21's question.

---

## 11. SLA & Pipeline

### 11.1 Targets

| Metric | Target | Hard cap |
|---|---|---|
| Receipt ack | Automated < 1 min | 24h (LGPD floor) |
| `verified.stepup` flow | Self-serve < 5 min | 24h |
| `verified.elevated` cooling-off | 7d default; 48h KR fast path; 14d on compromise flag | configured |
| Automated export runtime | < 6h kickoff → bundle | 7d |
| Automated deletion runtime | < 24h cooling-off-end → cascade | 7d |
| Manual review | < 7d | 30d |
| Worst-case overall | 30d | 30d GDPR/AU / 45d CA / 15d BR-receipt / 10d KR |
| Backup-window aged-out | 30d from execution | 30d |

### 11.2 Pipeline Architecture

```
POST /privacy/export
   -> Privacy Front-end -> Identity Verifier -> Verification Receipt
   -> Privacy Ticket Store
   -> Privacy Orchestrator (reads-only across §3 stores)
   -> Redaction Pipeline (bundle assembly + JSON Schemas + HTML render)
   -> Encrypt + Upload (region-pinned privacy-exports object store)
   -> Notification (email + in-portal alert + DPO ticket close)
```

Per the Doc #41 Engine & Stack ADR, the entire export and erasure pipeline — front-end privacy service, identity verifier, ticket store, orchestrator, redaction stage, encrypt-and-upload — is implemented on the **authoritative Rust server backend**, and bundles land in **S3-compatible object storage** (§10.1). The UE5 production client and the TS/PixiJS web prototype only *initiate* a privacy request and surface its state to the subject; both clients reach the pipeline via the Protobuf wire protocol (Doc #41) and never touch the redacted PII directly — even the in-portal "download" is fronted by the Rust backend handing out a single-use signed URL (§10.2). The orchestrator is a dedicated service with reads-only credentials across §3 stores; it cannot write to operational stores. Erasure flows similarly but with deletion credentials gated on `verified.elevated` receipt and cooling-off elapsed.

### 11.3 Failure Handling

| Failure | Response |
|---|---|
| Identity verification fails | Request rejected with reason; no data accessed |
| Cooling-off cancellation | Request voided; ticket closed |
| Orchestrator fails mid-bundle | Retry up to 3 times; on persistent failure, escalate to DPO; subject notified |
| Redaction pipeline fails | Bundle held; escalate to Privacy Engineering; subject notified of delay with new SLA |
| Object-store upload fails | Retry; on persistent failure, switch region per disaster-recovery policy |
| Subject becomes uncontactable mid-flow | Bundle retained 30 days; final disposal per §10.4 |
| Legal hold appears mid-deletion | Cascade halts; subject notified of legal-hold basis (where disclosure is permitted) and revised disposition |

---

## 12. DPO & Breach Notification

### 12.1 DPO Contact

| Role | Contact |
|---|---|
| DPO (EU/UK) | `dpo@virtu3.example` (final domain `[OPEN]` §19) |
| Encarregado (BR) | Same DPO routes initially; Brazil-resident named contact `[OPEN]` §19 |
| US privacy contact | `privacy@virtu3.example` |
| Postal address | In privacy policy |
| EU representative (Art. 27) | Required if no EU establishment `[OPEN]` §19 |

The DPO is publicly named and directly reachable without routing through support. Privacy requests auto-route to the DPO queue; support staff cannot resolve them.

### 12.2 Breach Notification — 72-Hour Rule

```
Detection -> Triage -> Containment -> Assessment -> Notification (if required)
   t0          t0+1h     t0+4h          t0+24h       t0 + 72h (hard cap)
```

| Regime | Authority notification | Subject notification |
|---|---|---|
| GDPR / UK GDPR | Art. 33 — 72h to supervisory authority unless unlikely to risk rights | Art. 34 — without undue delay if **high** risk |
| AU Privacy Act (NDB) | OAIC "as soon as practicable" upon reasonable grounds | Same (eligible breach) |
| KR PIPA | PIPC + subjects, periods vary by breach class; encryption status mitigating | Same |
| BR LGPD | ANPD "reasonable time" — operative ~2 business days | Same |
| CA CPRA | California AG if > 500 CA residents affected | Per CCPA breach-notice rules |

### 12.3 Internal Breach-Response Flow

| Phase | Owner | SLA | Output |
|---|---|---|---|
| Detection | Security on-call | t0 | P0 incident ticket |
| Triage | Security + DPO | t0 + 1h | Severity: Trivial / Significant / Severe |
| Containment | Engineering | t0 + 4h | Vector closed; blast radius bounded |
| Assessment | DPO + legal | t0 + 24h | Per-regime notification determination |
| Notification | DPO | t0 + 72h hard cap | Filings to authorities + subject comms |
| Public statement | Comms | per case | Status page + (warranted) post-mortem |
| Post-mortem | Engineering | t0 + 30d | RCA + remediation plan |

Runbook: `runbooks/privacy-breach.md`. Tabletop exercises quarterly; at least one annual end-to-end scenario including DPO-notification drafting.

### 12.4 What Counts as a Personal Data Breach

A breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data. Project Virtue examples (non-exhaustive): unauthorized access to operational PG / auth DB or privacy-export bucket; compromise of an `admin.*` MCP session; UGC sandbox escape (Doc #32 §9); successful staff-credential exfiltration; misdirected privacy-export bundle. Loss of an unencrypted backup tape would qualify but is mitigated by §10.2 encryption.

### 12.5 DPIA — Data Protection Impact Assessment

DPIA required under Art. 35 for "high risk" processing. Project Virtue triggers: telemetry pipeline launch (Doc #28); voice chat with moderation snapshots (Doc #27); UGC sandbox public submission (Doc #19); anti-cheat behavioral analysis with automated enforcement (Doc #32 §11–§12); cross-border transfer to any new region; any new feature processing children's data beyond age-gate. Each DPIA records nature/scope/purpose, necessity & proportionality, risks, mitigations, residual risk, DPO sign-off. Stored at `_compliance/dpia/<feature>_<date>.md`.

---

## 13. Consent Management

### 13.1 Consent Categories

| Category | Default | Withdrawable? |
|---|---|---|
| Service-essential processing | Implicit (Contract) | Only by account termination |
| Telemetry — engagement, social, UGC, economy (Doc #28 §4.3) | OFF | Yes; granularity per Doc #28 §14 item 3 |
| Telemetry — performance (Doc #28 §8) | OFF | Yes |
| Telemetry — security / anti-cheat (Doc #32) | ON (legitimate interest) | Object only; Doc #29 §16 |
| Voice chat (Doc #27) | OFF (per session opt-in) | Yes |
| Voice rolling-buffer moderation snapshot (Doc #27 §6) | ON when voice active (legitimate interest) | Object only; muting is the practical opt-out |
| Marketing email / push / personalized offer | OFF | Yes (one-click unsubscribe) |
| "Sale or share" (CCPA) | NEVER — operator never sells | N/A |
| Cross-shard cohort analysis (Doc #28 §14 item 9) | OFF | Yes |
| Featured creator name display (Doc #28 §11.3) | OFF | Yes |
| Public Virtue leaderboard display | OFF | Yes |

### 13.2 Consent Storage

```sql
-- account_consents — per-purpose, per-version consent ledger.
-- One row per (account_id, purpose, policy_version).

CREATE TABLE account_consents (
  consent_id          BIGSERIAL    PRIMARY KEY,
  account_id          TEXT         NOT NULL,
  purpose             TEXT         NOT NULL,                      -- one of §13.1 categories
  state               BOOLEAN      NOT NULL,
  policy_version      TEXT         NOT NULL,                      -- e.g. "2026-05-01"
  granted_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  withdrawn_at        TIMESTAMPTZ  NULL,
  origin              TEXT         NOT NULL,                      -- 'registration' | 'portal' | 'in_game' | 'support'
  ip_at_grant         TEXT         NULL,
  ua_at_grant         TEXT         NULL,
  CONSTRAINT chk_state_withdraw CHECK (
    (state = true AND withdrawn_at IS NULL) OR
    (state = false AND withdrawn_at IS NOT NULL) OR
    (state = false AND withdrawn_at IS NULL)              -- never granted
  )
);
CREATE INDEX idx_consents_account ON account_consents (account_id, purpose, granted_at DESC);
```

Consent state is read by joining the latest row per `(account_id, purpose)` and checking `state` and `withdrawn_at`. Old rows are retained for audit ("when did the subject grant / withdraw").

### 13.3 Consent UX

- **Registration**: layered consent screen, service-essential above + optional toggles below, all default OFF except service-essential. Affirmative flip required to grant.
- **Portal**: `Privacy Settings` mirrors registration toggles. Changes effective immediately; telemetry pipeline reads live value at emission time.
- **In-game**: privacy widget in main menu shows current state and links to portal.
- **Layered notice**: policy presented hierarchically — one-screen summary, expandable per-section, full-text — plain language per Art. 12(1).
- **Re-consent on policy change**: material `policy_version` bump for a previously-consented category re-prompts; without re-consent, prior consent treated as withdrawn.

### 13.4 Age-Gate UX

At registration the subject enters DOB. **< 13**: registration refused. **13–17** (or local equivalent): account flagged `is_minor = true`; marketing locked off; telemetry locked off until majority; optional verifiable parental consent flow (provider `[OPEN]` §19 — PRIVO / kidSAFE / in-house) unlocks limited categories where the regime permits. **18+**: full UX per §13.3. DOB is encrypted at rest; falsification is a TOS violation; correction is operator-mediated per §8.1.

### 13.5 "Do Not Sell or Share" — CCPA

Operator policy is permanent no-sale. Privacy policy states this and the footer link (`Do Not Sell or Share My Personal Information`) leads to a confirmation page recording the affirmation. No toggle required — answer is always "no sale" — but the link must exist per CPRA cosmetic compliance.

---

## 14. Cross-Border Transfer & Region Pinning

### 14.1 Region Pinning

Each subject's data is pinned to a region based on the country of registration:

| Region | Bucket | Stores |
|---|---|---|
| `eu-west` | EU-region S3 / PG / ClickHouse | EU + UK + EEA subjects |
| `us-east` / `us-west` | US-region equivalents | US + Canada + LatAm-non-BR subjects |
| `ap-northeast` | Tokyo / Seoul region | KR (per PIPA `[OPEN]`), JP, AP-non-AU |
| `ap-southeast` | Sydney region | AU + NZ + SE Asia |
| `sa-east` | São Paulo region | BR (LGPD) |

Cross-region replication is restricted to **anonymized aggregates** (Doc #28 §3.2) only. Raw PII does not leave the subject's pinned region without an explicit transfer mechanism (§14.2).

### 14.2 Transfer Mechanisms

When data transit across regions is unavoidable (e.g., a EU subject playing on a US shard):

| Mechanism | When applied |
|---|---|
| **Standard Contractual Clauses** (SCCs, EU Commission 2021/914) | EU → non-adequate third country (US, KR pre-adequacy) |
| **UK International Data Transfer Agreement** (IDTA) or UK addendum to SCCs | UK → non-adequate third country |
| **Adequacy decision** | EU → AR, CA (commercial), GB, IL, JP, KR (if granted), CH, NZ, US (DPF participants) — no SCCs needed |
| **Binding Corporate Rules** (BCRs) | Inter-affiliate transfers within the operator's corporate group, where applicable — operator's eventual structure pending `[OPEN]` |
| **Explicit consent** (Art. 49(1)(a) derogation) | Subject explicitly opts in to play on a non-pinned region's shard, with informed-consent UX disclosing the transfer; logged in `account_consents` |

The cross-shard play case is the practical hot-path: a EU subject choosing to log into a US shard to play with US friends. The shard-selection UI surfaces the transfer notice and records consent.

### 14.3 Schrems II Considerations

Post-Schrems-II posture requires Transfer Impact Assessments (TIAs) for transfers to jurisdictions with surveillance laws considered incompatible with EU fundamental-rights protections. Project Virtue conducts TIAs per non-adequate destination region and supplements SCCs with technical measures (EU-held key encryption-at-rest, boundary pseudonymization) as warranted.

### 14.4 Data Processor Agreements

All sub-processors (object-store, payment gateway, KMS, warehouse vendor, voice routing, anti-DDoS, email delivery) execute DPAs. The list is published in the privacy policy and updated on change with subject notification.

---

## 15. Audit Log of Privacy Requests

Every privacy request — receipt, verification, fulfilment, denial, escalation — is recorded in `privacy_request_log` (migration `YYYYMMDDHHmmss_add_privacy_request_log.{pg,sqlite}.sql` per Doc #21 §4).

### 15.1 Schema

```sql
CREATE TABLE privacy_request_log (
  log_id                BIGSERIAL    PRIMARY KEY,
  request_id            TEXT         NOT NULL,
  account_id            TEXT         NULL,                  -- NULL pre-verification
  account_id_hashed     TEXT         NOT NULL,              -- deletion-pepper hash
  request_kind          TEXT         NOT NULL CHECK (request_kind IN
                          ('access','portability','erasure','rectification','restriction',
                           'objection','consent_withdrawal','transfer_consent','breach_notification')),
  regime_basis          TEXT[]       NOT NULL,
  state                 TEXT         NOT NULL CHECK (state IN
                          ('received','verifying','cooling_off','processing',
                           'awaiting_legal','fulfilled','denied','withdrawn','expired')),
  state_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  identity_verification TEXT         NULL,
  cooling_off_ends_at   TIMESTAMPTZ  NULL,
  reason                TEXT         NULL,
  staff_id              TEXT         NULL,
  related_ticket_id     BIGINT       NULL,
  prev_chain_hash       TEXT         NOT NULL,
  row_hash              TEXT         NOT NULL
);
CREATE INDEX idx_prl_request    ON privacy_request_log (request_id, state_at);
CREATE INDEX idx_prl_account_h  ON privacy_request_log (account_id_hashed, state_at);
CREATE INDEX idx_prl_kind_state ON privacy_request_log (request_kind, state, state_at);
```

Hash chain per Doc #29 §9.2; read-restricted to `admin.root` + DPO role.

### 15.2 Reportability & Subject Visibility

Quarterly internal aggregate report: requests per kind / regime / state, SLA-breach count, rejection reasons — supports per-jurisdiction supervisory-authority annual statistics. Subjects see their own request history via portal (`Privacy Settings → Request History`); other subjects' requests are not visible to anyone except DPO + `admin.root`.

---

## 16. Worked Example — Full Account-Scope Export Bundle

Subject Anastasia (registered EU; has 2 Avatars on a Virtue shard, 1 on Classic, has published 1 UGC quest, has filed 2 reports against another player, has been the target of 1 dismissed report, has 4 transactions over 18 months) requests an account-scope access export.

```
avermere-reborn-export_acct_xyz_2026-05-15.zip
└── manifest.json                                   <- bundle_schema_version, etc.
└── _schemas/
    ├── README.md                                  <- how to read this bundle
    ├── CHANGELOG.md                               <- bundle schema history
    ├── account.schema.json
    ├── avatar.schema.json
    ├── inventory.schema.json
    ├── virtue_log.schema.json
    ├── chat_log.schema.json
    ├── telemetry.schema.json
    └── ...
└── account/
    ├── profile.json                               <- email, display name, country, DOB (decrypted), language pref
    ├── consents.json                              <- full account_consents history
    ├── auth_session_log.json                      <- 90 days of own logins, IPs hashed for non-self IPs (none)
    ├── payment_profile.json                       <- tokenized card metadata
    └── transactions.json                          <- 4 records: amounts, SKUs, status, refunds
└── avatars/
    ├── ava_001/                                   <- Virtue-shard Avatar #1
    │   ├── profile.json                           <- display name, virtues, current region/position
    │   ├── inventory.json                         <- 247 entity rows; nested containers preserved
    │   ├── inventory.fdsave                       <- SQLite snapshot per Doc #21 §5
    │   ├── virtue_log.json                        <- 1,842 rows
    │   ├── quest_journal.json                     <- 17 quests
    │   ├── housing_instances.json                 <- 1 plot in Stonereach
    │   ├── market_stalls.json                     <- 1 stall, 12 listings
    │   ├── chat/
    │   │   ├── public_messages.json               <- 312 own messages
    │   │   ├── party_messages.json                <- 89 own messages; 47 redacted entries from others
    │   │   └── direct_messages.json               <- 23 threads; own content full, others redacted per §6.2
    │   ├── voice_metadata.json                    <- 14 sessions, peers redacted
    │   ├── voice_snapshots/                       <- empty (no snapshots tied to this Avatar)
    │   ├── gm_session_audit.json                  <- joined 2 hosted sessions; hosted 0
    │   ├── replication_log_slice.json             <- 30-day slice of own VerbInvocations
    │   ├── reports_filed.json                     <- 2 reports, targets redacted
    │   ├── reports_against.json                   <- 1 report, reporter redacted, dismissed
    │   ├── moderation_actions.json                <- 0 enforcements (no warns/mutes/bans)
    │   └── ugc_authored.json                      <- 1 quest, full payload
    ├── ava_002/                                   <- Virtue-shard Avatar #2
    │   └── ... (same shape, smaller)
    └── ava_003/                                   <- Classic-shard Avatar
        └── ... (same shape; offline-mode caveats noted)
└── analytics/
    ├── telemetry_events.json                      <- raw 90-day TelemetryEvent rows, re-identified for export
    ├── anomaly_tickets.json                       <- 0 tickets (clean account)
    └── mcp_invocations.json                       <- 0 (Avatar didn't use MCP)
└── support/
    └── tickets.json                               <- 1 ticket (asked about a billing question), full thread
└── moderation/
    └── appeal_records.json                        <- 0 appeals (no enforcements)
└── metadata/
    ├── purposes.json                              <- Art. 15(1)(a–h) contextual metadata
    ├── recipients.json                            <- list of sub-processors data was disclosed to
    ├── retention.json                             <- per-table retention basis
    ├── source_of_data.json                        <- 'subject-provided' / 'observed-from-gameplay' tags
    ├── automated_decisioning.json                 <- description of anti-cheat & Virtue Watch
    ├── transfer_mechanism.json                    <- consent record for any cross-region play
    ├── redaction_log.json                         <- internal-audit of per-record redactions (subject readable)
    └── rights_notice.json                         <- subject's rights and how to exercise them
└── human-readable.html                            <- single-file portal view of all of the above, localized to en-GB (subject's pref)
└── BUNDLE_INTEGRITY.txt                           <- SHA-256 checksums of every file in the bundle
└── SIGNATURE.json                                 <- detached signature of BUNDLE_INTEGRITY.txt with operator's signing key
```

Bundle size: ~78 MB gzipped (dominated by `replication_log_slice.json` and `virtue_log.json`); generation wall-clock 12 min. A portability bundle for the same subject omits `analytics/` and `metadata/automated_decisioning.json` — approximately 41 MB.

---

## 17. MCP Surface Additions

Amends Doc #14 §3, §5, §6. All new capabilities follow Doc #29 §2's strict explicit-grant posture; none advertised to player-tier sessions.

### 17.1 New Capabilities

| Capability | Holders | Powers |
|---|---|---|
| `privacy.read` | DPO, privacy engineering, `admin.root` | Read `privacy_request_log`, `privacy_deletion_ledger`, request-state resources |
| `privacy.process` | Privacy orchestrator service identity (machine-only) | Execute export & deletion pipelines |
| `privacy.dpo` | DPO only | Receipt acks, manual fulfilment, legal escalation, breach-notification drafting |

### 17.2 New Tools

| Tool | Capability | Notes |
|---|---|---|
| `privacy_acknowledge_request(request_id)` | `privacy.dpo` | DPO manual receipt ack (automated default; manual fallback) |
| `privacy_kickoff_export(request_id)` | `privacy.process` | Begins export pipeline (§11.2) |
| `privacy_kickoff_deletion(request_id)` | `privacy.process` | Begins deletion pipeline post cooling-off |
| `privacy_apply_legal_hold(account_id, basis, until)` | `privacy.dpo` + `admin.root` co-sign | Sets `legal_hold_active` on pending erasure |
| `privacy_release_legal_hold(account_id)` | `privacy.dpo` + `admin.root` co-sign | Releases hold; deletion resumes |
| `privacy_revoke_export_token(request_id)` | `privacy.dpo` or subject session | Invalidates an outstanding download token |
| `privacy_extend_sla(request_id, new_due_at, justification)` | `privacy.dpo` | Documents Art. 12(3) extension; notifies subject |
| `breach_open(severity, scope_summary, classification)` | `privacy.dpo` | Opens breach ticket; starts §12.3 clock |
| `breach_notify_authority(breach_id, regime, filing_payload)` | `privacy.dpo` + `admin.root` co-sign | Records filing; actual filing via regime portal out-of-band |

### 17.3 New Resources

| Resource URI | Capability | Returns |
|---|---|---|
| `forge://privacy/requests?since={ts}` | `privacy.read` | Paged `privacy_request_log` rows |
| `forge://privacy/request/{request_id}` | `privacy.read` | Full request state + history |
| `forge://privacy/deletions?since={ts}` | `privacy.read` | Paged `privacy_deletion_ledger` rows |
| `forge://privacy/breaches?since={ts}` | `privacy.dpo` | Active and historical breach tickets |
| `forge://privacy/dpia` | `privacy.read` | DPIA index with sign-off status |
| `forge://privacy/sub_processors` | `privacy.read` | Current sub-processor list |

Cross-shard accessible — privacy is account-scoped, transcending shard binding. `privacy.process` is held only by the orchestrator service, restricted to the privacy front-end's network namespace.

### 17.4 Five Invariants Compliance (Doc #14 §4)

Privacy tools never mutate Entity state — they operate on request-lifecycle metadata, ledger entries, and archival data; no new path into `PlayerInputDispatcher`. Deletion cascades use documented FK/RLS rules (§7.2) via standard DB connections, not raw substrate. Privacy capabilities are never advertised to player tiers (misadvertisement is a P0 audit failure). Every privacy action writes `privacy_request_log` and, for staff actions, `admin_audit_log` (Doc #29 §9), with hash chains preserved on both. Operations bind to `account_id` at request time; shard-bound work spawns from there but never cross-binds.

---

## 18. Phase 1 Prototype Scope

Per Doc #11 (Highmere-only, 8-player, 12 weeks). Phase 1 is single-player vertical slice with no real users; no production privacy obligations attach. Schema and contracts ship in Phase 1 so Phase 2 multiplayer launch is a backend swap.

| Subsystem | Phase 1 | Deferred to Phase 2+ |
|---|---|---|
| `/privacy/export` | Stub: returns local `.fdsave` + consent JSON; no HTML, no redaction (single user) | Full §4 + §5 + §6 redaction pipeline |
| `/privacy/delete` | Stub: deletes the local save | Full §7 cascade + ledger + backup-aware tombstoning |
| Identity verification | Trivial (single dev user) | Full §9 tier system |
| Consent management | Two toggles (telemetry, marketing) default OFF in `metadata`; functionally no-ops since Phase 1 telemetry is local-only | Full §13 ledger + per-purpose toggles + age-gate |
| `privacy_request_log` / `privacy_deletion_ledger` | Schemas in `00000000000000_initial.{pg,sqlite}.sql`; flat-file sink (Doc #29 §15 pattern) | DB-backed with hash chain |
| DPO contact, breach response, DPIAs | Internal runbook + one Phase 1 DPIA (telemetry pipeline) | Full §12 flow + tabletop + per-feature DPIAs |
| Cross-border transfer + region pinning + sub-processor list | N/A (no production users) | Full §14 |
| Audit log of requests | Minimal scaffolding | Full §15 |

Phase 1 success metric: privacy schemas exist in `00000000000000_initial.{pg,sqlite}.sql`; consent toggles function in the onboarding flow (Doc #24); privacy policy text exists at `_docs/legal/privacy.md` (drafting owner `[OPEN]` §19) and loads in the onboarding consent screen.

---

## 19. Open Questions

1. `[OPEN]` **Public privacy policy text.** Doc specs machinery, not customer-facing legal text. Owner: Trust-and-Safety + privacy counsel. Required by Phase 2.
2. `[OPEN]` **Final domain & DPO email.** §12.1 — pending TLD and legal-entity domicile.
3. `[OPEN]` **EU representative (Art. 27) & BR Encarregado.** §12.1 — depends on operator domicile decision.
4. `[OPEN]` **Korea data residency.** §14.1 — PIPA may require an `ap-northeast` primary store for KR subjects, not just a region-pinned shard. Significant infra implication.
5. `[OPEN]` **Verifiable parental consent provider.** §13.4 — PRIVO, kidSAFE, or in-house.
6. `[OPEN]` **DM redaction posture.** §6.2 — UK ICO has interpreted communications-export cases more permissively; re-evaluate Phase 2 with counsel.
7. `[OPEN]` **Recital-26 framing for analytics anonymization.** §7.4 — defensible but jurisdiction-dependent; ANPD and PIPC guidance less explicit than EDPB.
8. `[OPEN]` **Voice biometric processing.** §6.3 — transcription is itself processing; PIPA treats biometrics strictly. Audio in exports vs transcript-only.
9. `[OPEN]` **Cross-region salt strategy.** Intersects Doc #28 §14 [OPEN] item 9 with §14 here — per-region salts kill cross-region cohorts; global salts make raw rows technically transferable.
10. `[OPEN]` **Mid-deletion legal hold notification.** §11.3 — disclosure of the hold's basis varies by jurisdiction (gag-order regimes vs. notice-required).
11. `[OPEN]` **Granular telemetry consent.** Inherits Doc #28 §14 [OPEN] item 3; resolution affects §13.1 UX.
12. `[OPEN]` **Bundle delivery >5 GB.** §10.3 — chunked-download flow not yet specified.
13. `[OPEN]` **DPIA cadence beyond launch.** §12.5 — annual review default proposed; needs ratification.
14. `[OPEN]` **Aggregate transparency-report publication.** Counts of requests received/fulfilled per regime per quarter — operator policy call.
15. `[OPEN]` **Right-to-be-forgotten propagation to search-engine caches** of public profile / housing-tour pages (Doc #28 §11.3 dashboard).
16. `[OPEN]` **Recipient enumeration per Art. 15(1)(c).** §16 — generation-time enumeration vs static list trade-off.
17. `[OPEN]` **Cross-border transfer consent UX** in the shard-pick flow. §14.2 — design owner.

---

## 20. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1–§3 (philosophy, regulation matrix, data inventory) | Doc #13 §4, Doc #21 §3, Doc #27 §6, Doc #28 §3, Doc #29 §3, §9, Doc #32 §10, Doc #33 |
| §4–§5 (access, portability) | Doc #28 §4.2 (resolved), Doc #21 §5, §11.2 (resolved), Doc #19 §5 |
| §6 (redaction) | Doc #15 §6.2, Doc #18 §9, Doc #26 §12, Doc #27 §6 |
| §7 (erasure) | Doc #21 §11.3, Doc #29 §9.2, Doc #28 §4.1 |
| §8 (rectification / restriction / object) | Doc #15 §1.5, Doc #29 §5, §10, Doc #32 §11 |
| §9 (identity verification) | Doc #32 §10 |
| §10 (storage) | Doc #21 §15 item 5 (partial resolution here), Doc #32 §5 |
| §11 (SLA & pipeline) | Doc #28 §3 |
| §12 (DPO & breach) | Doc #29 §16 item 1 (shared on-call) |
| §13 (consent) | Doc #24, Doc #28 §4.3 |
| §14 (cross-border) | Doc #6 §2, Doc #28 §3.2 |
| §15 (audit log) | Doc #29 §9 |
| §16 (worked example) | Doc #21 §5 |
| §17 (MCP additions) | Doc #14 §3, §5, §6; Doc #29 §14 |
| §18 (Phase 1) | Doc #11, Doc #21 §12, Doc #29 §15 |
| Engine / stack authority | **Doc #41 (Engine & Stack ADR)** — privacy pipeline runs on Rust server backend; bundles in S3-compatible object storage; UE5 + TS/PixiJS clients only initiate and surface state via Protobuf wire protocol |

---

End of Document #38.
