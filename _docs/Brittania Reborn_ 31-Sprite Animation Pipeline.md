Document #31: Sprite Animation Pipeline
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Art Pipeline Lead]
Status: Living Technical Reference — Normative spec for the pixel-art sprite asset format, animation state machine, frame budget, UGC import pipeline, runtime rendering integration with UE5, and animation-state replication. Implements the visual style targets in Doc #10 §2–§4 and §6.

Depends on: #4 Simulation & Interaction §2 (entity state drives visual state), #7 UGC Modding §2 (custom asset import), §5 (style validator), #10 Art & Audio Style Bible §2 (pixel-art rules), §3 (character animation), §4 (environment objects), §6 (style validator), §7 (Phase 1 Britain visual slice), #11 Phase 1 Vertical Slice (15 NPCs, dynamic lighting), #13 Core Schema §1 (Entity, components), §2 (verb registry), §4 (dispatch contract — animation as side effect), #14 MCP Server Surface §5 (tool envelope), §6 (resources), #22 Network Protocol & Replication §4 (event channel; state delta replication), §5 (per-entity replication cadence), #23 Pathfinding & Spatial Systems §2 (Direction8, footprint), §5.6 (footstep audio side effect), #27 Audio System §10.1 (verb-keyed SFX hooks — frame-emitted sound IDs), #41 Engine & Stack ADR.

> **Updated 2026-05-04 per Doc #41.** The asset pipeline must DUAL-EMIT for two clients: UE5 (Paper2D / SlateUI) and TS web (PixiJS). A single source (Aseprite + manifest YAML) builds artifacts for both targets. The animation FSM lives in EACH CLIENT — the Rust authoritative server emits entity state only ("ATTACKING", "IDLE", duration); each client picks blends and timings independently. See §2.5 Dual-Emit Requirement and §5.5 Per-Client FSM (per Doc #41).

Heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[BR]` = original to Britannia Reborn.

---

## 1. Animation Philosophy

Sprites are the canonical visual representation of every Entity. They are pixel-art at the original 320×200 base resolution `[BG]` upscaled crisply to modern displays (Doc #10 §2.2), with a hand-crafted look preserved in every frame. Animation is per-Entity simulation state — never client-side flair — replicated as compact state IDs on the same dispatcher path as every other side effect (Doc #13 §4), not as raw frame data. The pipeline is `[BG]` baseline (palette-locked sprite sheets, 8-direction facing, 8–12 fps frame counts) plus `[BR]` modern enhancements: dynamic per-pixel lighting via shader (torches, fires, spells modulate the rendered sprite), sub-pixel positioning so motion appears smooth without losing chunky pixel identity, and an overlay-state stack so simulation conditions (`on_fire`, `wet`, `poisoned`) compose visually with base motion states without per-condition art.

---

## 2. Sprite Asset Format

### 2.1 File format

| Property | Value |
|---|---|
| Image format | PNG, palette-indexed (PNG color type 3) |
| Bit depth | 8-bit (256-color palette) |
| Color palette | Locked to Doc #10 §2.2 Ultima VII palette OR an approved expansion palette (§11) |
| Alpha | 1-bit transparency via palette index 0 reserved as "transparent" |
| Anti-aliasing in source | **Forbidden** (Doc #10 §2.2 hand-crafted look); runtime upscale shader is the only allowed smoothing |

### 2.2 Sidecar metadata

Per-sprite metadata in JSON adjacent to the PNG:

```ts
type SpriteMetadata = {
  id:                  SpriteId            // stable; e.g., "iolo_walk_n_3"
  archetype_ref:       AnimationArchetypeId
  dimensions:          { w: int, h: int }  // source pixels; max 128×128 (§11)
  anchor_point:        { x: int, y: int }  // foot/center pivot, in source pixels
  hit_box:             { x: int, y: int, w: int, h: int }  // mouse-pick region, source pixels
  color_palette_id:    PaletteId           // "uv7_base" or approved expansion id
  source_credit:       string              // creator id; "origin_systems_1992" for legacy
  origin:              "official" | "ugc" | "legacy"
}

type SpriteId             = string
type AnimationArchetypeId = string         // e.g., "anim.npc.iolo", "anim.creature.skeleton"
type PaletteId            = string         // "uv7_base" | "uv7_expansion_yew" | ...
```

### 2.3 Storage layout

```
assets://sprites/{archetype}/manifest.json                 # AnimationArchetype (§3) + index of frames
assets://sprites/{archetype}/{state}/{frame}.png           # individual frames + sidecar JSON
assets://sprites/{archetype}/{state}/{frame}.json          # SpriteMetadata for that frame
assets://sprites/{archetype}/palette.act                   # per-archetype palette reference (Adobe Color Table)
assets://sprites/{archetype}/normals/{state}/{frame}.png   # optional normal map sidecar (§8)
```

Legacy 1992 assets live under a separate namespace (§12):

```
assets://legacy/sprites/{shape_id}/{frame}.png
```

### 2.4 File naming convention

`{archetype_short}_{state}_{direction?}_{frame_idx}.png`

| Example | Decode |
|---|---|
| `dagger_idle_0.png` | item.dagger, state=idle, frame 0 (no direction — items are facing-agnostic) |
| `iolo_walk_n_3.png` | npc.iolo, state=walk, facing N, frame 3 |
| `skeleton_attack_e_2.png` | creature.skeleton, state=attack, facing E, frame 2 |
| `door_open_0.png` | item.door, state=open, frame 0 (facing-agnostic) |
| `fireball_loop_5.png` | effect.fireball, state=loop, frame 5 |

Direction omitted for facing-agnostic states. Direction tokens use the Doc #23 §2 `Direction8` set: `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw`.

### 2.5 Dual-Emit Requirement (per Doc #41)

Per Doc #41, the same asset source must produce importer artifacts for BOTH the UE5 production client and the TS/PixiJS web client. The pipeline is single-source, dual-emit.

- **Single source of truth:** Aseprite (`.aseprite`) files plus a per-archetype manifest (`manifest.yaml`) describing states, frame counts, fps, anchors, hit boxes, frame-emitted sound/event IDs, and overlay archetype references. Designers edit Aseprite + YAML and never the per-engine artifacts directly.
- **Build step emits both artifacts in lockstep:**
  - **(a) UE5 importer artifact.** A texture atlas (PNG) plus either a `.uasset` package authored by an editor-time UE5 build commandlet OR a JSON-driven importer manifest the UE5 client loads at runtime through Paper2D / SlateUI. The choice between `.uasset` pre-bake and runtime-JSON is per-asset-class (legacy assets pre-bake; UGC stays JSON-driven).
  - **(b) PixiJS importer artifact.** A texture atlas (PNG) plus a JSON spritesheet in the standard `pixi-spritesheet` shape (frames, animations, meta) that PixiJS `Spritesheet` consumes directly.
- **One canonical manifest format consumed by both.** The same `manifest.yaml` is the input; both emitters are pure projections of it. There is no UE5-only field and no PixiJS-only field in the canonical manifest — engine-specific concerns live entirely inside the emitters.
- **CI parity check.** CI must validate that both emitters produce **visually identical output** for a fixed sample set (golden frames per state per direction for a representative archetype). The parity test renders one frame from the UE5 artifact and the same frame from the PixiJS artifact through a headless renderer, diffs them at the pixel level, and fails the build on any discrepancy beyond a tight tolerance (palette-locked sprites should diff zero pixels barring sub-pixel filter rounding).
- **No engine-only assets.** A sprite that exists only for UE5 or only for PixiJS is a Doc #41 violation. The TS/PixiJS web client is a permanent web-thin-client and must remain visually feature-complete with UE5; it is never console, never authoritative, and never has exclusive features (per Doc #41), but symmetrically it is never asset-starved relative to UE5.

---

## 3. Animation State Schema

`AnimationComponent` attaches to existing Entity (Doc #13 §1) — additional optional component alongside `PhysicalComponent`, `StateComponent`, etc.

```ts
type AnimationStateId    = string       // e.g., "walk_n", "attack_e", "idle_s", "use", "sit"
type OverlayStateId      = string       // e.g., "on_fire", "wet", "poisoned", "magic_aura"
type FrameRef            = SpriteId     // resolves via assets:// (§2.3)
type FrameIdx            = int          // 0-based index into AnimationState.frames

type AnimationComponent = {
  archetype_ref:         AnimationArchetypeId    // [A] which AnimationArchetype to drive from
  current_state:         AnimationStateId        // [I*] replicated; e.g., "walk_n", "attack_e"
  current_frame:         int                     // [I]  client-interpolated; NOT replicated
  frame_progress_ms:     int                     // [I]  client-interpolated; NOT replicated
  facing:                Direction8              // [I*] replicated; matches Doc #23 §2
  animation_speed_mult:  float                   // [I*] 0.5 = slow, 2.0 = fast; default 1.0
  overlay_states:        OverlayStateId[]        // [I*] stacks visually over base
}

type AnimationArchetype = {
  id:                AnimationArchetypeId
  name:              string
  states:            Map<AnimationStateId, AnimationState>
  default_state:     AnimationStateId            // typically "idle_s"
  transitions:       AnimationTransition[]       // see §3.3
  overlay_archetypes: OverlayStateId[]            // approved overlays for this archetype
}

type AnimationState = {
  id:                  AnimationStateId
  name:                string
  frames:              FrameRef[]
  fps:                 int                                        // 6–12 (§11; Doc #10 §3)
  loop:                bool
  interruptible:       bool                                       // §5; can higher-priority transitions preempt mid-state
  emit_sound_at_frame: Map<FrameIdx, SoundId> | null              // e.g., footstep on frame 2 + 6 (Doc #27 §10.1)
  emit_event_at_frame: Map<FrameIdx, EventId> | null              // e.g., "hit_landed" at frame 4 of attack
}

type AnimationTransition = {
  from_state:        AnimationStateId | "*"      // "*" matches any state
  to_state:          AnimationStateId
  trigger:           AnimationTrigger
  priority:          int                         // higher preempts lower; hostile interrupt > idle
}

type AnimationTrigger =
  | { kind: "verb",          verb: VerbId }                       // dispatcher side-effect (§6)
  | { kind: "state_change",  component: ComponentId, field: string, value: any }
  | { kind: "timer_elapsed", state: AnimationStateId }            // fires after non-loop state finishes
  | { kind: "overlay_added", overlay: OverlayStateId }
  | { kind: "overlay_removed", overlay: OverlayStateId }
```

### 3.1 SoundId / EventId

`SoundId` resolves to Doc #27 §2 `SfxId`. `EventId` is an opaque tag consumed by the dispatcher; `"hit_landed"` is the canonical example, fired mid-attack-animation to schedule the damage write at the visually-correct frame rather than at verb-commit time.

### 3.2 Direction-keyed states

A "directional state" is a family of `AnimationStateId`s sharing a base name with a direction suffix: `walk_n`, `walk_ne`, ..., `walk_nw` (8 entries). The dispatcher (§6) resolves the suffix from `AnimationComponent.facing` at transition time; designers author 8 sub-states per directional state.

### 3.3 Transition resolution

```
on_animation_event(actor, event):
  candidates = archetype.transitions.filter(t =>
    (t.from_state == "*" or t.from_state == actor.current_state) and
    matches(t.trigger, event))
  selected = candidates.sortBy(t => -t.priority).first
  if selected:
    if not actor.current_state_definition.interruptible and selected.priority <= current_priority:
      return                                                      // current state dominates
    actor.current_state = resolve_directional(selected.to_state, actor.facing)
    actor.current_frame = 0
    actor.frame_progress_ms = 0
    replicate_state_change(actor)                                  // §9
```

---

## 4. Animation States per Entity Archetype

Required minimum animation sets per archetype class. Authoring may add more; runtime tolerates missing optional states (falls back to default per §6).

| Archetype Class | Required States | Direction Coverage | Approx. Frame Sets |
|---|---|---|---|
| **NPCs / Avatars** (Doc #15 companion roster) | `idle`, `walk`, `attack`, `use`, `sit`, `sleep`, `dead`, `talk_gesture`, `cast` | 8-dir for `idle/walk/attack/use/cast`; facing-agnostic for `sit/sleep/dead/talk_gesture` | ~50 (5 dir-states × 8 dirs + 4 single-dir) |
| **Hostile creatures** (Doc #16) | `idle`, `walk`, `attack`, `hurt`, `dead` | 8-dir for `idle/walk/attack`; facing-agnostic for `hurt/dead` | ~25 (3 × 8 + 2) |
| **Static objects** (Doc #10 §4) | `idle` | facing-agnostic (1 frame typically) | 1 base + state variants per Doc #13 §1.2 (`open/closed`, `lit/unlit`, `broken/intact`); each variant is a distinct AnimationState |
| **Effects** (spells, fire, smoke) | `spawn`, `loop`, `despawn` | facing-agnostic | 3 short sequences |
| **Containers / doors** | `closed_idle`, `open_idle`, `opening`, `closing` | facing-agnostic (but per-orientation variants for doors: NS/EW) | 4 |

Frame counts per state target Doc #10 §3 ("8–12 frames per action"); defaults: idle 4 frames @ 8 fps (subtle breathing/sway), walk 8 frames @ 10 fps, attack 6 frames @ 12 fps, use 4 frames @ 8 fps, hurt 3 frames @ 10 fps non-loop, dead 6 frames @ 8 fps non-loop ending on a held final frame.

---

## 5. Animation State Machine Execution

### 5.1 Tick model

| Loop | Rate | Source | Notes |
|---|---|---|---|
| Animation tick | 60 Hz | client-side | Advances `frame_progress_ms`; emits frame-keyed sounds/events on local crossings; renders via UE5 |
| Server authoritative state | 20 Hz (Doc #22 §3) | server sim tick | Owns `current_state`, `facing`, `animation_speed_mult`, `overlay_states` |
| State change replication | event-driven | Doc #22 §4 `event` channel | Sparse — fires only on transitions, not per-frame |

The client interpolates `current_frame` and `frame_progress_ms` locally between received `current_state` snapshots. Frame advance:

```
animation_tick(actor, dt_ms):
  state_def = archetype.states[actor.current_state]
  effective_fps = state_def.fps * actor.animation_speed_mult
  ms_per_frame = 1000 / effective_fps
  actor.frame_progress_ms += dt_ms
  while actor.frame_progress_ms >= ms_per_frame:
    actor.frame_progress_ms -= ms_per_frame
    actor.current_frame += 1
    fire_frame_emissions(state_def, actor.current_frame)         // local SFX + events
    if actor.current_frame >= state_def.frames.length:
      if state_def.loop:
        actor.current_frame = 0
      else:
        actor.current_frame = state_def.frames.length - 1        // hold last frame
        on_animation_event(actor, { kind: "timer_elapsed", state: actor.current_state })
```

Frame-emitted events on the server side are deduplicated against client-side firing: server is authoritative for damage/sound-propagation `Awareness` writes (Doc #27 §3.4); client local emissions are render-only (visual particle on the sword tip, etc.).

### 5.2 Verb-driven transitions

The verb dispatcher (Doc #13 §4) calls `on_animation_event` as a side-effect channel after `apply_writes`. Examples:

| Verb (Doc #13 §2) | Animation transition |
|---|---|
| `attack(target)` | `attack_{facing}` state; on `timer_elapsed` → `idle_{facing}` |
| `move_to` (in-flight, per Doc #23 §5.4) | `walk_{facing}` while MoveTask active; on completion → `idle_{facing}` |
| `use(target)` | `use_{facing}` (one-shot); on `timer_elapsed` → `idle_{facing}` |
| `cast_spell` | `cast_{facing}` (one-shot); on `timer_elapsed` → `idle_{facing}` |
| `talk(npc)` | NPC: `talk_gesture` (loop) while DialogueSession active; on dialogue close → `idle_{facing}` |
| `examine`, `drop` | no animation transition (silent — pickup is mute by tradition, Doc #27 §10.1) |
| `sleep` | `sleep` state (loop) until next schedule slot |

### 5.3 Overlay states

Overlays are independent visual layers stacked over the base state. Each overlay has its own `AnimationState`-shaped definition (frames, fps, loop) but renders composited over the base sprite.

```
render_entity(actor):
  base_sprite = resolve_frame(archetype.states[actor.current_state], actor.current_frame)
  draw(base_sprite, actor.position)
  for overlay in actor.overlay_states:
    overlay_def = overlay_archetypes[overlay]
    overlay_frame = resolve_overlay_frame(overlay_def, actor.frame_progress_ms)
    draw(overlay_frame, actor.position, blend_mode=overlay_def.blend)
```

Default overlay set:

| OverlayStateId | Trigger (Doc #13 §1.2 `StateComponent` field) | Visual |
|---|---|---|
| `on_fire` | `state.on_fire == true` | Animated flame sprite over entity, additive blend |
| `wet` | `state.wet == true` | Water-drip overlay, normal blend at 60% alpha |
| `poisoned` | `state.poisoned == true` | Greenish tint overlay, multiply blend |
| `magic_aura` | spell-effect-applied | Per-spell glow, additive blend |
| `lit_torch_held` | held item is `state.lit == true` torch | Light source rendered at hand anchor (drives lighting per §8) |

Overlay add/remove is dispatched via §3 `AnimationTrigger.kind == "overlay_added" | "overlay_removed"` from the dispatcher's state-change side effect (Doc #13 §4 channel 1, after Persistence write).

### 5.4 Damage interrupt

The "hurt" state preempts only non-`interruptible` states when damage exceeds a threshold:

```
on_damage_dealt(actor, dmg):
  hurt_threshold = max(5, actor.combat.hp_max * 0.10)            // 10% HP or 5, whichever larger
  if dmg < hurt_threshold: return                                 // no visible flinch
  current_def = archetype.states[actor.current_state]
  if not current_def.interruptible:
    if current_def.priority < HURT_PRIORITY:
      transition_to("hurt", priority=HURT_PRIORITY)
  else:
    transition_to("hurt", priority=HURT_PRIORITY)
```

`HURT_PRIORITY = 80`. `attack` priority = 60 (interruptible by hurt), `cast_spell` priority = 70 (interruptible by hurt at higher threshold). `dead` priority = 100 (preempts everything; sets `interruptible=false` so nothing else can transition out).

### 5.5 Per-Client FSM (per Doc #41 boundary table)

Per Doc #41's client/server boundary table, the animation FSM lives in **each client**, not on the server.

- **Server emits entity STATE ONLY.** The Rust authoritative server emits a coarse-grained state token per entity — for example `ATTACKING`, `IDLE`, `WALKING`, `HURT`, `CASTING`, `DEAD` — together with the `facing` direction, an `animation_speed_mult`, the active `overlay_states` set, and (where the state has a finite server-side duration) a duration in milliseconds. This is the entirety of the animation-relevant payload on the wire (the `[I*]` fields enumerated in §9.1).
- **Each client owns its own FSM.**
  - **UE5 client** runs the state machine inside the Paper2D / SlateUI animation graph; UE5 picks the concrete frame sequence, blend timings, and any cosmetic blends between sub-states from its local archetype data.
  - **TS / PixiJS web client** runs the state machine in a PixiJS animation controller; it picks frame sequences and timings from the same canonical manifest (§2.5) but using its own controller code.
- **Frame-level decisions are client-local.** Which exact frame plays at a given wall-clock instant, how blends interpolate, when sub-pixel anchor offsets resolve, and any cosmetic flourishes (idle micro-animations, breath cycles) are each client's responsibility. Two clients viewing the same `ATTACKING` state at the same `ServerTick` may show slightly different in-between frames; this is expected and explicitly permitted by Doc #41.
- **Server never sends `current_frame`.** Per §9.2, `current_frame` and `frame_progress_ms` are not on the wire. This is reaffirmed by Doc #41: per-frame data on the wire would imply a server-side FSM, which is forbidden.
- **No animation-driven authority leak.** Frame-emitted events (e.g. `"hit_landed"` at frame 4 of an attack) remain client-side render hints; the **server** decides damage timing independently and emits the canonical damage write through the normal dispatcher path. A client that fails to render `hit_landed` does not change the simulation outcome.

---

## 6. Sprite-Entity Binding

### 6.1 Archetype declaration

Each Entity archetype declares an `animation_archetype_ref`:

```ts
// extension to Doc #13 §1 archetype definition
type EntityArchetype = {
  // ...existing fields...
  animation_archetype_ref?: AnimationArchetypeId    // [A] optional; entities without animation render as static fallback
}
```

At spawn time, if the archetype declares `animation_archetype_ref`, an `AnimationComponent` is attached with archetype defaults (`current_state = archetype.default_state`, `facing = "S"`, `animation_speed_mult = 1.0`, `overlay_states = []`).

### 6.2 Dispatcher integration

Animation-state changes are a Doc #13 §4 side-effect channel, not a separate system. The fixed dispatch order is preserved:

```
dispatch(inv):
  1. validate(inv)
  2. preconditions(inv)
  3. effects = resolve_effects(inv)
  4. virtue_delta = score_virtues(inv, effects)
  5. apply_writes(effects, virtue_delta)
  6. emit_side_effects(inv, effects):
       a. Virtue Engine                      (Doc #13 §4 channel 1)
       b. Persistence Layer                  (channel 2)
       c. Replication Layer                  (channel 3)
       d. Sound Propagation                  (channel 4 — Doc #27 §3)
       e. Schedule Interruption              (channel 5)
       f. UGC Script Hooks                   (channel 6)
       g. MCP Telemetry                      (channel 7)
       h. Animation Transitions              (channel 8 — NEW; this doc)
```

Animation lives at the end deliberately: simulation truth (HP, position, ownership) is committed first; the visual reaction is consequence, never cause. **No animation-driven game logic.** A frame-emitted `"hit_landed"` event still routes through the dispatcher as a normal verb (`attack` continuation), not a side-channel mutation.

### 6.3 Facing updates

`facing` is updated by the dispatcher on movement (Doc #23 §5.4 — the direction of the next tile-boundary crossing) and on attack/use/talk verbs (face the target). It is `[I*]` replicated alongside `current_state`.

---

## 7. Frame Budget & Memory

### 7.1 Per-character sprite-sheet budget

Worst-case canonical character (full 8-direction full state set):

| Component | Count | Per-frame cost |
|---|---|---|
| States (8-dir) | 5 (idle, walk, attack, use, cast) × 8 dirs = 40 | — |
| States (facing-agnostic) | 4 (sit, sleep, dead, talk_gesture) | — |
| Avg frames per state | 8 | — |
| Total frames | (40 + 4) × 8 ≈ **352 frames** | — |
| Per-frame size (32×32 RGBA, palette-indexed → 1 byte/px + 1 KB palette amortized) | — | 1 KB |
| **Per-character total** | — | **~352 KB; budget 512 KB to allow normal-map sidecars + headroom** |

NPCs / Avatars target **512 KB per character** sprite memory. Smaller archetypes (creatures: ~25 frame sets ≈ 200 KB; static objects: < 32 KB) are well under.

### 7.2 Per-region preload budget

| Tier | Budget | Eviction |
|---|---|---|
| Per-region resident sprite memory | **50 MB** | LRU evict beyond budget; recently-rendered always kept; hostile creatures pinned during combat |
| Per-shard global sprite cache (across all subscribed regions) | 200 MB | LRU across regions; region handoff triggers eviction sweep |
| UGC sprite per-archetype cap | **256 KB** (Doc #7 §2 budget posture) | Submission rejected if exceeded (§10) |

Britain town's 15 NPCs (Doc #17 §13) at ~512 KB each = 7.5 MB; 4 hostile creature archetypes at ~200 KB = 0.8 MB; ~200 static object archetypes at ~16 KB avg = 3.2 MB; total ~12 MB resident — comfortably under the 50 MB region budget.

### 7.3 Streaming

Sprites are downloaded on region subscribe (Doc #22 §4 `Subscribe`); CDN-served per the Doc #27 §2 pattern. Sprites for entities entering interest set mid-session stream on-demand with a 200 ms target latency (fall back to placeholder silhouette if not ready); streaming pre-fetch hint fires 500 ms before an entity enters the client's region from a neighbor.

---

## 8. Lighting Integration

### 8.1 Two-tier model

Per Doc #10 §2.3 (dynamic real-time lighting) and Doc #23 §7.2 (lighting modulates LOS).

| Tier | Asset | Rendering |
|---|---|---|
| **Tier A: Normal-map sprite** | Optional `normals/{state}/{frame}.png` sidecar (RGB-encoded surface normal per pixel) | Per-pixel deferred lighting; sprite responds correctly to torch direction, sub-pixel light falloff, colored magic light |
| **Tier B: Palette-shift fallback** | None (palette-indexed sprite only) | Runtime palette shift: light intensity at sprite position drives a palette-LUT swap (dim regions of the palette substituted in shadow); applied as a per-tile tint (faster, cheaper, no normal data) |
| **Tier C: Ambient tint only** | None | Uniform region-wide ambient color from time-of-day; no dynamic lights affect the sprite. Used only when neither normal map nor palette LUT is authored. |

Authoring rule: Tier A is the goal for hero NPCs and player Avatar. Tier B is acceptable for background NPCs and creatures. Tier C is the legacy-asset default (§12).

### 8.2 Light source registration

Entities with `state.lit == true` (torches, lanterns, fires) and active spell effects (Doc #16 fireball, light spell) register themselves as light sources via the rendering integration:

```ts
type LightSource = {
  position:        SubTilePos
  intensity:       float          // 0..1
  color:           { r: int, g: int, b: int }   // 0..255 per channel; warm orange for fire, blue-white for cold spells
  radius_tiles:    float
  flicker:         FlickerProfile | null        // amplitude + freq for torches/fires
  attached_to:     EntityId | null              // null = static (placed torch); else moves with entity
}
```

Light sources are computed server-side (deterministic; Doc #4 §3 darkness affects LOS) and replicated as `[I*]` fields; client renders the lighting effect on sprites.

### 8.3 Style preservation

Lighting modulation is a **post-pass on the upscaled sprite**, never a modification of the source pixels. The Doc #10 §6 style validator (§11) sees only source pixels; runtime shading is not a style violation.

---

## 9. Network Replication of Animation

### 9.1 Replicated fields

Per `AnimationComponent`, only the `[I*]` fields:

| Field | Wire size | Update trigger |
|---|---|---|
| `current_state` | ~2 bytes (16-bit string-table index) | On state transition |
| `facing` | 1 byte (Direction8 enum) | On facing change (movement step or verb retarget) |
| `animation_speed_mult` | 4 bytes (f32); rare | On haste/slow effect apply/remove |
| `overlay_states` | variable; ~2 bytes per overlay (16-bit OverlayStateId index); typically 0–2 overlays | On overlay add/remove |

### 9.2 Not replicated

`current_frame` and `frame_progress_ms` are **client-interpolated only** (§5.1). The server does not send per-frame data; clients compute frame index locally from `current_state` start time and `animation_speed_mult`.

Clock drift between clients on the same state shows as ≤ 1 frame phase difference, which is visually invisible at 8–12 fps (≈ 80–125 ms per frame; well under perception threshold for unsynchronized characters).

### 9.3 Channel and cadence

| Property | Value |
|---|---|
| Channel | Doc #22 §4 `event` (reliable, unordered) for state-change deltas; piggyback on existing `EntityDelta` for `facing` updates inside the `state` channel |
| Update rate | Event-driven only (no per-frame traffic) |
| Wire shape | New `ServerMessage` variant: `{ kind: "AnimationStateChange", entity_id, current_state, facing, animation_speed_mult?, overlay_states? }` — deltas only (omit unchanged fields) |
| Bandwidth budget | < **100 bytes/sec per visible moving entity**; well under Doc #22 bandwidth budgets — animation state changes are far sparser than position updates |
| Initial state on subscribe | Full `AnimationComponent` `[I*]` snapshot included in the entity's spawn delta on region join |

For 20 visible NPCs all in motion, animation traffic ≈ 2 KB/s/client — negligible compared to position deltas (Doc #22 §5; ~20 KB/s for 20 NPCs at 5 Hz position updates).

### 9.4 Spawn / despawn

`EntitySpawn` (Doc #22 §4 `event` channel) carries the initial `AnimationComponent` `[I*]` snapshot. `EntityDespawn` triggers client-side `dead` state hold or fade-out per archetype rules (corpses persist with `dead` state per Doc #4 §4 decay timer; ephemeral effects despawn by setting `current_state = "despawn"` first, letting that one-shot animation play, then removing the entity).

---

## 10. UGC Sprite Import Pipeline

Extends Doc #7 §2 (custom asset import) and Doc #7 §5 (style validator integration).

### 10.1 Submission flow

```
1. Creator uploads PNG frames + sidecar JSON via in-game editor or external tool.
2. Server-side Validator pass (§11):
     a. Palette compliance check
     b. Dimension limits (max 128×128 per frame; integer multiple of 8)
     c. Frame count and fps bounds (≤ 12 fps; 1 ≤ frames ≤ 16 per state)
     d. File size cap (256 KB per archetype total)
     e. Outline / silhouette readability check (1-pixel hard outline required for foreground entities)
     f. Anti-aliasing detection (color count and edge gradients)
3. Auto-rejection on validator failure with diagnostics (specific pixel coordinates of palette violations, outline gaps, etc.)
4. On pass: Manual moderation queue (Doc #29) for content review.
5. On approval: tagged with creator_id; visible in style-validated browse panel; assigned `assets://sprites/ugc/{shard}/{creator_id}/{archetype_id}/...` namespace.
```

### 10.2 Editor support

The in-game editor (Doc #7 §2 "Avatar's Studio") provides:

- Real-time validator feedback as the creator paints.
- Palette picker locked to Doc #10 §2.2 palette + approved expansions (region-tagged).
- Frame timeline scrubber respecting fps cap.
- Direction-mirror tool: paint one direction, auto-generate horizontal-mirror for opposite (W ↔ E, NW ↔ NE, SW ↔ SE; N and S require unique authoring).
- Onion-skin previous/next frame display.

### 10.3 Validator diagnostics

```ts
type ValidatorDiagnostic = {
  severity:     "error" | "warning"
  rule_id:      string                  // e.g., "palette.unauthorized_color", "outline.missing"
  frame_id:     SpriteId | null
  pixel_coord:  { x: int, y: int } | null
  message:      string                  // human-readable; localized via Doc #33 (when ready)
}

type ValidatorResult = {
  passed:       bool
  diagnostics:  ValidatorDiagnostic[]
}
```

Diagnostics surface in-editor as overlay markers on the offending pixels.

---

## 11. Style Validator Rules

Formalizes Doc #10 §6.

| Rule ID | Check | Failure severity |
|---|---|---|
| `palette.unauthorized_color` | Every pixel must match the locked palette OR an approved expansion `PaletteId` | error |
| `palette.expansion_unapproved` | Expansion palette referenced is not in the shard's `approved_palettes` list | error |
| `dimension.max_size` | Frame ≤ 128×128 source pixels | error |
| `dimension.multiple_of_8` | Width and height integer multiples of 8 | error |
| `fps.bounds` | Animation fps in `[6, 12]` (Doc #10 §3 typical 8–12) | error |
| `frame_count.bounds` | 1–16 frames per state | error |
| `outline.foreground_required` | Foreground entities (NPCs, creatures, key items) must have 1-pixel hard outline (palette index 0 transparent OR designated outline color in adjacent pixel of every silhouette edge) | error |
| `anti_alias.forbidden` | No anti-aliased pixels in source (detected via gradient analysis on edge transitions) | error |
| `proportion.chunky_pixel` | Aspect ratio matches archetype-class template (chunky pixel style, Doc #10 §3 — e.g., humanoid head ~1/4 of body height) | warning |
| `file_size.archetype_cap` | UGC archetype total ≤ 256 KB (§7) | error |
| `anchor.in_bounds` | `anchor_point` within frame `dimensions` | error |
| `hit_box.in_bounds` | `hit_box` rectangle within frame `dimensions` | error |

Errors block submission; warnings log but allow.

---

## 12. Pre-existing 1992 Asset Extraction

### 12.1 Pipeline

Original Ultima VII assets are extracted via the **Pentagram / Exult** community tooling pipeline (community-built tools to read `SHAPES.FLX`, `GUMPS.FLX`, `MAINSHP.FLX`, `PALETTES.FLX`, etc.). The extraction step is run **offline** during build, never at runtime.

```
build-time pipeline:
  1. exult/pentagram extractor → raw frames + palette + frame-group metadata
  2. converter script → BR sprite manifest + per-frame PNGs + sidecar JSON
  3. assigned to assets://legacy/sprites/{shape_id}/...
  4. legacy AnimationArchetype manifests authored by hand (mapping shape_id → BR animation states)
```

### 12.2 Namespace and edit policy

| Property | Value |
|---|---|
| Namespace | `assets://legacy/sprites/{shape_id}/...` |
| Editable by UGC | **No** (read-only canonical asset) |
| Reference-able by archetype declarations | **Yes** (an archetype's `frames` list may name a `legacy://` SpriteId) |
| Style validator | Skipped (legacy assets are by definition canonical and pre-approved) |
| Lighting tier | Tier C (ambient tint) by default; Tier B (palette-shift) added per-archetype as art polish budget allows |

### 12.3 Licensing

Per Doc #1 §5 (license alignment with EA / Origin Systems): legacy asset shipping in BR requires explicit license; until that is secured (`[OPEN]` §15 item 6), the build pipeline produces a non-shippable internal-only build with legacy assets in place, and a parallel asset-replacement plan stages original BR sprites authored from scratch in the same style. The animation-state schema is identical regardless of asset source; only the underlying sprite frames differ.

---

## 13. MCP Surface Additions

> Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 13.1 New Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `submit_sprite` | `ugc.author` | `archetype_id: AnimationArchetypeId`, `frame_data: { state: AnimationStateId, direction?: Direction8, frame_idx: int, png_b64: string }[]`, `sidecar: SpriteMetadata[]`, `manifest: AnimationArchetype` | `{ ok: bool, validator: ValidatorResult, archetype_uri?: string }` | On pass: persists to `assets://sprites/ugc/{shard}/{creator_id}/{archetype_id}/...`; queues for Doc #29 moderation |
| `set_animation_state` | `gm.host` (Doc #26) | `entity_id: EntityId`, `state_id: AnimationStateId`, `facing?: Direction8`, `overlay_states?: OverlayStateId[]` | `{ ok: bool, applied_at: ServerTick }` | Forces `AnimationComponent.current_state` (and optional fields) on the target entity, bypassing normal verb-driven transitions. Intended for narrative GM use ("make the NPC kneel during this scene"). Subject to Doc #29 audit log. |

```json
// submit_sprite
{
  "name": "submit_sprite",
  "input": {
    "envelope": "VerbEnvelope",
    "archetype_id": "AnimationArchetypeId",
    "frame_data": [
      {
        "state":     "string",
        "direction": "Direction8?",
        "frame_idx": "int",
        "png_b64":   "string"
      }
    ],
    "sidecar":  "SpriteMetadata[]",
    "manifest": "AnimationArchetype"
  },
  "returns": {
    "ok":            "boolean",
    "validator":     "ValidatorResult",
    "archetype_uri": "string?"
  }
}

// set_animation_state
{
  "name": "set_animation_state",
  "input": {
    "envelope":       "VerbEnvelope",
    "entity_id":      "EntityId",
    "state_id":       "AnimationStateId",
    "facing":         "Direction8?",
    "overlay_states": "OverlayStateId[]?"
  },
  "returns": {
    "ok":         "boolean",
    "applied_at": "ServerTick"
  }
}
```

Errors: `ERR_CAPABILITY` (non-`ugc.author` / non-`gm.host` callers), `ERR_VALIDATOR_FAIL` (`submit_sprite` validator rejection — diagnostics in `validator.diagnostics`), `ERR_INVALID_TARGET` (unknown entity or state ID), `ERR_RATE_LIMIT` (more than 1 `submit_sprite` per 10 s per creator; more than 5 `set_animation_state` per second per GM).

### 13.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/sprites/manifest` | `{ archetypes: AnimationArchetype[], total_count: int, by_origin: { official: int, ugc: int, legacy: int } }` — all available animation archetypes registered on the shard | designer / `ugc.author` |
| `forge://shard/{s}/sprites/{archetype_id}` | Full `AnimationArchetype` definition + frame URIs + `SpriteMetadata` per frame | designer / `ugc.author` |
| `forge://shard/{s}/entity/{id}/animation` | Live `AnimationComponent` snapshot (current_state, facing, animation_speed_mult, overlay_states, archetype_ref) | `inspect.read` |

Subscriptions on `entity/{id}/animation` deliver `AnimationStateChanged` events on every transition — useful for GM tooling and live-event moderation (Doc #29).

---

## 14. Phase 1 Prototype Scope

Per Doc #11 (12-week "Britain Alive") and Doc #10 §7 (Britain visual & audio vertical slice).

| Subsystem | In Scope | Deferred |
|---|---|---|
| Asset source | **Original UV7 sprite extraction for Britain town** fully functional via Pentagram/Exult pipeline (§12); legacy namespace populated | New BR-original sprites for replacement (license-dependent, §15 item 6) |
| NPC animation coverage | **15 NPCs (Doc #17 §13)** with `idle` + `walk` + `use` animations, 8-direction each | `attack`, `cast`, `talk_gesture`, `sit`, `sleep` for NPCs (deferred to Phase 2 along with full combat per Doc #16 §12) |
| Hostile creature coverage | **4 archetypes**: rat, skeleton, brigand, plus one dungeon variant (cave troll), each with `attack` + `hurt` + `dead` | Full creature roster, idle/walk for non-Britain creatures |
| Static objects | All Britain town objects (doors, chests, barrels, torches, signs, fountains) with required state variants per Doc #10 §4 | Procedural-region object variants |
| Effects | None in Phase 1 (no spells in combat scope per Doc #16 §12) | Spell effects, fire/smoke loops |
| Animation state machine | Full §5 execution; verb-driven transitions wired for `move_to`, `use`, `talk` (no `attack`/`cast` since combat deferred) | `attack`/`cast` transitions (Phase 2 along with combat); damage interrupt logic (Phase 2) |
| Direction-keyed states | 8-dir for `idle`/`walk`/`use` on all 15 NPCs | n/a |
| Overlay states | `lit_torch_held` only (player Avatar carrying torch in Britain at night) | `on_fire`, `wet`, `poisoned`, `magic_aura` overlays deferred |
| Lighting | **Tier B (palette-shift)** only — simple per-tile palette LUT swap based on light intensity; matches Doc #11 dynamic-lighting vertical slice | Tier A (normal maps) deferred to Phase 2; Tier C is the implicit fallback |
| Frame budget | 50 MB per-region budget enforced; LRU eviction wired | Per-shard 200 MB cross-region cap (Phase 2 multi-region) |
| UGC sprite submission | **Not in Phase 1.** Style validator scaffold deployed (§11 rules implemented and unit-tested) but `submit_sprite` MCP tool not exposed externally; only placement of existing sprites permitted via Doc #7 §2 editor | Full UGC sprite import deferred to Phase 2 (matches Doc #7 §6 prototype scope — placement only, no custom asset import in first demo) |
| MCP surface | None of §13 tools required for Phase 1 (matches Doc #14 §8 minimal-MCP posture); `forge://shard/{s}/sprites/manifest` resource available for designer inspection | `submit_sprite`, `set_animation_state` deferred to Phase 2/3 (Phase 3 for `set_animation_state` per Doc #26 GM session timing) |
| Network replication | `current_state` + `facing` deltas via `event` channel; initial snapshot on EntitySpawn; no `animation_speed_mult` (no haste/slow in Phase 1) | `overlay_states` deltas (only `lit_torch_held` Phase 1, replicated as `state.lit` on the held item, not as overlay), `animation_speed_mult` |

**Phase 1 success metric:** the player walks the Avatar across Britain town square (Doc #23 §14 metric); 15 scheduled NPCs visibly walk to scheduled locations using full 8-direction `walk` animation; the Avatar stands next to the blacksmith and uses the forge with a visible `use` animation; at night the Avatar holds a torch and the `lit_torch_held` light source casts a palette-shift light radius on nearby sprites; a guard on patrol uses 8-direction `walk` animation that smoothly faces the right direction at every tile-boundary crossing.

---

## 15. Open Questions

1. `[OPEN]` **Normal-map authoring tool / DCC pipeline.** Tier A lighting (§8.1) requires per-frame normal-map sidecars. Aseprite has community plugins (e.g., NormalMap-Online via export, Sprite Lamp integration); Krita supports painting normal maps natively. Decision needed before Tier A authoring begins. Working assumption: Aseprite + NormalMap2 plugin for Phase 2 NPC normal-map pass; Krita for environment objects.
2. `[OPEN]` **Palette expansion rules per region.** Doc #10 §2.2 mentions "approved expansion colors for new regions." Open: how many expansion colors per region, who approves them, are they additive (whole palette + N more) or substitutive (swap N base colors for N region colors)? Affects `PaletteId` taxonomy and validator `palette.expansion_unapproved` rule. Working assumption: additive, +16 colors max per region, audio-director-equivalent (visual director) approval per region.
3. `[OPEN]` **Multi-tile creature frame budget.** Dragons and other creatures with `volume_tile_footprint > {1,1}` (Doc #23 §3.1 — e.g., {3,2}) have visually larger sprites. Does a 4-tile dragon's per-character budget (§7.1) scale by footprint area (4× = 2 MB)? Single sprite at 128×128 max (§11) is tile-area-equivalent to 16 tiles, suggesting yes. Needs explicit budget rule and per-archetype cap revisit.
4. `[OPEN]` **fps tuning for TTS-driven UGC NPC voicing.** Doc #27 §6.5 notes Phase 3+ TTS for UGC NPCs. Lip-sync against TTS may need higher animation fps for the `talk_gesture` state (e.g., 24 fps mouth-shape sequence vs. the 6–12 fps cap §11). Either an exception is granted for the `talk_gesture` state (raise fps cap to 24) or lip-sync uses a separate overlay layer with its own cap. Decision deferred to Phase 3 TTS work.
5. `[OPEN]` **Pre-bake vs. runtime-bake palette swaps for character clothing dyes.** Doc #10 §3 limits Avatar customization to clothing dyes. Implementation choice: pre-bake N color variants per dye option (memory cost: linear in dye-option count; render cost: zero) vs. runtime palette swap (memory: 1× sheet; render: shader-based palette lookup per pixel per frame). Working assumption: runtime palette swap for the player Avatar (small set of equipped-armor variants × small dye palette = manageable shader cost); pre-bake for NPCs (fixed wardrobe per archetype, ship with one variant).
6. `[OPEN]` **Legal review for community Pentagram/Exult tooling integration.** §12.3. Pentagram and Exult are community projects with their own licensing terms. Using them as build-time tools to extract assets BR has an EA / Origin license for is presumed safe but needs counsel review. Working assumption: tools are MIT/GPL-compatible build dependencies and non-shipping; only the extracted assets (subject to BR's own EA license) ship.
7. `[OPEN]` **Sprite hot-reload during dev iteration.** Designers iterating in-editor want sub-second roundtrip from PNG save → in-game update without restart. Naive: file watcher + manifest invalidation. Risk: in-flight `MoveTask`s and live multiplayer sessions break if their referenced frames change mid-state. Proposal: hot-reload only in single-player / private-instance mode; persistent shards require designer push through the same UGC pipeline (§10) with mod-author capability gate. Phase 2 work; Phase 1 ships restart-required.
8. `[OPEN]` **Animation determinism for replay / rollback recovery.** Doc #22 references rollback recovery and Doc #23 §12.5 calls out A* determinism. Animation state changes are dispatcher side effects, so they are deterministic given the same verb sequence — but `animation_speed_mult` per haste spell and overlay add/remove timing must also be deterministic. Likely already-correct (everything routes through dispatcher), but no explicit replay test exists. Defer test design to Phase 2 telemetry/QA work (Doc #28).

> **Cross-reference: Doc #41 (Engine & Stack ADR).** The dual-emit pipeline (§2.5), the per-client animation FSM (§5.5), and the rule that the server emits coarse entity state only (no `current_frame` on the wire) are bound to Doc #41. Any sprite or animation feature that ships only to one client, or any move toward a server-side animation FSM, requires a Doc #41 amendment first. The CI parity check between UE5 and PixiJS emitters (§2.5) is the build-time enforcement of this binding.

---

## 16. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #10 §2 (pixel-art rules), Doc #4 §2 (entity state drives visual state) |
| §2 Sprite Asset Format | Doc #10 §2.2 (palette), Doc #7 §2 (UGC asset import) |
| §3 Animation State Schema | Doc #13 §1 (Entity, components — adds AnimationComponent), Doc #23 §2 (Direction8) |
| §4 States per Archetype | Doc #10 §3 (character animation, 8–12 frames), Doc #10 §4 (object state variants), Doc #15 (companion roster), Doc #16 (creature combat — attack/hurt/dead states), Doc #17 §13 (NPC roster) |
| §5 State Machine Execution | Doc #22 §3 (tick rates), Doc #13 §4 (dispatcher side-effect channels), Doc #27 §10.1 (verb-keyed SFX hooks for frame-emitted sounds) |
| §6 Sprite-Entity Binding | Doc #13 §1 (Entity archetype), Doc #13 §4 (dispatcher — adds animation as channel 8) |
| §7 Frame Budget | Doc #11 (Phase 1 Britain visual slice), Doc #22 §4 (Subscribe streaming) |
| §8 Lighting Integration | Doc #10 §2.3 (dynamic real-time lighting), Doc #4 §3 (darkness affects LOS), Doc #23 §7.2 (lighting modulates LOS) |
| §9 Network Replication | Doc #22 §4 (event channel — adds AnimationStateChange), Doc #22 §5 (per-entity replication cadence) |
| §10 UGC Import | Doc #7 §2 (custom asset import), Doc #7 §5 (style validator), Doc #29 (moderation queue) |
| §11 Style Validator | Doc #10 §6 (validator targets — formalizes), Doc #33 (localized diagnostic messages) |
| §12 Legacy Extraction | Doc #1 §5 (license alignment — EA / Origin), Doc #11 (Phase 1 Britain visual slice asset source) |
| §13 MCP Additions | Doc #14 §5 (tools), Doc #14 §6 (resources), Doc #26 (GM `set_animation_state`), Doc #29 (UGC moderation hooks) |
| §14 Phase 1 | Doc #11 §3 (visual row), Doc #10 §7 (prototype scope), Doc #14 §8 (minimal MCP), Doc #16 §12 (combat deferred — `attack`/`cast` animation deferred), Doc #17 §13 (15 NPC roster) |
| §15 Open Questions | Doc #27 §6.5 (TTS lip-sync), Doc #28 (replay/rollback determinism), Doc #29 (UGC moderation) |

---

End of Document #31.
