Document #27: Audio System
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Audio Engineering Lead]
Status: Living Technical Reference — Normative spec for the audio engine, sound-propagation simulation, dynamic music, voice acting, and audio replication. Implements the style targets in Doc #10 §5; resolves Doc #17 §14 [OPEN] item 1.

Depends on: #4 Simulation & Interaction §3 (sound propagation), #5 Virtues, #10 Art & Audio Style Bible §5 (style targets, prototype scope §7), #11 Phase 1 Vertical Slice (soundtrack loop, 20+ SFX, 8 voice lines), #13 Core Schema §2 (verb registry — verb-keyed SFX), #14 MCP Server Surface §5 (tool envelope), §6 (resources), #16 Combat & Magic, #17 Dialogue & NPC Schedule §2 (`Response.voice_clip`), §12 (`say_keyword` returns `voice_clip`), #22 Network Protocol & Replication §4 (event channel), #26 Long-range Arcs & Hosted GM Sessions.

---

## 1. Audio Philosophy

Sound is part of the simulation, not a presentation layer. Every SFX trigger is a `SoundEvent` with a spatial position, a propagation radius, and an audibility falloff curve; the same event is consumed both by the client mixer (rendered to the player) and by the `SoundPropagation` system (alerts NPCs in range, Doc #4 §3). Music is dynamic and reactive to game state via layered stems (Doc #10 §5.1 "shifts based on time of day, combat, Virtue reputation, and location"). Voice acting fires per-`Response` on the dialogue dispatcher (Doc #17 §2), never per-tree. The audio aesthetic is `[BG]` baseline ("chunky physical SFX", Doc #10 §5.2) plus `[BR]` simulation enhancements (sound-as-perception input to NPC AI) and `[BR]` orchestration (layered stems for dynamic music).

---

## 2. SFX Engine Architecture

UE5 MetaSounds is the rendering layer. A custom propagation layer wraps it to emit `SoundEvent`s into the simulation.

```ts
type SoundEvent = {
  event_id:            UUID
  source_position:     Vec3            // world coords, in tiles (Doc #23 spatial frame)
  source_entity_id:    EntityId | null // null = environmental (rain, fire crackle)
  sound_id:            SfxId           // resolves to MetaSound asset path
  base_volume_db:      f32             // pre-attenuation, see §3 thresholds
  propagation_radius:  f32             // tiles; see §4 defaults
  falloff_curve:       "linear" | "inverse_square" | "stepped"
  sound_type:          SoundType       // §4 enum; drives NPC awareness type
  emitted_at:          ServerTick
  spatial_flags:       SpatialFlags    // bitfield: through_walls, through_floors, dampened_by_water
}

type SfxId = string                    // e.g., "verb/use/door_open_wood"
type SoundType =
  | "Footstep" | "DoorOpenClose" | "ObjectDrop" | "CombatClash"
  | "SpellCast" | "Scream" | "Explosion" | "Whisper"
  | "Ambient"  | "DialogueVoice"
```

Two consumers per emission:

| Consumer | Purpose | Latency |
|---|---|---|
| Client audio mixer | Spatialized HRTF render to player headphones; distance attenuation; reverb zone | sub-frame after delivery |
| `SoundPropagation` system | Server-side; alerts NPCs in audible radius via `Awareness` message | within current sim tick (20 Hz, Doc #22 §3) |

SFX library naming convention (per Doc #10 §5.2 "contextual variation"):

```
sfx://verb/{verb}/{material}.wav
sfx://verb/{verb}/{material}_{variant}.wav     // pitch/volume variants per Doc #10 §5.2
sfx://ambient/{biome}/{layer}.wav
sfx://creature/{species}/{action}.wav
sfx://magic/{circle}/{spell_id}.wav
```

Examples: `sfx://verb/use/door_open_wood`, `sfx://verb/attack/sword_on_stone`, `sfx://verb/attack/sword_on_flesh`, `sfx://ambient/forest/wind`, `sfx://creature/wolf/howl`, `sfx://magic/3/fireball_cast`.

Resolution: client requests `SfxId`; CDN serves the asset; UE5 caches per-region preload set on region subscribe (Doc #22 §4 `Subscribe`).

---

## 3. Sound Propagation Model

> Resolves Doc #4 §3 sound-alerts-NPCs claim into a normative model.

### 3.1 Audibility computation

For each `SoundEvent` and each NPC entity within `propagation_radius * 1.5` (cheap pre-filter):

```
audible_volume_db(event, npc) =
  event.base_volume_db
  - falloff(distance(event.source_position, npc.position), event.falloff_curve, event.propagation_radius)
  - terrain_attenuation(event, npc)            // walls/water/floors per §3.2
  - stealth_modifier(event.source_entity_id)   // §3.3
```

If `audible_volume_db < npc.hearing_threshold_db` (default 0 dB, modified by sleep, deafness statuses), the event is dropped for that NPC.

### 3.2 Terrain attenuation

| Material between source and listener | Attenuation |
|---|---|
| Open air | 0 dB |
| Wooden door (closed) | 12 dB (partial muffle) |
| Stone wall | 30 dB (effectively full block at typical volumes) |
| Water column (submerged source or listener) | 18 dB |
| Floor (vertical between stories) | 24 dB; only if `spatial_flags.through_floors` set, else infinite |

Computation: a discrete grid raycast from source to listener accumulates attenuation per traversed tile face; cached per region per tick where source/listener are static.

### 3.3 Stealth modifier

Source-side volume reduction applied at emit time for actor-originated sounds (footsteps in particular):

```
stealth_db_reduction(actor) =
  base = (actor.stats.DEX - 10) * 0.6                    // higher DEX = quieter
  + skill_bonus("Stealth", actor)                        // 0..15 dB
  + footwear_modifier(actor.equipped.feet)               // boots +3 dB louder, soft shoes 0
  - load_penalty(actor.encumbrance_pct)                  // overburdened = noisy
```

Clamped to [0, 30] dB reduction. A high-DEX, stealth-skilled, soft-shod, unencumbered Avatar produces footsteps below the curiosity threshold.

### 3.4 NPC awareness response

If audible, dispatcher delivers an `Awareness` message to the NPC's AI:

```ts
type Awareness = {
  source_position:  Vec3
  sound_type:       SoundType
  audible_volume:   f32          // post-attenuation dB
  certainty:        f32          // 0..1; 1 = exact bearing, low if heavily attenuated
  perceived_at:     ServerTick
}
```

Volume thresholds drive default reaction (per `HostileAI` and schedule-interrupt logic, Doc #4 §5, Doc #16 §9):

| Audible volume | Default reaction | Schedule effect |
|---|---|---|
| < 20 dB | Ignored | None |
| 20–60 dB | Curiosity: `Look` toward source bearing for 1–3 sim ticks | None unless investigation persists |
| > 60 dB | Alert: schedule interrupted; investigate or engage | Slot pushed to override stack (Doc #17 §8); guard walks toward source, hostile wakes from `Sleep` |

Certainty modulates investigation behavior: `< 0.3` → search a 4-tile radius; `≥ 0.7` → walk directly to `source_position`.

---

## 4. Sound Types — Default Propagation

Per emission. Designers may override per-asset; defaults below are normative starting values.

| Type | Default radius (tiles) | Wall attenuation | Notes |
|---|---|---|---|
| Footstep | 4 | full block | `stealth_modifier` applies; surface variant (wood/stone/grass) selected per tile |
| DoorOpenClose | 6 | partial muffle (12 dB) | Material variant (wood/iron/stone) |
| ObjectDrop | 5 | full block | Volume scales with object mass (Doc #4 §2 weight) |
| CombatClash | 12 | partial muffle | Major NPC alert source; the "stolen plate wakes the guard" canonical case (Doc #4 §3) generalizes here |
| SpellCast | 8 | partial muffle | Visible/audible by spell circle (Doc #16); higher-circle spells louder |
| Scream | 16 | partial muffle | NPCs in pain or fear; guards investigate at this radius |
| Explosion | 24 | partial muffle | Region-wide alert; all NPCs in region receive `Awareness` |
| Whisper | 1 | full block | Used by stealth-dialogue / GM whisper (Doc #26); below curiosity for any third-party NPC |

---

## 5. Dynamic Music System

### 5.1 Stem layering

Music is composed of mixable stems (Wwise-style; UE5 MetaSounds host). Per region:

```ts
type MusicProfile = {
  region_id:        RegionId
  stems: {
    ambient:        AudioRef        // always playing baseline
    tension:        AudioRef        // mixes in on rising threat indicators
    combat:         AudioRef        // hard-cuts on first hostile detection
    virtue_tone:    AudioRef        // tints based on Avatar virtue aggregate
  }
  mix_rules:        MixRule[]
}

type MixRule = {
  inputs:           StateInput[]    // see §5.2
  target_mix:       StemMix         // per-stem 0..1 gain
  transition_ms:    int             // default 4000; combat enters with hard cut (0 ms)
}

type StemMix = { ambient: f32, tension: f32, combat: f32, virtue_tone: f32 }
```

### 5.2 State inputs

| Input | Source | Effect |
|---|---|---|
| `region_id` | Doc #22 region subscribe | Selects active `MusicProfile` |
| `time_of_day` | Doc #22 §3 `ServerTick` `time_of_day` | Day/night ambient stem variant |
| `combat_intensity` | aggregate of hostile NPCs in player audibility radius (Doc #16) | Drives combat stem gain |
| `avatar_virtue_aggregate` | Doc #5 Avatar Score | Tints `virtue_tone` stem (high virtue → bright; low → dissonant) |
| `story_arc_stage` | Doc #26 long-range arc tracker | Profile override for scripted moments |

### 5.3 Transitions

- Default cross-fade: 4000 ms, equal-power.
- Combat enter: 0 ms hard cut on first `hostile_to_avatar = true` entity entering player audibility (Doc #16 §9).
- Combat exit: 6000 ms fade-out after last hostile drops out of audibility for ≥ 5 s grace.
- Region change (Doc #22 §6 `RegionHandoff`): cross-fade between profiles over 4000 ms; no audio gap.

### 5.4 Composition style

Per Doc #10 §5.1: orchestral with medieval instruments (lute, flute, harp, light percussion), warm and slightly melancholic, in the line of the original Ultima VII soundtrack by The Fat Man (Marc Schaefgen) and Ken Allen. New stems must feel composable in 1992. Style validation for commissioned stems is human-review by audio director; UGC music is not in Phase 1 scope.

---

## 6. Voice Acting Trigger Logic

> **Resolves Doc #17 §14 [OPEN] item 1** ("voice acting trigger logic").

### 6.1 Storage and addressing

```
voice://{locale}/{npc_id}/{response_id}.opus
```

Codec: Opus at 48 kbps mono (sufficient for spoken voice, ~6 KB/s). Stored on CDN, not in shard DB. The shard DB only stores the existence flag (`voice_clip_present: bool`) per `Response`.

### 6.2 Trigger contract

Voice clips are keyed by `{npc_id, dialogue_response_id, locale}`. The trigger is the dispatcher resolving a Response with `voice_clip_present = true` on the Doc #22 §4 `DialogueUpdate` server message:

```ts
// Extension to Doc #17 §12.1 say_keyword return and Doc #22 §4 DialogueUpdate
type Response = {
  // ...existing fields from Doc #17 §2
  voice_clip_present:  bool                       // [BR] new; replaces nullable AudioRef on the wire
  voice_clip_uri:      string | null              // null if absent; CDN URL if present
  voice_clip_duration_ms: int | null
}
```

### 6.3 Client behavior

```
on DialogueUpdate(response):
  render_text(response.text)                                  // always
  if response.voice_clip_present and audio_settings.voice_enabled:
    stream_voice(response.voice_clip_uri)                     // start within 200 ms target
    if subtitles_enabled:
      pin_subtitle(response.text, duration = voice_clip_duration_ms)
  else:
    # silent NPC fallback — text-only is normative, not an error
    pass
```

### 6.4 Production scope (per Doc #10 §5.3)

| NPC tier | Voice scope | Selection criteria |
|---|---|---|
| Lord British, primary companions, principal antagonists | Full VO across all responses | Named in original story |
| Major Britain NPCs (Iolo, Shamino, Dupre, Mariah, Gwenno, etc.) | Full VO across all responses | Named, recurring |
| Quest-bearing named NPCs | Opening response VO + critical-branch VO; remainder text-only | Has at least one `StartQuest` or `UpdateQuest` `DialogueEffect` |
| Background named NPCs (shopkeepers, guards) | Greeting line VO only | One-line VO budget per NPC |
| Anonymous crowd NPCs | Text-only | No `npc_id` stable identity |

This is the **mid-tier resolution** of Doc #17 §14 item 1: opening + critical responses get VO, with full VO reserved for named principals; matches BG production economics.

### 6.5 Dynamic / TTS voice (Phase 3+)

Per-NPC fields enable runtime-generated voice for UGC NPCs:

```ts
// extension to Doc #13 NPC schema
type NpcVoiceProfile = {
  voice_actor_id:     string | null        // human-recorded VO actor ID; null for TTS
  voice_style:        VoiceStyle           // for TTS prompting
  pitch_shift_st:     f32                  // semitones, ±6
  speech_rate:        f32                  // 0.85..1.15
}

type VoiceStyle = {
  age:                "child" | "young" | "adult" | "elder"
  gender_timbre:      "feminine" | "masculine" | "androgynous"
  accent_hint:        string                // e.g., "british_rp", "rural_yew"
  affect:             "neutral" | "warm" | "stern" | "wary" | "manic"
}
```

TTS is **out of scope for Phase 1**. UGC NPCs in Phase 1 are silent (text-only) by default. Phase 3+ adds optional TTS rendering server-side, cached to CDN under a `voice://tts/{model_version}/...` namespace, with style validator and content-safety filter (Doc #29 hooks).

---

## 7. Voice for the Player Avatar

- **Avatar is silent.** Doc #10 §5.3 silent-protagonist tradition is preserved; no Avatar VO is recorded or generated for any response.
- **Canonical companions** (Iolo, Shamino, Dupre — the Phase 1 set per Doc #15 §8 lists Iolo and Shamino) have full VO for their barks, banter, and dialogue trees.
- **Player-to-player voice chat** is a separate Phase 3+ system, out of this doc's scope; preliminary notes in Doc #22 §16 (P2P NAT traversal [OPEN]).

---

## 8. Audio Replication

### 8.1 Server emission

Server emits `SoundEvent` to clients subscribed to the source's region (Doc #22 §4). Wire shape:

```ts
// new ServerMessage variant on the `event` channel (Doc #22 §4.3)
| { kind: "SoundEvent", region_id: RegionId, event: SoundEvent }
```

Replication scope per client: only events whose `source_position` falls within the client's region interest set **and** whose `propagation_radius * 1.2` includes the client's avatar position. Outside that envelope, no wire traffic — the client cannot hear it, so the server doesn't send it.

### 8.2 Client rendering

- Spatialization: HRTF for headphone output; stereo pan + ITD for speakers.
- Distance attenuation: applies the same `falloff_curve` the server used for NPC awareness (consistency with Doc #4 §3 simulation: what the player hears matches what AI hears, modulo player-specific deafness/hearing-aid accessibility settings).
- Reverb: per-region `ReverbZone` (cathedral, cave, open field, indoor) tagged on tiles; UE5 audio volume.
- Voice clips streamed peer-from-CDN, **not** from the game server. The `DialogueUpdate` event carries only the URI; the client opens an HTTPS connection to the CDN.

### 8.3 Bandwidth

| Traffic | Per-event size | Target rate | Aggregate |
|---|---|---|---|
| `SoundEvent` (MessagePack-encoded) | ~50 bytes | Peak 200 events/sec/region | ~10 KB/s/client during a battle |
| Voice clip stream | Opus 48 kbps | 1 active speaker per dialogue session | 6 KB/s per speaker |
| Music stems | Pre-loaded on region join | 0 runtime bandwidth | n/a |

Music stems are downloaded on region subscribe and mixed locally; the server only sends `MusicState` deltas (~20 bytes) on transition.

---

## 9. Accessibility

| Feature | Default | Scope |
|---|---|---|
| Subtitles | On | Any voice clip with an associated `Response.text` (always present) is shown as a subtitle |
| Visual SFX cues | Off (opt-in) | High-importance audio (combat hits, alerts, scream, explosion) optionally shows on-screen icon with directional indicator for hearing-impaired players |
| Volume controls | independent sliders | Master / music / SFX / voice / ambient — five independent buses |
| Mono downmix | Off | For single-sided hearing, downmix HRTF to single channel |
| Audio-cue captions | Off (opt-in) | Bracketed text captions for non-dialogue audio: `[door creaks open]`, `[footsteps approach]`, `[swords clash nearby]` |

Subtitle and audio-cue text is `LocalizedString` (Doc #17 §14 item 2 [OPEN]); pending that resolution, the placeholder is plain English.

---

## 10. Sound Effects Database

### 10.1 Verb-keyed defaults

Each verb in the Doc #13 §2 verb registry has a default SFX mapping. The dispatcher consults this table after a successful verb commit:

| Verb | Default `SfxId` | SoundType | Material variant key |
|---|---|---|---|
| `examine` | (none — silent) | n/a | n/a |
| `use` (door) | `verb/use/door_open_{material}` | DoorOpenClose | door material |
| `use` (container) | `verb/use/container_open_{material}` | DoorOpenClose | container material |
| `use` (food) | `verb/use/eat` | (suppressed if alone) | n/a |
| `drag` | (silent — pickup is mute by tradition) | n/a | n/a |
| `drop` | `verb/drop/{material}` | ObjectDrop | object surface material |
| `combine` | `verb/combine/generic` | (designer-overridable per archetype) | n/a |
| `attack` | `verb/attack/{weapon_class}_on_{target_material}` | CombatClash | target body/material |
| `cast_spell` | `magic/{circle}/{spell_id}_cast` | SpellCast | spell circle |
| `throw` | `verb/throw/release` + `verb/drop/{material}` on landing | ObjectDrop | landing surface |
| `move_to` | `verb/footstep/{surface}` per tile | Footstep | tile surface (wood/stone/grass/water) |
| `steal` | inherits `drag` (silent at source); witness-side `Awareness` if seen | n/a | n/a |
| `talk` | (none for `talk` itself; voice fires on Response) | n/a | n/a |
| `ignite` | `verb/ignite/spark` + `ambient/fire/whoosh` | SpellCast (loud variant) | n/a |

Material variants resolve from the target entity's `Physical.material` field (Doc #13 §1.1) and the actor's weapon class (Doc #16). Falls back to a generic variant if a specific combination is not authored.

### 10.2 UGC-submitted SFX

| Constraint | Limit |
|---|---|
| Length | ≤ 5 seconds per UGC SFX |
| Format | WAV PCM 16-bit mono, 22.05 kHz or 44.1 kHz |
| File size | ≤ 256 KB |
| Style validation | Manual audio-director review for Phase 1; automated style-classifier for Phase 3+ (see §13 [OPEN]) |
| Loudness normalization | Server-side LUFS normalization on upload (-16 LUFS target) |
| Content moderation | Same content-safety pipeline as UGC text (Doc #29 hooks) |

UGC SFX upload via Doc #7 modding tools; storage under `sfx://ugc/{shard}/{creator_id}/{sfx_id}.wav`.

---

## 11. MCP Surface Additions

> Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 11.1 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `play_sfx` | `designer.audio` or `ugc.author` | `sound_id: SfxId`, `position: Vec3`, `volume?: f32 (0..1, default 1.0)` | `{ event_id }` | Emits `SoundEvent` into simulation; full §3 propagation applies (including NPC awareness). Designer / UGC use only; not callable by player Avatars to prevent spoofing footsteps. |
| `set_music_state` | `gm.host` only (Doc #26) | `region_id: RegionId`, `profile_overrides: Partial<StemMix>` | `{ ok: true, applied_at: ServerTick }` | Pushes a `MusicProfile` override onto the region's mix stack; auto-pops on session end or explicit `clear`. Cross-link Doc #26 GM tooling. |

```json
// play_sfx
{
  "name": "play_sfx",
  "input": {
    "envelope": "VerbEnvelope",
    "sound_id": "string",
    "position": { "x": "f32", "y": "f32", "z": "f32" },
    "volume": "f32?"
  },
  "returns": { "event_id": "UUID" }
}

// set_music_state
{
  "name": "set_music_state",
  "input": {
    "envelope": "VerbEnvelope",
    "region_id": "RegionId",
    "profile_overrides": {
      "ambient": "f32?", "tension": "f32?", "combat": "f32?", "virtue_tone": "f32?"
    },
    "transition_ms": "int?"
  },
  "returns": { "ok": "boolean", "applied_at": "ServerTick" }
}
```

Errors: `ERR_CAPABILITY` (player Avatars calling `play_sfx`), `ERR_INVALID_TARGET` (unknown `sound_id`), `ERR_RATE_LIMIT` (more than 10 `play_sfx` per second per caller).

### 11.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/audio/sfx_library` | `{ entries: SfxEntry[] }` — all available `SfxId`s with metadata (sound type, default radius, duration, source: official/ugc) | `inspect.read` |
| `forge://shard/{s}/audio/music_state(region_id)` | `{ active_profile: MusicProfile, current_mix: StemMix, override_stack: MixOverride[] }` | `inspect.read` |

Subscriptions on `music_state` deliver a `MusicStateChanged` event on every transition — useful for GM tooling and telemetry (Doc #28).

---

## 12. Phase 1 Prototype Scope

Per Doc #11 §3 audio row and Doc #10 §5/§7. Deliberately minimal; proves the propagation loop and dynamic-music skeleton end-to-end on the Britain vertical slice.

| Subsystem | In Scope | Deferred |
|---|---|---|
| Music | Original Ultima VII soundtrack loop integrated (per Doc #11); 2-stem dynamic mix (ambient + combat) | Tension stem, virtue_tone stem, story_arc_stage inputs, region-specific profiles beyond Britain |
| SFX library | 20+ contextual SFX (matches Doc #10 §7); covers door, footstep (4 surfaces), drop, attack (sword + axe + flesh + wood + stone variants), spell cast (Circle 1–3), fire crackle, water splash | Full verb-coverage matrix; magic Circle 4–8 SFX |
| Voice acting | 8 NPC voice lines for opening dialogue (matches Doc #11 §3 success proof "Meet Lord British, Iolo, and several classic NPCs"); covers Lord British greeting + 7 other principal openings | Full per-Response VO across the 15 Britain NPCs (Doc #17 §13); companion banter VO; TTS for UGC |
| Sound propagation | Footstep + ObjectDrop + CombatClash only; full §3.1 audibility math but only these three event types emit | Door sounds emitting to NPCs (rendered to player only Phase 1); spell-cast as awareness input; full §3.2 terrain attenuation table (Phase 1 = open-air only or full-block walls; no muffle math) |
| NPC awareness response | Curiosity + alert thresholds active for guards only (3 NPCs); other NPCs receive `Awareness` but no behavior wiring | Faction-wide alert propagation; investigate-then-search behavior |
| Stealth modifier | Active with DEX + footwear inputs only | Stealth skill, encumbrance, load_penalty |
| Replication | `SoundEvent` over `event` channel for the three propagating types; voice clip URI on `DialogueUpdate` | Music state replication (Phase 1 client computes locally from `time_of_day` + combat detection) |
| Accessibility | Subtitles on by default; 5 independent volume sliders | Visual SFX cues, audio-cue captions, mono downmix |
| MCP tools | None of §11 tools required for Phase 1 (matches Doc #14 §8 minimal-MCP posture) | All §11 tools deferred to Phase 2 |
| UGC SFX | Not accepted in Phase 1 | Per §10.2 from Phase 2 |

**Phase 1 success metric:** a player walking past a guard with metal boots wakes a sleeping NPC ("stealing a plate may wake a sleeping guard" canonical case from Doc #4 §3); the same player crouching with soft shoes (DEX 14, soft footwear) walks past unnoticed; and the music shifts from ambient to combat within one server tick of the first hostile entering audibility.

---

## 13. Open Questions

1. `[OPEN]` **Voice cast hiring.** Real actors vs. AI TTS for prototype 8 voice lines. Real actors give the BG-style charm; TTS is faster and cheaper for iteration. Trade-off informs the Phase 1 audio production budget. Working assumption: real actors for the 8 Phase 1 lines (cheap at that count, sets style anchor); TTS only for UGC NPCs in Phase 3+.
2. `[OPEN]` **Soundtrack licensing vs. commissioning.** Licensing the original Ultima VII soundtrack from EA / Origin estate is uncertain; alternative is commissioning new tracks in 1992 style (Doc #10 §5.1) from a chiptune-orchestral composer. Phase 1 demo prefers the original (per Doc #11 "original Ultima VII soundtrack loop"); Phase 2 production may need a hybrid.
3. `[OPEN]` **Sound-propagation perf budget.** Target < 0.5 ms per sim tick per region for §3.1 audibility computation across all NPCs. Worst case: explosion (24-tile radius) in a populated region (50 NPCs) requires 50 raycasts at < 10 µs each. Profiling needed; spatial hash on NPC positions (Doc #23) is the assumed accelerant.
4. `[OPEN]` **Whisper-volume sounds and stealth gameplay.** §4 lists `Whisper` at 1-tile radius with full block — appropriate for GM whispers (Doc #26) and stealth dialogue. Open: should stealth-skilled players hear whispers at 2 tiles? Should pickpocket attempts emit a whisper-class sound that an adjacent NPC may detect?
5. `[OPEN]` **Music adapting to GM-narrated scenes.** Doc #26 hosted GM sessions can override music via `set_music_state`. Open: should the GM be able to push a custom non-stem audio track (a one-shot dramatic cue) for a narrated moment? If so, does it count against UGC SFX 5-second cap or have a separate budget?
6. `[OPEN]` **Spatial audio for vertically-stacked floors.** §3.2 lists floor attenuation at 24 dB but only if `spatial_flags.through_floors` is set. Default for combat sounds: yes (so a battle on the floor below is audible from above) or no (cleaner mix)? Affects multi-story buildings and dungeon levels.
7. `[OPEN]` **UGC SFX style validator beyond length cap.** §10.2 notes manual review for Phase 1, automated classifier for Phase 3+. Open: does the classifier check for "Ultima VII feel" (chunky, physical, period) the way the visual style validator (Doc #10 §6) does for art? Risk of rejecting valid creative SFX vs. risk of off-style audio polluting shards.

---

## 14. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #10 §5 (style targets), Doc #4 §3 (sound-as-simulation) |
| §2 SFX Architecture | Doc #13 §2 (verb registry — verb-keyed SFX), Doc #22 §4 (event channel) |
| §3 Propagation Model | Doc #4 §3 (resolves "noises travel and alert nearby NPCs"), Doc #16 §9 (HostileAI alert), Doc #17 §8 (schedule interruption) |
| §4 Sound Types | Doc #4 §3, Doc #16 §3.2 |
| §5 Dynamic Music | Doc #10 §5.1, Doc #22 §3 (`time_of_day`), Doc #5 (Avatar Score input), Doc #26 (story_arc_stage) |
| §6 Voice Acting | **Resolves Doc #17 §14 [OPEN] item 1**; Doc #17 §2 (`Response.voice_clip`), Doc #17 §12.1 (`say_keyword` returns `voice_clip`), Doc #22 §4 (`DialogueUpdate`), Doc #10 §5.3 |
| §7 Avatar Voice | Doc #10 §5.3 (silent protagonist), Doc #15 §8 (companion roster), Doc #22 §16 (P2P voice [OPEN]) |
| §8 Replication | Doc #22 §4 (event channel — adds `SoundEvent`), Doc #22 §3 (tick rate envelope) |
| §9 Accessibility | Doc #17 §14 [OPEN] item 2 (LocalizedString — subtitle text) |
| §10 SFX Database | Doc #13 §2 (verb registry), Doc #7 (UGC tooling) |
| §11 MCP Additions | Doc #14 §5 (tools), Doc #14 §6 (resources), Doc #26 (GM `set_music_state`) |
| §12 Phase 1 | Doc #11 §3 audio row, Doc #10 §7 prototype scope, Doc #14 §8 (minimal MCP), Doc #17 §13 (15 NPCs roster) |
| §13 Open Questions | Doc #11 (production budget), Doc #23 (spatial hash), Doc #26 (GM tooling), Doc #29 (moderation hooks) |

---
