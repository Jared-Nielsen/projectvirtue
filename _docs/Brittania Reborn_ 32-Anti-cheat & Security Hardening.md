# Document #32: Anti-cheat & Security Hardening

Status: Draft (Phase 2 hardening priority; partial Phase 1 scaffolding per §18)
Scope: server-side validation contracts, packet integrity, rate limiting, suspicious-pattern detection, MCP security model, account security
Resolves: Doc #22 §9 deferred anti-cheat hardening; Doc #19 §14 [OPEN] item 1 (Lua VM choice)
Cross-refs: Docs #5, #13, #14, #18, #19, #21, #22, #23, #25, #28, #29

---

## 1. Security Philosophy

The server is authoritative on every gameplay decision (Doc #22 §9): clients submit intent via `VerbInvocation`, the server validates and resolves, and the resolved state is replicated back. Clients are untrusted — their packets are inputs to a validation pipeline, not commands. UGC code runs in an isolated sandbox VM (Doc #19 §5), never in the host process. Defense in depth is the operating principle: every layer (TLS, HMAC, sequence, rate limit, range/LOS check, capability check, behavioral analysis) is independently useful, and no single layer is assumed sufficient. The original `[BR]` security layer sits over the `[BG]` simulation foundation — `[BG]` provides deterministic verb dispatch and authoritative state; `[BR]` adds network hardening, sandbox isolation, anti-cheat heuristics, and account security on top.

---

## 2. Threat Model

| Threat | Vector | Impact | Severity |
|---|---|---|---|
| Speed hack | Modified client claims faster movement | Unfair PvP, exploit | High |
| Item duplication | Race condition in trade or container ops | Economy collapse | Critical |
| Wall hack | Modified client renders through obstacles | Information advantage | Medium |
| Aimbot | Auto-targeting | Combat advantage | Medium |
| Packet replay | Replay verb invocation packets | State corruption | High |
| Credential theft | Phishing, session hijack | Account takeover | Critical |
| Bot farming | Automated UGC publishing or grinding | Economy / UGC pollution | High |
| UGC sandbox escape | Lua VM escape via VM bug | Server compromise | Critical |
| MCP abuse | Privileged MCP session leaked | Capability abuse | Critical |
| DDoS | Volumetric attack on edge | Service unavailable | Medium |
| Save file forgery | Tampered local save uploaded to shard | Unfair starting state | Medium |
| Virtue laundering | Coordinated low-Virtue acts evade detection | Watch evasion (Doc #5) | Low |

Row count: 12.

---

## 3. Server-side Validation Contracts

Formalizes Doc #22 §9. Every `VerbInvocation` (Doc #13) re-validated server-side regardless of any client-side check:

| Check | Description | Failure Code |
|---|---|---|
| Range | Actor position vs target position vs verb's `max_range` | `ERR_OUT_OF_RANGE` |
| LOS | Bresenham trace per Doc #23 §7 | `ERR_NO_LOS` |
| Capability | Caller session permits this verb (Doc #14 capability tier) | `ERR_CAP_DENIED` |
| Rate | Per-actor per-verb rate within budget (§4) | `ERR_RATE_LIMITED` |
| Resource | Actor has reagents / mana / inventory space | `ERR_INSUFFICIENT_RESOURCE` |
| Sanity | Physics-impossible parameters rejected (NaN, negative duration, etc.) | `ERR_INVALID_PARAM` |

```
ValidationResult {
  ok: bool,
  code: ErrorCode?,           // returned to client (no detail)
  diagnostic: string?,         // server-internal log only
  actor_flag: FlagSeverity?    // none | watch | throttle | suspend
}
```

Client-facing error responses are opaque codes only. Internal diagnostic strings (which check failed, which value tripped it) are written to `validation_log` for forensics; never echoed to the client. This denies attackers the oracle needed to probe validation boundaries.

---

## 4. Rate Limits

Per capability tier, with per-verb overrides.

```
RateLimits {
  per_capability: Map<CapabilityTier, RateBudget>,
  per_verb: Map<VerbId, PerActorRate>
}

RateBudget {
  verbs_per_second_steady: int,
  verbs_per_second_burst: int,
  burst_window_seconds: int,
  daily_quota: int?
}

PerActorRate {
  max_per_second: float,
  cooldown_ms: int?
}
```

### Defaults (per capability tier, Doc #14)

| Tier | Steady (v/s) | Burst (v/s) | Burst Window (s) | Daily Quota |
|---|---|---|---|---|
| `inspect.read` | 10 | 50 | 5 | none |
| `avatar.basic` | 5 | 20 | 5 | none |
| `avatar.full` | 5 | 20 | 5 | none |
| `ugc.author` | 2 | 10 | 5 | 5000 |
| `gm.host` | 10 | 50 | 10 | none |
| `admin.*` | 50 | 200 | 10 | none |

`ugc.author` has no burst use case during normal play (creators iterate slowly), so the budget is intentionally tight — bot publishing pipelines hit this wall first.

### Per-verb overrides (apply on top of tier budget)

| Verb | Cap |
|---|---|
| `attack` | 2 / s (matches realistic combat swing rate) |
| `cast_spell` | 1 / s |
| `talk` | 0.5 / s (one initiated dialogue line per 2 s) |
| `pickup` | 5 / s |
| `drop` | 5 / s |
| `trade_offer` | 0.5 / s |

### Enforcement Ladder

1. First N (configurable, default 3) violations within rolling 60 s: silent throttle (delay packet processing 100–500 ms; client experiences mild lag).
2. Continued violation: return `ERR_RATE_LIMITED`; client must back off.
3. Sustained violation across multiple sessions or escalation: auto-warn entry in moderation queue (Doc #29 §11) for human review.

---

## 5. Packet Integrity

| Layer | Mechanism |
|---|---|
| Transport | TLS 1.3 for all client–server traffic (auth, game data, MCP SSE) |
| Per-message authenticity | HMAC-SHA256 signature with session key; defends against TLS-termination abuse at proxy boundaries (e.g., compromised CDN edge) |
| Replay | Per-session monotonically increasing `sequence_number` |
| Out-of-order tolerance | Packets within `±64` of last-seen high-water mark accepted (network reality); outside window dropped silently |
| Replay window | Server retains last 256 sequence numbers per session in a rolling bitset; duplicate → drop + flag |
| Detected replay | Drop packet, increment `session.replay_count`, flag session for elevated monitoring; threshold violation → revoke session |

Session key is derived during authentication handshake (TLS-protected) and never re-transmitted. Key rotation on session refresh (§10).

---

## 6. Movement Validation

A primary cheating vector. Server tracks each Avatar's last authoritative position and last-update timestamp.

```
MovementCheck(avatar, reported_pos, t_now):
  dt = t_now - avatar.last_update_t
  max_dist = avatar.move_speed * dt * 1.2     // 20% slack for jitter
  if dist(avatar.last_pos, reported_pos) > max_dist:
    snap_to(avatar.last_pos)                  // server is authoritative
    flag(avatar, "speed_violation")
    return ERR_TELEPORT_DETECTED
  avatar.last_pos = reported_pos
  avatar.last_update_t = t_now
```

Repeat-violation ladder: throttle → `ERR_TELEPORT_DETECTED` → ban consideration via Doc #29 queue.

Legitimate teleports (moongate, recall spell, GM `summon_actor`) flow through the verb dispatcher and are server-authoritative — they emit a server-issued position update, not a client movement update. The movement validator distinguishes the two by source.

---

## 7. Combat Validation

| Check | Authority |
|---|---|
| Hit detection | Server-side per Doc #22 §8; client cannot claim hits |
| Damage calculation | Server-side, using server's authoritative stat block |
| Critical-hit RNG | Server-side; PRNG seed per-Avatar per-shard, never exposed to client |
| Attack rate | Per-verb rate limit (§4): `attack` capped at 2/s |
| Position-of-attacker | Validated against position-of-target on every attack invocation (range + LOS, §3) |
| Targeting | Server resolves target entity_id; client may submit a target hint, but server overrides with authoritative resolution |

Client receives the resolved damage / hit result as a replicated state delta; it never computes the outcome.

---

## 8. Inventory & Economy Validation

| Concern | Mechanism |
|---|---|
| Trade | Two-phase commit per Doc #18 §9; atomic — no partial state visible to either party |
| Item duplication | Every Entity has a unique `entity_id` (Doc #13); container moves are id-based, not template-based; duplicate id detection at write time (`UNIQUE` constraint, Doc #21) |
| Currency operations | Transactional via Doc #21 atomic-write contract; no read-modify-write outside a transaction |
| Crafting yield anomaly | Suspicious pattern: rapid creation of high-value items via crafting verb sequence flagged for review (Doc #28 §7 anomaly detector) |
| Container ownership | Server validates actor has access (open, owns, or is in same scene grant) before any container mutation |
| Vendor/merchant flow | Two-phase: reserve gold → grant item → debit gold; reservation released on failure |

---

## 9. UGC Sandbox Security

Extends Doc #19 §5. Resolves Doc #19 §14 [OPEN] item 1 (Lua VM choice).

| Decision | Choice | Rationale |
|---|---|---|
| Lua VM | **Vanilla Lua 5.4** (resolved) | Smaller attack surface than LuaJIT; JIT compilers are historically a richer source of escape vulnerabilities (e.g., trace compiler bugs, FFI). Performance gap acceptable given Doc #19 §7 budget caps |
| Execution isolation | Each script in isolated OS thread with strict memory cap per Doc #19 §7 budget; CPU-time slice via instruction-count hook |
| API surface | Strict allowlist (verb dispatch shims + read-only world inspection); blacklist of `io`, `os`, `require`, `loadstring` / `load`, `dofile`, `loadfile`, `package`, raw `coroutine.yield` indefinitely, debug library, `string.dump`, `getmetatable` on protected tables |
| VM teardown | Periodic recreate every 1000 verb invocations per script context to defeat slow-leak / accumulation exploits |
| VM crash | Script paused, error logged, sandbox level downgraded to lowest tier pending human review (Doc #19 §3 levels) |
| Egress | No network calls, no filesystem, no FFI, no access to other players' data without explicit permission grant from data owner |
| Bytecode loading | Forbidden — only source-text scripts accepted; bytecode is a known Lua VM attack vector |
| Resource limits | Per-script: 8 MB RAM, 50 ms wall-clock per invocation, 1 M instructions per invocation (overrides per Doc #19 §7) |
| Audit | Third-party security audit prior to opening UGC publishing to public ([OPEN] cadence — §19) |

---

## 10. Account Security

| Aspect | Spec |
|---|---|
| Authentication | OAuth 2.0 (authorization code flow with PKCE) + optional 2FA via TOTP |
| 2FA enforcement | Required for `admin.*` and `gm.host` tiers; optional for player tiers (recommended via UX nudge) |
| Session token lifetime | 1 hour access token; 30-day refresh token |
| Refresh constraint | Refresh requires same `/24` IP class **or** step-up re-auth (password + 2FA) |
| Password policy | Minimum 12 chars; breach-checked via Have-I-Been-Pwned k-anon API at registration and again monthly for active accounts |
| Account lockout | 5 failed login attempts in 15 min → 15 min lockout + email alert with IP/UA |
| Concurrent session limit | 3 per account; new login displaces oldest, with notification email + in-game alert on next login |
| Email change | Requires confirmation from old + new email; 7-day reversal window |
| Recovery codes | 10 single-use codes generated at 2FA enrollment; user prompted to download |

---

## 11. MCP Security Model

Extends Doc #14 + Doc #25 T-13-13.

| Transport | Trust Model | Auth |
|---|---|---|
| stdio | Trusted (local dev environment assumed) | None |
| SSE | Untrusted | Bearer token via separate auth service; token scoped to capability tier |
| HTTP | Untrusted | Bearer token; same as SSE |

Constraints:
- MCP session-to-Avatar binding is **immutable** for session lifetime (Doc #14 §4 invariant 4).
- Token revocation propagates to all running MCP sessions within 60 s (push from auth service to MCP server fleet).
- MCP rate limits per §4 (`gm.host`, `ugc.author`, `admin.*` budgets).
- Suspicious pattern: MCP session invoking verbs at human-impossible rates (e.g., `attack` near per-verb cap continuously for >60 s) → flag, possibly auto-revoke pending review.
- All MCP session opens and closes logged in `admin_audit_log` (Doc #29) with: session_id, capability tier, transport, source IP, timestamp.
- MCP capability escalation (e.g., upgrading from `gm.host` to `admin.gm`) requires re-auth — cannot escalate within an existing session.

---

## 12. Bot Detection

| Signal | Method |
|---|---|
| Pause distribution | Humans pause irregularly (think, glance, talk); bots produce flat-tail distributions. Compare per-actor inter-action interval distribution to human baseline (Doc #28 §7) |
| Click heatmap | Verb-target spatial distribution; bots cluster on grid centers, humans drift |
| Verb timing entropy | Shannon entropy of inter-verb intervals; below threshold → likely automated |
| CAPTCHA gates | Account creation, first UGC publish, large trade (>1000 gp value or rare-tier item) |
| Crowd-sourced reporting | `flag_event_for_review` (Doc #28) accumulates community signal |
| Confirmed bot action | Account-wide ban, items deleted server-side, UGC takedown if applicable, IP/device fingerprint added to denylist |

False-positive control: bot-detection verdicts route through Doc #29 moderation queue for human review before account-level enforcement; only throttle and CAPTCHA gating are automated.

---

## 13. DDoS Mitigation

| Layer | Mechanism |
|---|---|
| Edge | Cloud DDoS protection (CloudFlare or equivalent) at TCP/UDP layer; volumetric absorption |
| Routing | Anycast routing for game server endpoints; spreads attack across PoPs |
| L7 rate limit | Per-source-IP application-layer rate limit at load balancer; overflow → drop |
| Connection cap | Maximum 5 concurrent connections per source IP (legitimate household / dorm capped; rare false-positive accepted vs. bot pool size) |
| Slow-loris defense | Read/write timeouts on all sockets; idle connections reaped at 30 s |
| TLS handshake limit | Max handshakes per IP per minute to defend against handshake-flood |

---

## 14. Save File Integrity

| Concern | Mechanism |
|---|---|
| Local save signing | SQLite save (Doc #21) signed with per-Avatar Ed25519 key on save commit; signature stored in `save_meta` row |
| Load verification | Signature verified on load; tampered save → refuse load + telemetry alert + offer recovery from last server-side checkpoint |
| Cross-shard import | Single-player save → persistent shard requires server-side validation pass: stat caps, inventory legality, item provenance check (every item id must be reachable from a legitimate creation event), Virtue history sanity |
| Key custody | Per-Avatar key sealed by account-derived KEK; KEK derivation from password + per-account salt (server stores salt only, never KEK) |
| Backup integrity | Server-side checkpoints (Doc #21) signed by server-held key; tamper-evident |

---

## 15. Virtue Laundering Detection

Defends against coordinated evasion of Virtue Watch (Doc #5).

| Signal | Detection |
|---|---|
| Coordinated micro-loss | Multiple Avatars committing small Virtue-loss acts in patterns that stay below per-Avatar thresholds; cross-actor correlation in telemetry (Doc #28 §7) |
| Wronged-by graph | Network analysis of who-wronged-whom edges; detect dense subgraphs (collusion clusters) |
| Cross-shard pattern | Same player operating multiple Avatars across shards repeating the same evasion pattern |
| Moderation output | Detector emits a moderation queue ticket (Doc #29) with pattern visualization (graph render of cluster + timeline of acts) |
| Action | Human moderator reviews; confirmed laundering → Watch escalation across all involved Avatars |

---

## 16. Disclosure & Bug Bounty

| Aspect | Spec |
|---|---|
| Public bug bounty | Yes; rewards scaled to severity (Critical / High / Medium / Low) per industry table |
| Coordinated disclosure | 90-day default before public disclosure; extension by mutual agreement |
| Hall of Fame | White-hat reporters credited in-game (cosmetic banner / title) and in published changelog |
| Out-of-scope | Social engineering of staff; physical attacks; testing on production accounts other than reporter's own |
| In-scope | Game client, server endpoints, MCP surface, UGC sandbox, save format, account auth |
| Vendor | [OPEN] §19 |

---

## 17. MCP Additions to Doc #14

### Tools

| Tool | Capability | Description |
|---|---|---|
| `revoke_mcp_session(session_id)` | `admin.engineer`+ | Force-close an MCP session and invalidate its token |
| `add_rate_limit_override(actor_id, override)` | `admin.gm`+ | Apply a per-actor rate-limit override (raise or lower) with TTL |
| `clear_rate_limit_override(actor_id)` | `admin.gm`+ | Remove an active override |
| `flag_actor_for_review(actor_id, reason)` | `admin.engineer`+ | Manually escalate to moderation queue (Doc #29) |

### Resources

| Resource URI | Capability | Content |
|---|---|---|
| `forge://admin/security/active_sessions` | `admin.engineer`+ | All active sessions: id, account, tier, transport, source IP, age |
| `forge://admin/security/recent_violations` | `admin.engineer`+ | Last N rate-limit / movement / replay violations with actor, type, timestamp |
| `forge://admin/security/rate_limit_table` | `admin.gm`+ | Current effective rate-limit configuration including overrides |
| `forge://admin/security/replay_window/{session_id}` | `admin.engineer`+ | Replay-detection bitset state for forensics |

---

## 18. Phase 1 Prototype Scope

Single-player vertical slice (Doc #11) is the Phase 1 deliverable; persistent multiplayer is Phase 2. Anti-cheat is a Phase 2 hardening priority gating multiplayer launch.

| Component | Phase 1 | Phase 2 |
|---|---|---|
| Validation contracts (§3) | Hooks scaffolded; only `range`, `LOS`, `capability` actively enforced | All checks enforced including rate, resource, sanity |
| Rate limits (§4) | Not enforced (single-player) | Full enforcement |
| TLS / HMAC (§5) | TLS only (no HMAC needed for local stdio MCP) | TLS 1.3 + HMAC + sequence numbers |
| Movement validation (§6) | Snap-back on impossible moves; no flagging | Full ladder including ban consideration |
| Combat validation (§7) | Server-authoritative resolution (Doc #22 §8) | Adds rate enforcement + behavioral analysis |
| Lua sandbox (§9) | Not in Phase 1 (Doc #19 §13 deferred Lua entirely) | Full sandbox with VM teardown + audit |
| 2FA (§10) | Not in Phase 1 (no real accounts) | Full implementation |
| MCP security (§11) | stdio only, trusted dev | SSE/HTTP with bearer tokens |
| Bot detection (§12) | None | Behavioral + CAPTCHA + crowd-source |
| DDoS mitigation (§13) | None | Edge + L7 + connection caps |
| Save signing (§14) | Deferred (single-player local saves trusted in dev) | Per-Avatar Ed25519 signing |
| Virtue laundering (§15) | Not applicable (no multi-actor collusion) | Cross-actor correlation + graph analysis |
| Bug bounty (§16) | Internal only | Public program |

---

## 19. Open Questions

- `[OPEN]` Bug bounty platform vendor — HackerOne vs. Bugcrowd vs. self-hosted (cost vs. control trade-off).
- `[OPEN]` 2FA enforcement timeline for existing player accounts — opt-in indefinitely vs. forced enrollment date; if forced, what grace period and what fallback for users who lose their device.
- `[OPEN]` UGC code sandbox third-party security audit cadence — annual vs. per-major-release vs. continuous via retainer.
- `[OPEN]` How to handle accusation-vs-proof asymmetry in moderation (Doc #29 territory but security-adjacent) — burden of evidence, appeals process, false-accusation penalties.
- `[OPEN]` Whether to publicly document anti-cheat detection methods — security-through-obscurity buys time but undermines researcher engagement; transparency invites adversarial improvement but enables community trust.
- `[OPEN]` Encryption-at-rest key custody — managed KMS (cloud-provider) vs. dedicated HSM vs. hybrid; also flagged in Doc #21 §15.
- `[OPEN]` Legal handling of persistent ban evasion — jurisdiction-dependent; CFAA-style remedies in US, varying elsewhere; need counsel input before policy.
- `[OPEN]` Whether to expose `forge://admin/security/recent_violations` in real-time stream form (SSE) or polled snapshot only — real-time is operationally useful but increases attack surface if creds leak.

---

End Document #32.
