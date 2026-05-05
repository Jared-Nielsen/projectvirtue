# 37 — Voice Chat

**Updated 2026-05-04 per Doc #41.** Voice chat architecture is finalized: Rust server handles signaling/permissions/moderation buffer; LiveKit (managed or self-hosted) handles the SFU/media layer; UE5 client and TS web client handle audio I/O. Building an in-house SFU is a forbidden path per Doc #41 §third-party-services; sections below that previously surveyed in-house alternatives are retained for historical context but the chosen architecture is the three-layer split.

Project Title: Ultima VII: Project Virtue
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Network & Live Ops Engineering Lead, with Trust-and-Safety review]
Status: Living Technical Reference — Normative spec for player-to-player voice chat: party voice, guild voice, proximity voice, raid leadership, and hosted GM sessions. Picks up the thread deferred from Doc #27 §7 (Avatar voice — "player-to-player voice chat is a separate Phase 3+ system, out of this doc's scope") and Doc #22 §16 [OPEN] item 1 (NAT traversal for client peer-to-peer audio chat). Resolves both. Cross-ref: **Doc #41 (Engine & Stack ADR)**.

Depends on: #6 Persistent World §2 §4 (party / friends / global chat split), #10 Art & Audio Style Bible §5 (audio aesthetics — voice chat must not collide with the soundtrack mix), #14 MCP Server Surface §3 (capability tiers), #22 Network Protocol & Replication §2 (topology), §3 (tick rates), §4 (event channel), §16 item 1 (P2P NAT traversal [OPEN] — resolved here), #26 Long-range Arcs & Hosted GM Sessions §5 §12 (hosted-session voice surface), #27 Audio System §1 (sound-as-simulation), §3 (propagation model — proximity voice attenuates on the same physical model), §7 (Avatar voice — silent-protagonist tradition; this doc handles **player-to-player**, not Avatar VO), §8 (audio replication shape), §9 (accessibility hooks), #29 Moderation & Admin Tools §3 (queue), §11 (anti-cheat hooks), #32 Anti-cheat & Security Hardening §5 (packet integrity), §10 (account security), §11 (MCP security model), #33 Localization & i18n (transcription locales), #34 Accessibility Standards §4 (auditory accessibility — voice-chat transcription called out at Phase 3+; this doc delivers it), #38 Privacy & Data Governance (GDPR / COPPA — pending; cross-references throughout).

Source heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[BR]` = original to Project Virtue. Voice chat is wholly `[BR]` — neither original game shipped with player voice; the design challenge is to introduce a 21st-century social layer without breaking the single-player feel of Britannia.

---

## 1. Voice Chat Philosophy

Voice chat is **opt-in, ephemeral by default, and never the only channel.** Every voice room has a parallel text fallback (Doc #6 §4 chat layer). Every voice transmission is consensual on both sides — nobody is forced to listen and nobody is recorded surreptitiously. Proximity voice in the open world participates in the same propagation model as in-world SFX (Doc #27 §3): a whisper in a tavern does not reach the city gates. This is the `[BR]` extension of the Doc #27 §1 "sound is part of the simulation, not a presentation layer" principle — player voice is part of the simulation too, attenuated by the same walls and distances that dampen footsteps.

The voice system is built to be **gracefully degradable** (§13). When voice infrastructure is unavailable — backend outage, regional regulation forbids it, the player's connection is too poor — the experience continues over text without breaking gameplay. Voice is enrichment, never gating.

The system is also built to be **moderatable** (§7) without being **surveillance-oriented** (§8). Recordings exist only as short rolling buffers tied to a report event; they are not corpus-mined, not used for training, and not retained beyond the moderation window.

---

## 2. Use Cases & Voice Channel Model

Five canonical voice surfaces, each with distinct lifecycle, membership, and propagation rules.

### 2.1 Channel taxonomy

```ts
type VoiceChannelKind =
  | "Party"            // ephemeral; lifetime = party lifetime; up to 8 members
  | "Guild"            // persistent; per-guild rooms, optionally multiple sub-rooms
  | "Proximity"        // spatial; world-position-keyed; no fixed membership
  | "Raid"             // ephemeral; raid leader broadcast + raid-wide listen-only mode
  | "GMSession"        // ephemeral; tied to a Doc #26 hosted-session pocket realm
  | "Private"          // 1:1 direct; friend-list-gated; ephemeral

type VoiceChannel = {
  channel_id:        UUID
  kind:              VoiceChannelKind
  shard_id:          ShardId
  region_id:         RegionId | null      // null for cross-region channels (Guild, Private)
  members:           VoiceMembership[]
  permissions:       ChannelPermissions   // §5
  spatial_origin:    Vec3 | null          // only for Proximity; null otherwise
  spatial_radius:    f32 | null           // tiles; only for Proximity (default per §2.4)
  age_gate:          AgeGate              // §11.4
  created_at:        ServerTick
  expires_at:        ServerTick | null    // null = persistent
  recording_buffer:  RingBuffer | null    // §7.2; only if any member has reporting active
}

type VoiceMembership = {
  avatar_id:         AvatarId
  joined_at:         ServerTick
  role:              "owner" | "moderator" | "speaker" | "listener"
  mic_state:         "open" | "ptt_held" | "ptt_idle" | "muted_self" | "muted_room"
  deafen_state:      "hearing" | "deafened_self" | "deafened_room"
  speaking_now:      bool                  // VAD-driven; replicated for HUD speaker indicator
  jitter_buffer_ms:  int                   // per-listener client-side; default 60
}
```

### 2.2 Use case → channel kind mapping

| Use case | Channel kind | Membership rule | Lifetime | Persistence |
|---|---|---|---|---|
| Party voice — Avatar's adventuring party (Doc #15 §8 companion roster) | `Party` | Auto-join on party formation; auto-leave on party dissolution | Party-bound | Ephemeral; auto-destroyed when party drops below 2 humans |
| Guild voice — player guild halls and meeting rooms (Doc #6 §4 long-form social) | `Guild` | Auto-join on guild login; multiple named sub-rooms ("officers", "raid-prep", "tavern") | Guild-bound | Persistent; rooms exist while guild exists; member presence ephemeral |
| Proximity voice — talking to whoever is nearby in-world (replaces tavern shout-text) | `Proximity` | Implicit; any Avatar in audible radius is a member | Per-tick; the channel is conceptual, computed continuously | Ephemeral; never instantiated as a discrete object |
| Raid leadership — large coordinated combat group (>8) with a designated leader's voice broadcast | `Raid` | Leader speaks; opt-in listeners (raid roster) hear; secondary speakers via permission grant | Raid-encounter-bound | Ephemeral; auto-destroyed at raid end or 30 min inactivity |
| Hosted GM sessions — narrated DM-led adventures (Doc #26) | `GMSession` | Tied to the session's pocket realm; participants on join, GM as host | Session-bound | Ephemeral; destroyed at session close (Doc #26 §12) |
| Private 1:1 — DM-style voice between two friends | `Private` | Both parties on each other's friend-list (Doc #22 §15); explicit invite + accept | Manual | Ephemeral; destroyed on either party hangup or disconnect (>60 s) |

### 2.3 Party voice (ephemeral)

The party voice channel is created automatically when:

1. A party transitions from 1 human to 2+ humans (Doc #15 §8 companion-vs-human distinction — companions never join voice, even if they have VO in Doc #27 §6.4).
2. Any member's `voice_settings.party_voice_enabled` is `true` (account default opt-in is `false` per §8.2).

Membership tracks the party's `party_id` (Doc #15 §8). Members hear each other regardless of in-world distance — party voice is not spatial. Auto-destroyed when the party drops to 1 human or all humans have `party_voice_enabled = false`. A re-formed party reuses a fresh `channel_id`; channels are not memoized across party dissolutions.

### 2.4 Proximity voice (spatial)

The headline `[BR]` feature. Player voice is treated as a `SoundEvent` (Doc #27 §2) with `sound_type = "PlayerVoice"` and falloff identical to the audibility model of Doc #27 §3.

```ts
// Extension to Doc #27 §2 SoundType enum
type SoundType =
  | ... existing types ...
  | "PlayerVoice"         // [BR] new; default radius 12 tiles, partial muffle through walls

// Extension to Doc #27 §4 Sound Types table
| Type        | Default radius (tiles) | Wall attenuation | Notes |
|---|---|---|---|
| PlayerVoice | 12                     | partial muffle (12 dB) | Uses §3.2 terrain attenuation; whisper-mode 4 tiles full block; shout-mode 24 tiles partial muffle |
```

Three loudness modes the speaker selects:

| Mode | Default radius | Wall behavior | Stealth modifier? |
|---|---|---|---|
| `whisper` | 4 tiles | full block | Yes — DEX + Stealth skill apply (Doc #27 §3.3) |
| `normal` | 12 tiles | partial muffle (12 dB) | No |
| `shout` | 24 tiles | partial muffle | No; emits `Awareness` to NPCs in radius (§2.4.1) |

#### 2.4.1 NPCs hear player voice

Per Doc #27 §3.4, audible-volume thresholds drive NPC reaction. Player voice is no exception: a player **shouting** in a populated district produces an `Awareness` event to NPCs in radius. Default reaction:

| Audible volume | NPC default reaction |
|---|---|
| < 20 dB (most whispers, distant normal voice) | Ignored |
| 20–60 dB (nearby normal voice) | Curiosity: NPC `Look` toward source; merchants may surface a "you got my attention" line |
| > 60 dB (close-range shout) | Schedule interrupt: guards investigate; sleeping NPCs wake; hostile NPCs may engage if shout occurs in a hostile-faction zone |

Voice content is **not** parsed by NPCs — there is no speech-to-action pipeline. Volume alone drives awareness. The speech-to-text path (§9.1) is for accessibility and moderation, never for AI input. This is a deliberate simplification: NPCs respond to the *fact* of a shout, not its content.

#### 2.4.2 Spatial rendering on the listener

Listener client renders proximity voice with the same HRTF + distance-attenuation pipeline as Doc #27 §8.2. A player speaking in the next room is muffled by the wall, panned to the correct bearing, attenuated by distance. Reverb-zone (Doc #27 §8.2) applies — voice in a cathedral has cathedral reverb. The voice stream is mixed against the SFX bus, **not** the music bus, so per-channel volume control (Doc #27 §9) governs voice independently of music.

### 2.5 Guild voice (persistent rooms)

Guilds (player organizations, Doc #6 §4 cross-references; full guild spec is `[OPEN]` for a future doc) have voice rooms attached:

- A guild has 1 default room ("hall") and up to 8 named sub-rooms ("officers", "raid-prep", "lore-club", etc.).
- Rooms are persistent: the room's `channel_id` survives across logins; members hear whoever else is currently present.
- Per-room permission lists (`speakers`, `listeners`, `moderators`) gate access. Officers default to moderator on the "officers" room; rank-based defaults are set when the room is created.
- A guild member walking around the world remains in their last-active guild voice room across region handoffs (§3.5) unless they explicitly leave.

### 2.6 Raid leadership

Above the 8-member party cap (Doc #15 §8) but below a guild, raids are a temporary structure: 8–40 Avatars working a single encounter.

```ts
type RaidVoiceConfig = {
  raid_id:           UUID
  leader_avatar_id:  AvatarId
  speakers:          AvatarId[]          // up to 4 designated; leader is implicit
  listener_mode:     "broadcast" | "open" | "ptt_only"
  raid_size_cap:     int                 // default 40
}
```

| Mode | Behavior |
|---|---|
| `broadcast` | Only `speakers` are audible; raid members are listeners. Calmer mix; recommended default for combat |
| `open` | All raid members can speak (subject to PTT/VAD). Useful for pre-pull discussion |
| `ptt_only` | All speech is push-to-talk; open mics auto-mute. Good for very large raids on shared servers |

The leader can hot-swap modes via a raid-config UI. Auto-destroy: 30 min after last spoken word, or when the raid is dissolved.

### 2.7 GM-session voice (Doc #26 integration)

Hosted GM sessions (Doc #26 §5 pocket realms, §12 session audit) get a single voice channel scoped to the session's participant set. The GM has `owner` role; participants have `speaker` role; no one can join who is not in the Doc #26 session participant list. Tied to the session lifetime — closes when the session closes (Doc #26 §12). Recording behavior follows §7 with one addition: **GM sessions may opt into full-session recording** (§7.4) for narrative-replay purposes, but this requires explicit opt-in from every participant at join time, not just the GM.

### 2.8 Private 1:1

The friend-list-gated voice channel (Doc #22 §15 friends-list semantics carry over). Either friend can initiate; the other can accept, decline, or set themselves to "do not disturb." Auto-destroyed on hangup or 60 s of mutual silence.

---

## 3. Architecture

### 3.0 Finalized three-layer architecture (per Doc #41)

Per Doc #41, voice chat is a **three-layer split** with strict ownership boundaries:

| Layer | Owner | Responsibility |
|---|---|---|
| **Signaling / permissions / moderation buffer** | **Rust server** (authoritative) | Channel create/join/leave, room membership, role/permission enforcement (§5), age-gate checks (§11.4), rolling-buffer capture for moderation (§7.2), `voice_report` ticket creation, admin listen-in audit (§5.4, §8.5), all MCP voice tools (§12). Issues short-lived LiveKit access tokens. |
| **SFU / media plane** | **LiveKit** (managed or self-hosted) | Per-speaker stream forwarding, SRTP, jitter buffer, FEC, active-speaker fan-out cap, ICE/STUN/TURN, codec offer/answer (Opus). The Rust server never touches RTP packets in the default forwarding path. |
| **Audio I/O** | **UE5 client** (production) and **TS / PixiJS web client** (prototype) | Mic capture, AEC/AGC/RNNoise, VAD, PTT bindings, Opus encode/decode, HRTF + spatial render (§2.4.2), playback, voice-bus mix, captions overlay (§9.1). |

Building an in-house SFU is **forbidden** per Doc #41 §third-party-services. Subsections §3.1–§3.3 below are retained as historical context for *why* an SFU (vs. P2P or MCU) and *why* WebRTC/Opus — but the SFU implementation is LiveKit, not custom code. The Rust signaling layer speaks the LiveKit server-API; clients speak the LiveKit client SDK over WebRTC.

### 3.1 Why a Selective Forwarding Unit (SFU) and not P2P

| Architecture | Pros | Cons | Verdict |
|---|---|---|---|
| Pure peer-to-peer (mesh) | Lowest server cost; lowest latency between two close peers | Bandwidth scales O(n²) per peer; NAT traversal failures common; no server-side recording for moderation; easily defeated by symmetric NAT and corporate firewalls | Rejected for default path; preserved as opportunistic fallback for 2-peer Private rooms only (§3.4) |
| Mixer (MCU — Multipoint Conferencing Unit) | Single server-mixed stream per listener; lowest client decode cost | High server CPU; loss of per-speaker spatial control (HRTF cannot be applied client-side because streams are pre-mixed); recording is one-mix-per-room which loses per-speaker forensics | Rejected; we need per-speaker streams for HRTF (§2.4.2) and per-speaker recording (§7.2) |
| Selective Forwarding Unit (SFU) | Server forwards each speaker's encoded stream individually to each subscriber; client mixes; per-speaker spatial audio possible; per-speaker recording trivial; bandwidth scales O(n) per peer not O(n²) | Higher server cost than P2P; complex routing logic; relay does not decrypt (with SFRTP) so server is not a content surveillance point | **Chosen as default. SFU implementation = LiveKit** (managed or self-hosted) per Doc #41; in-house SFU development is forbidden. LiveKit room is provisioned per region, co-resident or adjacent to the region GS process (Doc #22 §2). |

The SFU is a **LiveKit** deployment (managed cloud or self-hosted cluster) per Doc #41. Per region, a LiveKit room corresponds to the same region partition that the game-server process owns. The **Rust server** signals voice events (join, leave, mute, deafen, room create) by calling LiveKit's server API and issuing scoped access tokens to clients; **LiveKit** forwards media. This separation matches the Doc #22 §2 topology principle of co-locating compute with simulation locality, and keeps the SFU/media plane out of the Rust authoritative path.

### 3.2 Why WebRTC over custom UDP

| Option | Why considered | Why rejected (or accepted) |
|---|---|---|
| **WebRTC** | Mature stack; native browser support (Phase 3+ web client per Doc #11 deferred); battle-tested NAT traversal (ICE/STUN/TURN); SRTP/DTLS encryption baked in; Opus + VP8 standard; massive vendor ecosystem; built-in jitter buffer, FEC, redundant encoding | Accepted. **WebRTC is the wire stack** for voice |
| Custom UDP + Opus | Full control over packet format; can co-design with the Doc #22 §4 game protocol | Rejected — reinventing NAT traversal, congestion control, jitter buffer, and security is multi-year work for marginal gain over WebRTC; the few cases where the integration cost matters (server-mixed soundtrack ducking, §6.3) are addressable with WebRTC RTP header extensions |
| TCP (relayed) | Simplicity; zero firewall issues | Rejected for media — TCP head-of-line blocking destroys audio quality. TCP is acceptable as last-resort fallback (§3.4) but only as TURN-over-TCP transport |

WebRTC tradeoffs accepted: the codec offer/answer dance adds 100–300 ms to channel-join time; WebRTC's bundled feature set forces some Opus DSP decisions to happen client-side rather than server-side; and WebRTC's encryption (SRTP) is end-to-end-to-SFU, meaning the SFU can read packet headers but not media — this is actually a privacy win (§8.3).

### 3.3 Codec choice — Opus

| Setting | Value | Rationale |
|---|---|---|
| Codec | Opus | Industry standard for interactive voice; excellent quality across bitrate range; native WebRTC support |
| Sample rate | 48 kHz capture, 16 kHz internal voice mode | Opus internally adapts; 48 kHz is the WebRTC default and best for any voice that might overlap with music cues |
| Bitrate (steady) | 24 kbps mono | 8× lower than the 192 kbps "broadcast quality" target; appropriate for voice-only chat; matches Discord's default tier |
| Bitrate (low-bandwidth fallback) | 12 kbps mono | Triggered when client reports sustained packet loss > 5% or RTT > 250 ms |
| Bitrate (high-quality preset) | 48 kbps mono | Optional; used for streamers and high-end raid leaders; enabled per-channel by moderator |
| Frame size | 20 ms | Standard WebRTC; balance between latency and packet overhead |
| FEC | On at all bitrates | Inband FEC tolerates up to ~10% packet loss with minimal quality hit |
| DTX (discontinuous transmission) | On | Silence frames not transmitted; 60–80% bandwidth saving on a typical conversation |
| Encoding | Mono | Stereo offers no benefit for a single human voice; spatial positioning is applied client-side per §2.4.2 |

### 3.4 NAT traversal & fallback ladder

> **Resolves Doc #22 §16 [OPEN] item 1** (NAT traversal for client peer-to-peer audio chat).

WebRTC's ICE (Interactive Connectivity Establishment) handles the dance:

1. **ICE candidate gathering** — client probes local addresses and STUN servers for reflexive addresses.
2. **STUN servers** — operated alongside the SFU fleet; one per geographic edge (Doc #22 §2). Used to discover public-facing NAT mappings.
3. **TURN servers** — relay fallback for symmetric NAT and restrictive corporate firewalls. TURN-over-UDP preferred; TURN-over-TCP is the deepest fallback.
4. **Direct P2P** — for `Private` 1:1 rooms only, ICE may select a peer-reflexive candidate pair and bypass the SFU. This is the single P2P path; all other channel kinds always relay through SFU because they need server-side moderation hooks (§7) and because mesh-P2P is bandwidth-quadratic.

| Path | Latency target | When used |
|---|---|---|
| Direct P2P (private 1:1, ICE host candidate pair) | 30–80 ms | Both peers behind cone NAT or open; same metropolitan area |
| STUN-discovered P2P (private 1:1, server-reflexive) | 50–120 ms | One peer behind moderate NAT; same continent |
| SFU-relayed UDP | 80–180 ms | Default for all multi-party channels; symmetric NAT private 1:1 |
| TURN-over-UDP relay | 120–250 ms | Either peer behind firewall blocking SFU range |
| TURN-over-TCP relay | 200–500 ms | Corporate/enterprise firewall last-resort; expect quality degradation |

End-to-end mouth-to-ear latency budget at the SFU-relayed path: **< 200 ms** on regional traffic. Cross-continental relay (player in EU joining a raid hosted on NA shard) widens to < 350 ms; users with this profile are advised at channel-join time.

### 3.5 Voice across region handoffs

Voice channel persistence across Doc #22 §7 region handoffs is per-channel-kind:

| Channel kind | Handoff behavior |
|---|---|
| `Party` | Persists; party voice is region-agnostic; SFU-side membership unchanged |
| `Guild` | Persists; same SFU room; player just disconnects and reconnects voice transport |
| `Proximity` | Drops on region change; new proximity computation on arrival in target region. Mid-conversation cross-boundary speech is lost (~ 200 ms gap) |
| `Raid` | Persists; raid voice spans regions for the duration of the encounter |
| `GMSession` | Persists; GM sessions have their own pocket realm and don't traverse normal regions |
| `Private` | Persists; private 1:1 spans regions |

The SFU per region cooperates: when a player handoffs from `britain.0` to `trinsic`, the source SFU forwards the player's outbound stream to the target SFU via an internal mesh link, and the target SFU re-fans-out to subscribers. Net visible effect to the player: a 100–300 ms voice gap during the handoff transport switchover.

---

## 4. Push-to-Talk vs Open Mic

### 4.1 Modes

| Mode | Description | Use case default |
|---|---|---|
| `OpenMic` | Mic always live; speech transmitted whenever VAD detects voice | Private 1:1, small parties (≤ 4 humans) where the conversation is constant |
| `VAD` (open mic with voice activity detection) | Same as OpenMic, but local VAD (WebRTC built-in) gates transmission to suppress idle noise | Default for Party, Guild, GMSession |
| `PTT` (push-to-talk) | Speech transmitted only while a designated key/button is held | Default for Raid, Proximity (large rooms), any channel with > 8 active speakers |
| `PTT_AlwaysOff` | Mic hardware disabled at the OS level; user has chosen to never speak in this channel | Per-user preference, applies to specific channels |

### 4.2 Voice activity detection

Client-side, per WebRTC's built-in VAD plus a noise-suppressor (RNNoise or equivalent). Defaults:

| Parameter | Value |
|---|---|
| Activation threshold | -45 dBFS (configurable per user) |
| Hangover | 300 ms (continues transmitting briefly after speech stops to avoid clipping word tails) |
| Pre-roll | 100 ms (captures the start of speech that would otherwise miss the threshold ramp) |
| Noise suppressor | RNNoise; on by default; togglable per user |
| Echo cancellation | WebRTC AEC3; on by default |
| Auto gain control | On by default; togglable |

### 4.3 PTT bindings

Default PTT key is `V` on PC/Mac/Linux (configurable per Doc #34 §5 keyboard remap). On gamepads, a chord (LB+RS or platform equivalent) per the platform's voice-chat conventions. Mobile (§10.4) uses a hold-to-talk on-screen button.

### 4.4 Mode auto-selection

When a player joins a channel, mode follows the channel's default unless the player has overridden globally. Channel moderators may *force* PTT for a channel (the "PTT-only mode" in §2.6 Raid table) — this overrides per-user preference.

---

## 5. Permissions Model

### 5.1 Roles per channel

```ts
type ChannelRole = "owner" | "moderator" | "speaker" | "listener" | "banned"

type ChannelPermissions = {
  who_can_join:        "anyone" | "invite_only" | "friends_of_owner" | "guild_member" | "raid_member"
  who_can_speak:       "everyone" | "speakers_and_above" | "moderators_and_above" | "owner_only"
  ptt_required:        bool
  age_gate:            AgeGate                         // §11.4
  recording_buffer_on: bool                            // §7.2 default by channel kind
  max_members:         int
  language_pref:       string | null                   // hint only; not enforced
}
```

### 5.2 Self controls (always available to every member)

| Action | Effect | Scope |
|---|---|---|
| `mute_self` | Mic transmission stopped; others see "muted" indicator | Per-channel or all channels |
| `mute_others` (per peer) | Suppress one specific speaker on this listener only; speaker is unaware | Per-listener |
| `deafen_self` | Stop receiving any audio from any speaker in the channel; others see "deafened" indicator | Per-channel or all channels |
| `volume_self` (per peer) | Per-peer volume slider on the listener's mixer | Per-listener |
| `leave` | Exit the channel | Per-channel |
| `block` | Add the speaker to a personal block-list — mutes their voice in every shared channel forever and prevents future invites | Account-wide |

### 5.3 Moderator controls

| Action | Effect | Capability |
|---|---|---|
| `mute_other(avatar_id)` | Force-mute a member room-wide; the muted member sees a "muted by moderator" indicator | `moderator` role on the channel |
| `kick_other(avatar_id)` | Eject from channel; member can rejoin unless also banned | `moderator` |
| `ban_other(avatar_id, duration)` | Eject and prevent rejoin for `duration` (1h / 24h / 7d / forever) | `moderator` |
| `set_mode(mode)` | Switch channel mode (open mic / VAD / PTT) | `moderator` (Raid leader is a `moderator` on the raid channel) |
| `transfer_ownership(avatar_id)` | Transfer `owner` role | `owner` only |
| `lock` | No new joins | `moderator` |

### 5.4 Admin overrides

Per Doc #29 §7 (live in-game intervention), `admin.gm` capability adds:

| Tool | Capability | Effect | Audit |
|---|---|---|---|
| `voice_listen_in(channel_id, reason)` | `admin.gm` | Joins the channel as an invisible listener (no audible presence; not in member list to non-admins). Used only when investigating an active P0 ticket. Both audible and visible presence policies follow §8.5. | `admin_audit_log` (Doc #29 §9); requires reason field |
| `voice_force_mute(avatar_id, duration, reason)` | `admin.gm` | Server-wide mute on this Avatar; applies to every voice channel they join | `admin_audit_log`; subject of an enforcement appeal (Doc #29 §12) |
| `voice_force_dissolve(channel_id, reason)` | `admin.gm` | Force-close a channel; all members ejected | `admin_audit_log`; mandatory reason |
| `voice_export_buffer(channel_id, ticket_id)` | `admin.gm` | Pulls the §7.2 rolling buffer for an active ticket | `admin_audit_log`; ticket-bound; auto-redacts non-subjects per §8.4 |

`admin.gm` voice-listen-in is **not silent and unconditional** — see §8.5 for the visible-on-listening policy default and shard-config exception.

---

## 6. Performance Budget

### 6.1 Bandwidth per player

| Path | Outbound (speaking) | Inbound (per active speaker heard) | Notes |
|---|---|---|---|
| Steady (Opus 24 kbps + RTP overhead ~5 kbps) | ~3.6 KB/s | ~3.6 KB/s × N speakers heard | Encoder packet overhead included |
| With FEC (10% loss tolerance) | ~4.0 KB/s | ~4.0 KB/s × N | FEC packets are small redundancy frames |
| DTX silence | < 0.1 KB/s | n/a | When not speaking |
| Low-bandwidth fallback (12 kbps) | ~1.8 KB/s | ~1.8 KB/s × N | Triggered automatically per §3.3 |

**Per-player aggregate budget:** outbound ≤ 5 KB/s steady. Inbound depends on hearable speaker count, capped per channel:

| Channel | Max simultaneous active speakers | Listener inbound steady |
|---|---|---|
| Party (8 max) | 4 (rare; usually 1–2) | ~14 KB/s peak; ~4 KB/s typical |
| Guild room (variable) | 6 (SFU caps active-speaker fan-out at 6) | ~22 KB/s peak |
| Proximity (up to 30 in radius in a city square) | 6 (SFU caps; loudest 6 are forwarded; remainder muted on the relay until a slot opens) | ~22 KB/s peak |
| Raid (40 max) | 4 designated speakers in `broadcast` mode | ~14 KB/s peak |
| GM session (variable) | 8 (full participants speakable) | ~28 KB/s peak |
| Private 1:1 | 1 | ~4 KB/s |

Voice traffic is independent of and additive to the Doc #22 §5.5 game-state budget (10 KB/s steady, 50 KB/s burst). Combined per-client budget therefore tops out at ~70 KB/s peak (game state burst + GM-session voice peak), which fits a 1 Mbps downstream comfortably.

### 6.2 Server cost & scaling

SFU resource model:

| Resource | Per-active-stream cost | Per-region SFU at 200-player cap |
|---|---|---|
| CPU (forwarding, SRTP unwrap/rewrap) | ~0.2% of one core per active stream | ~6 cores at full load (assume average 3 active speakers per region) |
| RAM | ~2 MB per peer connection | ~400 MB |
| Bandwidth (egress) | ~25 KB/s per active speaker × subscriber count | Worst case 200 players × 6 streams × 4 KB/s = ~5 MB/s sustained per region SFU |

A single mid-range cloud instance (8 vCPU, 16 GB RAM, 1 Gbps NIC) handles 1 region SFU at full Doc #22 §13 200-player cap with comfortable headroom.

| Scale point | Bandwidth | CPU | Action |
|---|---|---|---|
| Region SFU > 70% utilization for 10 min | 3.5 MB/s sustained | 5.6 cores | Spawn parallel instance per Doc #22 §6 (`britain.0` → `britain.1` voice cohort split) |
| Region SFU > 90% utilization | 4.5 MB/s | 7.2 cores | Force-degrade: drop active-speaker fan-out cap from 6 to 4; surface "voice traffic high — quality reduced" notice to channel owners |
| Edge TURN > 60% bandwidth | depends | n/a | Add TURN capacity at edge; this is the most-likely scaling pinch in restrictive-NAT geographies |

### 6.3 Voice-vs-music ducking

Per Doc #27 §5 dynamic music: when a known speaker's voice is active in a player's mix, the local client applies a soft duck (-6 dB) to music and ambient stems for the duration of the voice utterance plus 200 ms hangover. This is a client-side mixer rule, not a server signal — every client computes it from its own subscribed-speaker set. The duck depth is configurable per Doc #27 §9 accessibility volume controls.

---

## 7. Moderation

### 7.1 Real-time abuse reporting

Every voice channel exposes a `/voice_report` verb (and a UI button next to each speaker) that:

1. Captures the **last 30 s** of inbound audio for the reported speaker from the listener's perspective (the §7.2 rolling buffer).
2. Captures the **next 30 s** of inbound audio after the report fires (a forward-look window).
3. Optionally captures the listener's own perspective for context (off by default; opt-in per report).
4. Bundles into a `PlayerReport`-kind ticket on the Doc #29 §3 moderation queue with `subject_kind = "Avatar"`, `subject_id = reported_avatar_id`, and the audio bundle as evidence.

```ts
// ClientMessage extension to Doc #22 §4.2
| { kind: "VoiceReport",
    invocation_id: UUID,
    channel_id: UUID,
    reported_avatar_id: AvatarId,
    reason_code: VoiceReportReason,
    free_text?: string,
    capture_listener_perspective?: bool   // default false
  }

type VoiceReportReason =
  | "harassment" | "hate_speech" | "threats" | "doxxing"
  | "sexual_content" | "csam"        // csam auto-routes to admin.root per Doc #29 §4
  | "spam_or_disruption" | "voice_changer_evasion"
  | "child_predatory_behavior" | "other_with_text"
```

### 7.2 Recording-on-report rolling buffer

The SFU keeps a per-speaker rolling buffer for moderation:

| Property | Value |
|---|---|
| Buffer length per speaker | 30 s (rolling — overwritten continuously) |
| Storage | RAM only (encrypted at rest in process memory; AES-256-GCM with per-process key rotated hourly) |
| Trigger to materialize | `VoiceReport` arrival (the 30 s before + 30 s after capture) |
| Materialized form | Opus-encoded segments + RTP timing metadata, packaged into a `VoiceEvidence` blob |
| Materialized storage | Encrypted (AES-256-GCM with per-ticket key) on the Doc #21 evidence-blob bucket; key escrowed in the moderation key vault accessible only to `admin.gm`+ |
| Retention | 90 days from ticket creation, then auto-deleted unless legal hold or active appeal |
| Default state | Buffer **active** for every speaker by default — no opt-out. This is required for the recording-on-report feature to function. Users are notified at first voice join (§8.2) that the rolling buffer exists. |

The rolling buffer is **not** a recording in any user-facing sense: it is never accessible to anyone (including admins) absent a live report event. A ticket is the only path to materialization. No corpus mining, no training, no archival.

### 7.3 Automated transcription for review

When a `VoiceReport` materializes a `VoiceEvidence` blob, an automated speech-to-text pass runs on the bundle producing a transcript for the moderator's queue UI:

| Property | Value |
|---|---|
| Engine | Whisper-class open-source ASR; hosted on the moderation infrastructure (no third-party data egress) |
| Locales | Initial set: en, es, de, fr, ja, ko, zh-Hans, pt-BR. Phase 3 launch list per Doc #33; Phase 4 expansion per moderation needs |
| Confidence | Each token has a confidence score; low-confidence tokens flagged in UI |
| Speaker diarization | On for multi-speaker bundles (e.g., proximity buffers) — labels turns; speaker identity only when the speaker is the report subject (other-perspective speakers are labeled `Speaker A`, `Speaker B` and not name-attributed) |
| Storage | Same retention as the audio (90 days); accessible to the same capability tier (`admin.mod`) |
| Use | Moderator triage UI: scan transcript faster than listening; auto-flag harmful content via a content classifier (see §7.5) |
| Not used for | Training, public release, surveillance, language ID outside the report context |

### 7.4 Full-session recording (opt-in only)

A small set of channels support full-session recording (not the rolling-buffer model):

| Channel | When | Consent |
|---|---|---|
| GM Session (Doc #26) | If the GM enables "session recording" at session creation | Every participant must accept at join — channel won't open until everyone accepts, or non-acceptors are excluded with their consent |
| Any channel where all members opt in | Manual feature; member toggles "I consent to recording this channel"; recording starts only when 100% of members have toggled on; turns off if any member toggles off | Active and continuous consent |

Full-session recordings are stored under the consenting members' control (downloadable as Opus + transcript), with per-segment opt-out where any member retroactively withdraws consent within 24 hours of recording end, deleting the segment from the recording.

### 7.5 Automated content classification

A real-time content classifier runs on the SFU with low priority and only on encoded transcripts (post-§7.3) — not on raw audio. The classifier's job is **flag for human review**, never to auto-action:

| Class | Action |
|---|---|
| Hate-speech / slur token detected | Boost the speaker's report-priority weight in §7.1 if a report fires within the next 60 s; do not preemptively report or mute |
| CSAM-indicator audio (e.g., child voice in adult-targeted abuse pattern) | **Immediate P0 ticket** to `admin.root`; preserve buffer; do not auto-mute (avoid alerting predator); follow legal escalation per Doc #29 §12.3 |
| Repeated self-harm cue | Surface a "support resources" notification to the speaker only; create P2 ticket for community-care follow-up; never to public moderation queue |
| Voice-changer pattern | Flag for review when combined with another report pattern; voice-changer use is not itself a violation |

Classifier confidence is logged but never forwarded as a moderation verdict. Doc #29 §11.2 three-strike default applies to everything except deterministic CSAM-class indicators.

### 7.6 Cross-reference

| Source signal | Doc #29 ticket kind | Default priority | Default action |
|---|---|---|---|
| `/voice_report` from a listener | `PlayerReport` | Per-severity from reason_code | Per Doc #29 §3.5 PlayerReport actions (warn / mute / temp_ban / etc.) |
| Classifier flag (without report) | `AnomalyDetection` | P2 | Silent observe; never auto-action |
| Classifier flag + correlated report within 60 s | `PlayerReport` | One bucket higher than report alone | Doc #29 normal review |
| Recurring report subject | `PlayerReport` (with history annotation) | One bucket higher per repeat | Per Doc #29 enforcement ladder |

`voice_force_mute` (the §5.4 `admin.gm` tool) is the cross-channel parallel of the §5.3 channel-scope mute — applies on the SFU layer to every channel the muted Avatar joins.

---

## 8. Privacy

### 8.1 Opt-in default

Voice chat is **off by default for new accounts.** The first voice channel join — any kind, including auto-join party voice — triggers a one-time consent dialog explaining:

1. Voice is transmitted to a server fleet (not P2P unless a Private 1:1 path is selected).
2. A 30-s rolling buffer of inbound voice is held in server memory **for moderation only** and is materialized only on a `/voice_report`.
3. Voice is encrypted in transit (DTLS-SRTP) and at rest in any moderation buffer (AES-256-GCM).
4. The user may revoke voice consent at any time in Settings; revocation is immediate.
5. Local client retains no voice recording absent the user's explicit "save this clip" action (Phase 4 feature, not in Phase 1–3).

A user who declines is fully functional in the game — voice is enrichment, never required (§13).

### 8.2 No surreptitious recording

No path exists to record voice without producing a real-time indicator on the speaker's HUD. Every active member sees:

| State | Listener-side indicator | Speaker-side indicator |
|---|---|---|
| Channel has rolling buffer active (always) | "Buffered for moderation" text in channel header | Same |
| Full-session recording active (§7.4) | Red dot on every speaker's portrait + on listener's HUD | Same — visible to the speaker |
| Admin listening (`voice_listen_in`) | Per shard-config: visible-default per §8.5 | Same |

The shard-configurable exception in §8.5 has hard floors detailed there.

### 8.3 Encryption

| Layer | Mechanism |
|---|---|
| Client → SFU | DTLS-SRTP per WebRTC standard. Keys negotiated per session via DTLS handshake |
| SFU → SFU (cross-region voice) | mTLS over a dedicated voice-mesh VLAN; peer SFUs authenticate by short-lived service certs |
| SFU → moderation evidence storage | AES-256-GCM at rest with per-ticket key; key wrapped under a master key escrowed in the cloud KMS |
| Buffer in SFU process memory | AES-256-GCM with per-process key rotated hourly; key never persisted; if process restarts, the buffer is lost (acceptable — moderation reports go via materialized blobs, not raw RAM) |

The SFU **forwards** SRTP packets without decrypting them in the default path. SRTP rewrap (with key continuity) happens only when the SFU needs to mix or transcode (e.g., the §7.2 rolling buffer, which requires decrypted media). The "decrypt for moderation buffer" path is on a separately-permissioned process boundary; no operator can casually attach a debugger and read live media.

### 8.4 Bystander redaction

When a `VoiceEvidence` bundle is materialized in proximity-voice or open-channel scenarios, the bundle includes voices other than the report subject (proximity is communal). Redaction policy:

| Voice in bundle | Treatment |
|---|---|
| Subject voice | Preserved as-is |
| Reporter voice (if `capture_listener_perspective = true`) | Preserved with reporter's consent |
| Bystander voices in the same proximity radius | Volume-reduced to -∞ where possible (acoustic separation); when not separable (overlapping speech), bystanders are anonymized via voice morphing (pitch shift + formant scramble) before the bundle reaches a human moderator |
| Public-figure voices (streamers / hosted GM session participants who explicitly published their session) | Per consent at session start (Doc #26 §12 audit) |

Anonymization is best-effort (acoustic source separation is imperfect); the moderation UI displays a "may contain incidental bystanders" banner whenever the bundle is from a public-channel kind. CSAM-class evidence skips bystander anonymization to preserve evidentiary integrity for legal escalation.

### 8.5 Admin listen-in policy

| Shard kind | `voice_listen_in` default visibility |
|---|---|
| Beginner | Visible to channel members ("[GM] is observing"); cannot be made invisible |
| Virtue | Visible to channel members by default; can be made invisible only on a P0 ticket with a `admin.root` co-sign |
| Chaos | Invisible by default (paralleling Doc #29 §7 admin halo policy); but visibility transparency is published in shard rules and applies only to active investigations of an existing ticket |
| Classic | Voice chat largely absent (single-player + small co-op); this case is moot |

Even invisible listening is **logged** to `admin_audit_log` (Doc #29 §9) with the ticket id, reason, and exact duration. There is no listen-in path that is not logged. Routine non-incident listening is forbidden by policy and structurally not enabled — `voice_listen_in` requires an open ticket id at call time.

### 8.6 Data export & deletion (links to Doc #38)

GDPR data subject access requests, COPPA parental data rights, and equivalent regional rights flow through Doc #38 (Privacy & Data Governance, pending). Within the voice domain:

- A user's data export includes: their voice chat consent timeline, channel-membership history (which channels, when), any moderation buffer materializations involving them as subject, transcripts thereof, and any ban/mute records.
- A user's deletion request causes immediate purge of every materialized buffer and transcript where they are the subject; bystander references in third-party tickets remain anonymized per §8.4 but are otherwise retained per legal hold.
- Cross-reference: Doc #38 §[TBD] — coordinated retention table.

---

## 9. Accessibility

### 9.1 Speech-to-text live captions

Per Doc #34 §4 ("Voice-chat transcription (Phase 3+)") — this doc delivers it.

| Feature | Spec |
|---|---|
| Toggle | Per-listener; off by default; enabled in Settings → Accessibility → Voice Captions |
| Engine | Same Whisper-class ASR used in §7.3 moderation, scoped per-listener live |
| Locales | At launch: en. Phase 3+ expansion driven by Doc #33 localization priorities |
| Latency | < 1 s (text trails speech by < 1 s in steady operation) |
| Display | On-screen overlay near the speaker's HUD portrait (proximity / party / raid) or in a dedicated captions panel for guild rooms |
| Speaker labels | "Iolo: ..." with the speaker's display name and the same color coding as Doc #34 §4 dialogue speaker identification |
| Privacy | Live captions run **on the listener's client** via downloaded ASR model; no audio is shipped to the moderation infrastructure for caption purposes. Server-side transcription is exclusively a moderation feature (§7.3) |
| Confidence display | Low-confidence words italicized to signal the ASR is unsure |

### 9.2 Text-to-speech for muted players

Per Doc #34 §4 mono audio mode and the audio-cue captions concept — the inverse direction.

A player who cannot or chooses not to use a microphone can type into a per-channel text input. Their text is converted to TTS server-side and forwarded as a synthetic voice on the same channel:

| Property | Value |
|---|---|
| Trigger | Player presses TTS-input hotkey (default `T` while in a voice channel) and types up to 200 chars |
| TTS engine | Same engine path as Doc #27 §6.5 dynamic NPC TTS (Phase 3+) — co-hosted infrastructure |
| Voice | Player picks from a pool of generic voices (no impersonation of named players); no real-actor voice cloning |
| Cost | Counts toward the player's chat rate-limit; abuse (TTS spam) escalates per Doc #29 §11.1 |
| Indicator | TTS-originated voice is labeled "🔊 [text-to-speech]" in caption overlays so other listeners distinguish it from organic speech |
| Locales | Phase 3 launch: en, es, de, fr, ja, ko (per Doc #33) |

### 9.3 Audio-cue accessibility hooks

| Per-listener feature | Source | Spec |
|---|---|---|
| Speaker indicator on HUD | Doc #34 §4 visual SFX cues | Speaking ring around portrait + bearing arrow for proximity speakers off-screen |
| Pre-utterance buffer | New | Optional 250 ms playback delay so HoH listeners can read captions before audio arrives (off by default — adds latency; for HoH users the tradeoff is favorable) |
| Voice-bus volume | Per Doc #27 §9 | "Voice" is its own bus, separate from SFX/music/ambient/master |
| Per-speaker volume | §5.2 | Per-listener slider per peer |
| Mono downmix | Per Doc #34 §4 | Voice respects the global mono-downmix setting |

### 9.4 Cognitive / processing accommodations

| Feature | Spec |
|---|---|
| Reduce simultaneous speakers | Per-listener cap on heard-at-once speakers; SFU is asked to forward at most N (default 3); excess speakers are queued and surface as a "waiting to speak" banner. Useful for processing disabilities and in chaotic raid rooms |
| Disable ducking | Voice-vs-music ducking (§6.3) can be disabled per-listener for users whose hearing or processing prefers a stable music bed |
| Captions-only mode | Listener can disable voice playback entirely while reading captions; mic remains functional. Useful in shared environments |

---

## 10. Cross-Platform

### 10.1 PC / Mac / Linux (primary)

WebRTC native client SDK (libwebrtc) embedded in the UE5 client. Default microphone access via OS standard APIs:

| Platform | Mic API | Echo cancellation | Notes |
|---|---|---|---|
| Windows 10/11 | WASAPI | WebRTC AEC3 | Default device per OS settings; per-device override in game settings |
| macOS 12+ | CoreAudio | WebRTC AEC3 | Mic permission prompt per OS standard; we surface in-game prompt explaining the request |
| Linux (Wayland + PulseAudio/PipeWire) | PipeWire preferred; PulseAudio fallback | WebRTC AEC3 | Mic permission per portal; explicit prompt |

### 10.2 Console hooks

Phase 4+ scope; scaffolding-only in this doc.

| Console | Voice path |
|---|---|
| PlayStation 5 | Platform voice service (PSN voice chat APIs); WebRTC bridges to platform voice via certified game-voice integration |
| Xbox Series X/S | Game Chat API (Microsoft); WebRTC bridges similarly |
| Nintendo Switch | Limited; voice may be off-platform-only; details TBD per platform certification |

Console voice is **not** a separate channel — it bridges into the same SFU rooms via per-platform certified gateways, so a PC Avatar in a party hears their PS5 partymate seamlessly. Cross-platform compliance with each platform's voice-content moderation requirements is layered on top of §7 (platforms add their own filters; we do not subtract from theirs).

### 10.3 Web client (Phase 3+)

Browser-native WebRTC; no SDK install. Same SFU. Browser sandboxing precludes some client-local features (notably the on-device ASR for §9.1 live captions) — fallback to server-side caption streaming with attendant privacy tradeoff documented to the user.

### 10.4 Mobile

Phase 4 scope.

| Concern | Spec |
|---|---|
| Bandwidth | Default to 12 kbps Opus on cellular; 24 kbps on Wi-Fi |
| Battery | DTX aggressively engaged; mic deactivated when app backgrounded |
| Background audio | Voice continues during companion-app modes; suspended when device is locked |
| Hold-to-talk button | Always-visible on-screen button; default to PTT mode on mobile to conserve battery |
| Permissions | OS mic permission per platform; in-game pre-prompt explains why we ask |

---

## 11. Compliance

### 11.1 COPPA (US, under-13)

| Requirement | Implementation |
|---|---|
| Voice chat is "personal information" under COPPA | Yes — Project Virtue treats voice data with the same protections as text PII |
| Under-13 accounts | Voice chat **disabled by default and not enableable** without verifiable parental consent (Doc #38). The voice settings UI for under-13 accounts shows a parent-consent flow, not a toggle |
| Verifiable parental consent | Per Doc #38 §[TBD]; identity verification + payment-method-on-file or signed-form per FTC guidance |
| Voice data retention for under-13 | Stricter than adult retention: rolling buffer present (necessary for moderation), but moderation materializations involving an under-13 subject auto-escalate to `admin.root` and have 30-day retention rather than 90 |
| Transcription for moderation involving under-13 | Always reviewed by `admin.root`; never community moderators |

### 11.2 GDPR (EU)

Cross-reference Doc #38 (Privacy & Data Governance, pending).

| Requirement | Implementation |
|---|---|
| Lawful basis for processing | Legitimate interest for moderation buffer (preventing harm); explicit consent for voice transmission itself (the §8.1 opt-in) |
| Data minimization | 30-s rolling buffer; 90-day retention post-materialization; no corpus mining |
| Right to access | User data export per §8.6 includes all voice-related records |
| Right to erasure | User deletion purges voice records subject to legal hold |
| Right to object | User can revoke voice consent; structurally implemented as voice-disabled flag in account settings |
| Cross-border transfer | EU-resident voice data stays on EU regional infrastructure; cross-region voice routing prefers regional SFU first; cross-continental relay only on user-initiated cross-region encounters (joining a NA shard from EU) and with at-join-time disclosure |
| Data Protection Impact Assessment | Required pre-launch; voice + moderation buffer is a "high-risk processing" classification |
| Privacy contact | Per Doc #38 |

### 11.3 Korean regulations

| Requirement | Implementation |
|---|---|
| Real-name verification (RNV) | Korean shards require RNV per local law; voice account is bound to RNV-verified user identity |
| Shutdown law (curfew for under-16) | Voice service follows the platform-wide shutdown windows; voice disabled during curfew for affected accounts |
| Game Industry Promotion Act notices | In-app notices in Korean per regulation |
| Local data residency | Korean users' voice data resides on Korea-region SFU and storage; cross-border relay only with explicit acknowledgment |

### 11.4 German regulations

| Requirement | Implementation |
|---|---|
| Hate-speech laws (NetzDG / DSA) | §7.5 classifier tuned for German hate-speech taxonomy; moderation queue prioritizes German-locale reports of hate-speech class to a 24h SLA per regulatory expectation |
| Youth protection (USK) | Voice chat off by default for accounts with under-18 birthdate per German account flow; opt-in available with USK-rating-aligned warnings |
| Right to be forgotten | Per GDPR (§11.2) |

### 11.5 China & restrictive regimes

China-specific deployment is not in current scope; if pursued, voice chat is the primary regulatory blocker — many features (real-time cross-border voice, automated moderation crossing data borders) are non-trivially incompatible with PRC requirements. Working assumption: China deployment, if it happens, ships with text-only chat and no voice.

### 11.6 Age-gated rooms

The `AgeGate` permission per channel:

```ts
type AgeGate =
  | { kind: "any" }                       // no age verification required
  | { kind: "13_plus" }                   // COPPA boundary
  | { kind: "16_plus" }                   // EU youth-protection
  | { kind: "18_plus" }                   // adult-only rooms
  | { kind: "verified_age", floor: int }  // requires platform-level age verification (Phase 4+)
```

Rooms with `18_plus` gate require an account-level age claim (not "verified_age" — that's a stronger Phase 4 feature). Under-aged Avatars cannot join 18+ rooms. Hosted GM sessions (Doc #26) can set their own age gate; the gate enforces consistently across both voice and text chat in the session.

---

## 12. MCP Surface Additions

> Amendments to Doc #14 §3 (capabilities), §5 (tools), §6 (resources). All gated by capabilities.

### 12.1 New capabilities (extends Doc #14 §3)

| Capability | Holds | Notes |
|---|---|---|
| `voice.user` | Self-mute / self-deafen / leave / report | Granted by default to any `avatar.basic` session; revocable on enforcement |
| `voice.moderator` | §5.3 actions on a channel where the holder has `moderator` role | Granted dynamically when holder gains the role; not an account-level capability |
| `voice.admin` | §5.4 admin overrides | Overlaps `admin.gm` (Doc #29 §2); voice-specific tools are advertised only to `admin.gm`+ sessions |

### 12.2 New tools

| Tool | Capability | Envelope inputs | Returns | Notes |
|---|---|---|---|---|
| `voice_join(channel_id)` | `voice.user` | `channel_id: UUID` | `{ rtc_offer: SDP, ice_servers: ICEServer[] }` | Initiates WebRTC handshake |
| `voice_leave(channel_id)` | `voice.user` | `channel_id: UUID` | `{ ok: true }` | Disconnects from channel; SFU cleans up subscription |
| `voice_set_mute_self(channel_id, muted)` | `voice.user` | bool | `{ ok: true }` | Per-channel self-mute |
| `voice_set_deafen_self(channel_id, deafened)` | `voice.user` | bool | `{ ok: true }` | Per-channel self-deafen |
| `voice_block_user(avatar_id)` | `voice.user` | AvatarId | `{ ok: true }` | Account-wide voice block |
| `voice_report` | `voice.user` | (see §7.1) | `{ ticket_id: TicketId }` | Files a moderation ticket; rate-limited per Doc #32 §4 |
| `voice_create_room(kind, permissions)` | `voice.user` (with constraints per kind) | (see §2) | `{ channel_id }` | Creates a room of allowed kinds (`Private`, `Guild` sub-room with guild membership) |
| `voice_set_mode(channel_id, mode)` | `voice.moderator` | `mode: VoiceMode` | `{ ok: true }` | OpenMic / VAD / PTT |
| `voice_force_mute(avatar_id, duration, reason)` | `voice.admin` | (see §5.4) | `{ ok: true }` | Server-wide force-mute |
| `voice_listen_in(channel_id, ticket_id, reason)` | `voice.admin` | required `ticket_id` | `{ session_id }` | Joins as observer; ticket-bound; visibility per §8.5 |
| `voice_force_dissolve(channel_id, reason)` | `voice.admin` | UUID + string | `{ ok: true }` | Force-close a channel |
| `voice_export_buffer(channel_id, ticket_id)` | `voice.admin` | UUID × UUID | `{ blob_uri, transcript_uri }` | Materializes the §7.2 buffer for ticket evidence |

```json
// voice_report (illustrative)
{
  "name": "voice_report",
  "input": {
    "envelope": "VerbEnvelope",
    "channel_id": "UUID",
    "reported_avatar_id": "AvatarId",
    "reason_code": "VoiceReportReason",
    "free_text": "string?",
    "capture_listener_perspective": "boolean?"
  },
  "returns": { "ticket_id": "TicketId" }
}
```

Errors: `ERR_CAPABILITY` (player-tier calling admin tools), `ERR_VOICE_DISABLED` (caller account has voice disabled), `ERR_AGE_GATE` (joining a gated room without sufficient age), `ERR_RATE_LIMITED` (report flooding), `ERR_VOICE_INFRA_DOWN` (degraded mode per §13).

### 12.3 New resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/voice/channels` | List of voice channels visible to the caller (own party / guild / friends) | `voice.user` |
| `forge://shard/{s}/voice/channel/{cid}` | Single channel detail (members, permissions, mode) | `voice.user` (member-of) |
| `forge://admin/voice/active_speakers` | All currently-speaking Avatars across the shard, with channel and bearing — operations dashboard | `admin.viewer` |
| `forge://admin/voice/sfu_health/{region}` | SFU process metrics (CPU, RAM, BW, active streams, fan-out cap state) | `admin.engineer` |
| `forge://admin/voice/evidence/{ticket_id}` | `VoiceEvidence` blob URIs and transcript URIs for an active ticket | `admin.gm` |

---

## 13. Failure Modes & Graceful Degrade to Text

| Failure | Detection | Behavior | User-visible |
|---|---|---|---|
| SFU process crash in region | Region GS heartbeat with SFU times out (5 s) | Voice channels in region are torn down; clients reconnect to spawned-replacement SFU (Doc #22 §13 spawn pattern); voice may be unavailable for ~ 10–30 s | Text chat unaffected; banner: "Voice temporarily unavailable, restoring..." |
| Client mic permission revoked mid-session | OS event | Local client transitions to listener-only; surfaces a settings panel | "Microphone disabled; you can hear others, others can't hear you" |
| Client bandwidth collapse (sustained loss > 20%) | WebRTC stats | Client drops to 12 kbps Opus; if still failing, drops to listener-only | "Voice quality reduced due to network conditions" |
| Cross-region SFU mesh partition | SFU mesh heartbeat | Affected channels split into per-region cohorts; speakers in the other cohort are shown muted on the listener side | "Some channel members are temporarily unreachable" |
| Voice-account disabled during active session | Auth service push | Speaker is force-muted within 60 s; channel membership preserved as listener until they manually rejoin under a clean state | "Your voice access has been suspended; please review the moderation portal" |
| Regulatory geofence change (new region added to voice-prohibited list) | Edge config push | All existing channels in the geofenced region drop to text-only; voice traffic refused at the edge | "Voice chat unavailable in your current region" |
| Total voice infra outage | Aggregate health monitor | All voice channels degrade to text-only equivalents; party voice notification becomes party chat notification; raid leadership voice becomes raid chat broadcast; proximity voice becomes proximity chat (Doc #6 §4 local channel) | Banner: "Voice service unavailable. Text chat continues." |

The design principle: every voice channel has a parallel text channel that pre-existed the voice feature. Text never depends on voice. Game progression (combat, dialogue, quest completion) never depends on voice.

---

## 14. Phase 1 / Phase 2 / Phase 3+ Scope

Voice chat is **Phase 3+** content per Doc #11 and Doc #27 §7. Phase 1 ships with no voice anywhere; Phase 2 adds text-chat infrastructure improvements (Doc #6 §4) and the voice scaffolding (capability surface stubs, settings UI placeholders); Phase 3 is the first voice ship.

### 14.1 Phase 1 (vertical slice, single-player + 8-player Britain)

| Subsystem | Scope |
|---|---|
| Voice anywhere | **Not implemented.** Per Doc #27 §7, player-to-player voice chat is out of Phase 1 scope |
| Voice settings UI | Stubbed: settings page exists with "Voice chat — coming soon" placeholder |
| Voice capability surface | Capabilities reserved (`voice.user` etc.) but no tools advertised |
| Audio engine extension | `SoundType.PlayerVoice` defined in Doc #27 §2 but unused |
| Moderation queue | No voice tickets generated; reason codes reserved in Doc #29 schema |

### 14.2 Phase 2 (preparatory)

| Subsystem | Scope |
|---|---|
| SFU infrastructure | Deployed in non-production; load-tested; not exposed to players |
| WebRTC client integration | Bundled in client; behind feature flag |
| TURN/STUN fleet | Provisioned in 1 region; ready for activation |
| Moderation pipeline | Rolling-buffer SFU code path implemented and tested with synthetic audio |
| ASR (speech-to-text) | Phase 2 internal; en-only; tested on moderation transcripts |
| Compliance work | Privacy policy update, COPPA / GDPR / Doc #38 cross-reference work, age-verification flows |

### 14.3 Phase 3 (first ship)

| Subsystem | Scope |
|---|---|
| Channel kinds shipped | `Party`, `Private`, `GMSession` |
| Locales | en-only at first ship; es / de / fr / ja / ko / pt-BR / zh-Hans rolling out per Doc #33 priority |
| Codec | Opus 24 kbps with FEC and DTX |
| Live captions (§9.1) | en-only; on-device ASR |
| TTS for muted players (§9.2) | Phase 3 ship; en-only |
| Geofence | Voice opt-in by region; restrictive geographies launch text-only |
| Mobile | Not in Phase 3; targets Phase 4 |

### 14.4 Phase 4+

| Subsystem | Scope |
|---|---|
| Channel kinds added | `Guild` (persistent rooms), `Raid`, `Proximity` (in-world spatial — the headliner `[BR]` feature) |
| Console hooks | Per-platform voice-bridge integration |
| Mobile | iOS / Android |
| Web client voice | Browser WebRTC with server-side caption fallback |
| Verified-age age gate | Adds platform-level age verification |
| Per-language ASR expansion | Driven by Doc #33 priorities and moderation needs |

**Phase 3 success metric:** two players in a party can hear each other via SFU-relayed Opus voice within < 200 ms mouth-to-ear, the first /voice_report flow produces a moderation ticket within 5 s with a 30-s buffer attached, and a player who declines voice consent at first-join experiences zero gameplay degradation.

---

## 15. Discord Interop (Community Augmentation Layer)

First-party in-game voice and text — LiveKit-backed voice (§3) and the Doc #6 §4 chat layer — are and remain the canonical communication surfaces for Project Virtue. Discord is added as an **optional augmentation** for the community ecosystem that grows around the game (guild servers, content creators, out-of-band coordination), never as a substitute for the in-game stack. This section specifies what we integrate, what we deliberately do not, and the security and policy boundaries that hold the line.

### Scope & non-goals

Discord integration is an **OPTIONAL augmentation layer**. It is never required to play Project Virtue, never authoritative for in-game state, and never replaces in-game voice or text for any of the canonical channels: proximity (§2.4), party (§2.1), guild (§2.2), or system / shard-wide announcements. A player who never touches Discord experiences zero gameplay degradation — exactly the same posture as a player who declines voice consent at first-join (§8.1, §13).

Discord communications are **NOT within the GDPR portability perimeter** (Doc #38). Conversations that happen on a guild's Discord server are governed by Discord's terms and Discord's data residency, not ours. Our data export bundle (§8.6) does not — and cannot — include Discord messages. This gap must be disclosed in the privacy policy (cross-ref §11 and Doc #38).

The integration is **outbound-biased.** The game tells Discord things; Discord tells the game very little, and what little it does tell us is read-only and game-state-inert (see §"Three integration surfaces" below).

### Three integration surfaces (in-scope for Phase 2)

Three concrete integration points, in increasing order of complexity and trust required.

#### Rich Presence

The game publishes a Discord status string for the running client. Example: "Playing Project Virtue — in Trinsic". The status updates as the player moves between regions, joins a party, or enters a hosted GM session (Doc #26 §5).

| Element | Spec |
|---|---|
| Implementation surface | Discord SDK in the **UE5 client only**. The TS web client falls back to Discord's web Rich Presence, which is more limited (no Spectate/Join, fewer state strings) |
| Update cadence | Throttled to one update per 15 s; coalesces region transitions to avoid status spam |
| Content | Shard name, current region, party size; never coordinates, never inventory, never combat state |
| Spectate / Join buttons | Optional, **only enabled in non-Chaos shards**. Chaos shards (full-loot PvP) explicitly suppress Join buttons to avoid griefing-via-Discord-friend-list |
| Opt-out | Settings → Privacy → "Publish Rich Presence to Discord" — off by default for new accounts; one-click toggle |

Rich Presence runs entirely in the client; no server-side coordination required. It is the cheapest integration surface and the lowest-risk.

#### OAuth account link

Players may **optionally** link their Discord account to their game account via Discord OAuth2.

| Element | Spec |
|---|---|
| Opt-in | Explicitly user-initiated from Settings → Account → Linked Accounts → Discord |
| Granularity | Per-scope consent: identity (Discord username + id), guild membership read, role-write (only if guild-bot present in the target Discord) |
| Storage | `discord_id` on the account row; encrypted at rest using the same KMS-wrapped per-tenant key as the moderation evidence path (§8.3) |
| Revocation | One-click unlink in Settings; immediate cascade — `discord_id` purged, any Discord roles auto-granted by us are revoked, any Rich Presence "verified Discord" badge removed |

Use cases enabled by an opt-in link:

- **Auto-grant guild Discord roles** when in-game guild membership changes (join, promote, kick). The guild bot (below) is the executor.
- **Reduce friction** for joining a guild's Discord — the in-game guild roster surfaces a "Join Discord" button for linked guilds.
- **Cross-platform identity** for content creators — streamers who want their Discord handle visible alongside their character name (always opt-in display; see §"Security & policy boundaries").

#### Guild bot

A server-side Rust service (a small companion to the main game-server fleet, deployable independently) that posts to a guild's Discord channel.

| Posting category | Direction | Default | Examples |
|---|---|---|---|
| Server status | Out | On | "Atlantic shard back online after maintenance" |
| Raid kill-feed | Out | On (configurable per guild) | "Guildmember Iolo defeated Lord British's Lich (raid: Despise Level 3)" |
| Login / logout summary | Out | On (rolled up hourly to avoid spam) | "12 guildmembers online: …" |
| Scheduled events | Out | On | Auto-posts when a guild leader schedules an event in-game |
| Achievement broadcasts | Out | Per-member opt-in | "Iolo earned the *Champion of Britannia* title" |
| Inbound commands | In | Read-only allowlist | `!who-online`, `!guild-treasury-readonly`, `!next-event` |

**OUTBOUND ONLY by default.** The guild bot's inbound surface is restricted to a **strict read-only allowlist.** Inbound Discord commands MUST NOT move currency, transfer items, change membership, queue actions, or affect game state in any way. This is a hard architectural rule, not a configuration setting — there is no code path from a Discord webhook to a writable game-state verb. The economic-attack-surface implications (Doc #32) make this non-negotiable.

### Security & policy boundaries

- **Discord-side moderation is Discord's responsibility, not ours.** We do not moderate guild Discord servers; we do not enforce Project Virtue's Code of Conduct against Discord messages. The two trust boundaries are deliberately separate.
- **Linking Discord identity is opt-in and revocable** at all times. Display of `discord_id` to other players is **OFF by default**; a player must explicitly toggle "Show my Discord on my profile" to surface it.
- **Doxx prevention.** Never display a player's Discord username alongside their character name without explicit consent. The in-game guild roster, kill-feed, and chat name-tags surface character names only; Discord identity is opt-in display per §above.
- **Per-guild invite model.** The guild bot must be invited per-guild by the guild leader; there is no global "auto-join" of player Discords, no scraping of player Discord servers, and no implicit linkage between a player's personal Discord and the bot.
- **Rate limit & circuit breaker.** All outbound Discord posts are rate-limited to Discord's published API limits (50 req/s/bot, 5 req/s/channel). A circuit breaker around the Discord client trips on sustained 5xx or 429 from Discord's edge — when tripped, the bot drops messages to a bounded queue and continues; **a Discord outage never stalls the game tick.** This is the same posture as §13 graceful-degrade-to-text.
- **Age verification & adult-content fences.** Discord age and game age may diverge (a minor verified in our COPPA flow may have a Discord account that has accessed Discord's adult-only servers). If our age data flags a player as a minor, the OAuth flow must refuse to link to a Discord account that has accessed adult-only Discord content. The exact API surface for this check is `[OPEN]` (Discord's age-gate metadata is partial and changing); resolution required before Phase 2 ship — see §16.

### What is explicitly NOT integrated (and why)

| Surface | Decision | Reason |
|---|---|---|
| In-game proximity chat → Discord | **No** | Proximity is location-based (§2.4, attenuation per Doc #27 §3); Discord is room-based. The semantics do not translate — there is no Discord channel for "everyone within 30 metres of the Trinsic fountain." |
| Discord voice replacing LiveKit | **No** | Console certification (Doc #39) requires first-party voice with platform-mute integration (§10). Discord cannot satisfy console mute hooks. |
| Discord text channels replacing in-game text chat | **No** | Two losses: moderation sovereignty (Doc #29 — we cannot enforce CoC on Discord) and GDPR portability (Doc #38 — we cannot export Discord messages). |
| Game state mutated by Discord commands | **No** | Inbound is read-only by architectural rule. No currency, items, membership writes, action queueing, or any state-affecting verb is reachable from a Discord webhook path. |

Each of these is a deliberate "no" with a documented reason, not a "not yet" — the decision is not expected to revisit unless the underlying constraint changes (e.g., Discord ships console-cert-compatible mute APIs).

### Phase 2 scope (post-prototype)

Sized to fit a **2–3 engineer-week** total for a useful first version, parallelizable across two engineers.

| Workstream | Effort |
|---|---|
| Rich Presence (UE5 client SDK integration, throttling, opt-out toggle) | ~3 engineer-days |
| OAuth link (Discord OAuth2 flow, account-row storage, revocation cascade) | ~3 engineer-days |
| Guild bot v1 — server status + login feed + scheduled events posting | ~1 engineer-week |
| **Total** | **2–3 engineer-weeks** |

Owner: TBD; depends on the community manager (for guild-leader UX, bot configuration, moderation policy) and one backend engineer (for the Rust service, OAuth flow, and Discord SDK integration). The work has no critical-path dependency on the core voice stack (§3) — this section can ship in any order relative to Phase 3 voice GA.

### Cross-references

- **Doc #14 (MCP Server Surface)** — adds a `discord.post_to_guild_channel` server-side verb (rate-limited, opt-in by guild leader, outbound only). Cross-ref §12 of this doc for the parallel voice-MCP surface.
- **Doc #28 (Live-Service Telemetry)** — track Discord-link conversion rate as a community-health metric; correlate with guild retention.
- **Doc #29 (Moderation & Admin Tools)** — guild-Discord moderation is **out of scope**; we provide a reporting bridge (a player can `/report` from Discord that lands as a Doc #29 §3 ticket) but no enforcement path on the Discord side.
- **Doc #38 (Privacy & Data Governance)** — Discord conversations are **NOT in the GDPR export bundle**. This gap must be disclosed in the privacy policy. Cross-ref §8.6 of this doc.
- **Doc #41 (Engine & Stack ADR)** — Discord is listed in §6 third-party services table; this section is the integration spec for that listing.

---

## 16. Open Questions

1. `[OPEN]` **Spatial voice in dungeon levels (vertical stacking).** Doc #27 §13 item 6 asks the same about combat sound through floors. For voice, the equivalent question: should a player whispering on the floor below be audible upstairs at any volume? Default proposal: voice follows the same `spatial_flags.through_floors` rule as combat, but whispering gets a stricter setting (always full-block). Audio director sign-off needed.
2. `[OPEN]` **Voice-changer policy.** Voice changers (pitch shift, formant scramble) used by players for fun, role-play, or anonymity. §7.5 flags voice-changer pattern only when correlated with another report; should role-play servers (Virtue shards) explicitly endorse voice changers as in-character expression? Working assumption: yes, with the standard moderation rules; needs Design ratification.
3. `[OPEN]` **Voice in Hosted GM Sessions: full session recording opt-in granularity.** §7.4 says "every participant must accept at join." Should we add a Phase 4 "GM-curated highlight reel" feature that allows the GM to publish selected segments after the session, with re-consent from every participant whose voice appears in the segment? This is a podcast-of-D&D-session concept; non-trivial consent UX.
4. `[OPEN]` **Cross-shard voice for cross-shard moongates.** Doc #6 §2 mentions cross-shard moongates as a 10K-CCU live-service feature. If a player walks through a cross-shard moongate while in a party voice channel, does voice persist across the shard boundary? SFU mesh is region-keyed within a shard; cross-shard voice mesh is a Phase 4+ infrastructure decision.
5. `[OPEN]` **MCP-mediated voice (LLM agent speakers).** Could an MCP-driven Avatar (Doc #14 §3) speak in voice channels via TTS? Use case: an automated GM agent narrating a hosted session. Risk: voice spam or hallucination at scale; the rate limits in Doc #32 §4 apply, but TTS voice is fundamentally different from text (humans react more strongly to voice). Recommendation: forbid MCP→voice in Phase 3; revisit in Phase 4 with human-in-loop approval gates.
6. `[OPEN]` **Voice as "presence" signal in proximity.** A player in a tavern who is silently listening but in proximity voice — does their HUD-portrait show a "listening" indicator to other proximity members? Privacy tradeoff: showing "X is here and listening" makes lurking visible; not showing it allows passive surveillance of other players' conversations. Default proposal: "in proximity voice channel" indicator visible above-portrait; "is listening" specifically not surfaced.
7. `[OPEN]` **Per-channel ASR cost model.** Server-side moderation ASR (§7.3) runs on report; on-device live-caption ASR (§9.1) is per-listener. A heavy-listener-count guild voice room with 50 listeners running live captions consumes 50× client GPU. Server-side caption distribution (one transcription, fanned out as text) is cheaper but ships transcripts (text representations of speech) to clients — privacy-equivalent to the speech itself but with a different threat surface. Architecture decision needed by Phase 3 ship.
8. `[OPEN]` **Voice-chat ban appeals require listening-back.** A voice-based ban appeal (Doc #29 §12) requires the appeals reviewer to hear the original audio. This means audio outlives the standard 90-day retention if an appeal is filed. Retention policy should explicitly extend the retention window for the duration of an open appeal plus 30 days. Legal sign-off for the extension across COPPA / GDPR jurisdictions.
9. `[OPEN]` **Doc #38 finalization.** Multiple §11 compliance items (`[TBD]` cross-references) await Doc #38 Privacy & Data Governance to land. Voice chat ship blocking — Phase 3 cannot launch without Doc #38 §[TBD] sections referenced in §8.6, §11.1, §11.2.
10. `[OPEN]` **Soundtrack ducking style override per channel.** §6.3 sets a default -6 dB music duck under voice. Per Doc #27 dynamic music aesthetic, some channels (GM sessions especially) might want music to *not* duck (the GM is narrating over a heroic theme deliberately). Default user-configurable, but per-channel-default-override is open.

---

## 17. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #27 §1 (sound-as-simulation principle extended to player voice), Doc #6 §4 (text chat as fallback), Doc #34 §1 (accessibility-as-launch-day commitment) |
| §2 Channel model | Doc #15 §8 (party / companion split), Doc #6 §4 (chat layer parallels), Doc #22 §15 (friends-list semantics for Private), Doc #26 §5 §12 (GM sessions) |
| §2.4 Proximity | **Doc #27 §2 SoundType extension (`PlayerVoice`)**, Doc #27 §3 (audibility math), Doc #27 §3.4 (NPC awareness — players shouting wake guards) |
| §3 Architecture | **Resolves Doc #22 §16 [OPEN] item 1** (NAT traversal); Doc #22 §2 (topology — SFU per region), Doc #27 §8 (replication shape) |
| §3.5 Region handoff | Doc #22 §7 (handoff mechanics) |
| §4 PTT/VAD | Doc #34 §5 (keyboard remap for PTT key) |
| §5 Permissions | Doc #29 §7 (admin verbs), Doc #32 §11 (MCP capability separation) |
| §6 Performance | Doc #22 §5.5 (game-state bandwidth budget — voice is additive), Doc #27 §5 / §6.3 (music ducking integration) |
| §7 Moderation | **Doc #29 §3 (ticket queue)**, Doc #29 §11 (anti-cheat hooks for classifier flags), Doc #32 §4 (rate limits applied to `/voice_report`) |
| §7.4 Full-session recording | Doc #26 §12 (GM session audit) |
| §8 Privacy | Doc #21 §11 (data lifecycle parallels), Doc #32 §5 (encryption posture), Doc #32 §11 (MCP token handling) — and Doc #38 (pending) |
| §8.5 Admin listen-in | Doc #29 §7 (admin halo policy parallel), Doc #29 §9 (audit log writes) |
| §9 Accessibility | **Doc #34 §4 (auditory accessibility — voice-chat transcription delivered)**, Doc #27 §9 (voice bus separation), Doc #33 (locales for ASR + TTS) |
| §10 Cross-platform | Doc #11 (Phase scoping), Doc #34 §5 §6 (motor + visual accessibility per platform) |
| §11 Compliance | **Doc #38 (cross-references throughout — pending)**, Doc #29 §12 (appeals interplay with retention) |
| §12 MCP additions | Doc #14 §3 (capabilities), §5 (tools), §6 (resources); Doc #32 §11 (MCP security model) |
| §13 Failure modes | Doc #6 §4 (text channel always present); Doc #22 §13 (SFU spawn-pattern parallel to game-server spawn pattern) |
| §14 Phasing | Doc #11, Doc #27 §7, Doc #27 §12 (Phase 1 deferral) |
| §16 Open Questions | Doc #6 §2 (cross-shard moongates), Doc #14 §3 (MCP capability future), Doc #27 §13 item 6 (vertical sound), Doc #29 §12 (appeals retention) |

### Resolved Cross-Doc Items

- **Doc #22 §16 item 1** (NAT traversal for client peer-to-peer audio chat) — fully resolved in §3.4: WebRTC ICE with STUN + TURN fallback ladder; SFU as default, P2P preserved only for friend-list-gated 1:1 Private rooms. Bandwidth, latency targets, and fallback steps documented.
- **Doc #27 §7** (player-to-player voice chat as Phase 3+ separate system) — this document is that separate system. Phasing, scope, and ship gates documented in §14.
- **Doc #34 §4** (voice-chat transcription called out as Phase 3+) — delivered in §9.1 with on-device ASR architecture, locale plan, and privacy posture.

### New [OPEN] Items

Ten, listed in §16: vertical-stack voice attenuation, voice-changer policy, GM-session highlight-reel consent, cross-shard voice mesh, MCP-mediated voice speakers, presence indicator for silent proximity listeners, ASR cost-distribution architecture, ban-appeal retention extension, Doc #38 dependency resolution, and per-channel soundtrack-duck override.

### Bandwidth Budget Summary

- **Outbound speaker:** 3.6–4.0 KB/s steady at 24 kbps Opus + FEC; < 0.1 KB/s during DTX silence.
- **Inbound listener:** 3.6 KB/s × N active speakers heard, capped at 6 by SFU fan-out cap (~22 KB/s peak).
- **Per-region SFU:** ~5 MB/s sustained at 200-player cap; 8-vCPU mid-range cloud instance per region.
- **Voice budget is additive to Doc #22 §5.5** (10 KB/s game state steady, 50 KB/s burst). Combined steady-state ceiling: ~30 KB/s; combined burst ceiling: ~70 KB/s.

---

End of Document #37.
