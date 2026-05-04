Document #23: Pathfinding & Spatial Systems
Project Title: Ultima VII: Britannia Reborn
Document Version: 1.0 (Prototype Planning Draft)
Date: May 2026
Author: [Spatial Systems Lead]
Status: Living Technical Reference — Normative spec for the tile grid model, A* pathfinder, line-of-sight, spatial queries, and the `move_to` verb

Depends on: #2 GDD §4.1 (no auto-pathing breaks simulation invariant), #4 Simulation §3 (grid + sub-tile precision), §5 (pathfinding around dynamic obstacles), #13 Core Schema §1.1 (PhysicalComponent.position, Vec3), §2 (verb registry), §4 (dispatch contract), #14 MCP Surface §5 (`move_to` envelope), #15 Character, Party & Inventory §3 (companions, formation), #16 Combat & Magic §2.5 (`flee` pathfinding), §4 (Flank/Protect/Defend AI modes), §9 (Hostile AI Aware → Engage walk), #17 Dialogue & NPC Schedule §7 (ScheduleSystem submits `move_to`), §14 [OPEN] item 3 (pathfinder algorithm), #22 Network Protocol & Replication §5 (movement replication cadence), §7 (region handoff).

Heritage tags: `[BG]` = *Ultima VII: The Black Gate* (1992). `[SI]` = *Ultima VII Part Two: Serpent Isle* (1993). `[BR]` = original to Britannia Reborn.

> **Updated 2026-05-04 per Doc #41.** All NPC pathfinding is server-side (Rust grid pathfinding). UE5 NavMesh is FORBIDDEN. Player movement is client-predicted and server-validated; the prediction logic must mirror server logic line-for-line.

---

## 1. Spatial Philosophy

Britannia is a 2D tile grid with sub-tile precision for smooth visual movement, exactly as in BG/SI `[BG]`. Every actor — Avatar, companion, scheduled NPC, hostile, projectile — physically occupies tiles and physically traverses them; there is no auto-pathing that bypasses the simulation, per Doc #2 §4.1 invariant. Pathfinding is a service consumed by NPC schedules (Doc #17 §7), combat AI (Doc #16 §4 Flank/Protect/Flee modes, §9 Hostile Aware→Engage), player click-to-move, and any UGC or MCP caller that submits a `move_to` verb. The pathfinder shares the grid model and dispatcher path with every other verb; collisions, doors, dynamic obstacles, and floor transitions are all simulation truths, not pathfinder hacks.

---

## 2. World Grid Model

```ts
type RegionId      = string                                // matches Doc #13
type Direction8    = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
type TerrainId     = string                                // "grass" | "stone" | "water" | "lava" | "wood" | "sand" | "swamp" | ...

type TileCoord = {
  region_id: RegionId
  x:         int                    // tile-space, 0..region.width-1
  y:         int                    // tile-space, 0..region.height-1
  z:         int                    // floor index; 0 = ground
}

type SubTilePos = {
  region_id: RegionId
  x:         float                  // continuous; floor(x) → tile x
  y:         float
  z:         int                    // discrete floor index (no sub-z)
  facing:    Direction8
}

type Tile = {
  terrain_type:       TerrainId
  base_passable:      bool          // walls/cliffs/water default-impassable
  base_movement_cost: float         // 1.0 grass, 1.2 wood, 1.5 sand, 2.0 swamp, ∞ water (no boat)
  z_floor:            int           // floor index (matches enclosing z-layer)
  blocks_los:         bool          // see §7
  is_stair:           bool          // §8
  stair_to_z:         int | null    // destination floor when traversed
  light_level_base:   float         // 0.0 dark .. 1.0 daylight; modulated by lights at runtime
}

// Renamed from `RegionMetadata` to disambiguate from the gameplay-rules `RegionMetadata`
// declared in #15 §6.4 (always_watched, faction, pvp_allowed, chaos_zone). This record
// describes the spatial geometry of a region; the #15 §6.4 record describes its rules.
// [OPEN — verify no external references]
type RegionGeometry = {
  region_id:  RegionId
  width:      int                   // e.g. Britain town: 256
  height:     int                   // e.g. Britain town: 256
  z_floors:   int                   // count of vertical layers; ground-only regions = 1
  tile_size_px: int                 // standard 32 (art space); 1 logical unit per tile
}
```

Standard tile = 32×32 art pixels, 1×1 logical unit. Sub-tile precision is float in `SubTilePos.x/y`; movement step granularity is `actor.move_speed * dt`, typically 0.0625 logical units per 60 Hz frame at walking speed (≈ 1 tile / sec). PhysicalComponent.position from Doc #13 §1.1 maps directly to `SubTilePos`.

Region grid extents are stored per region in `RegionGeometry`; example: Britain 256×256, Castle Britannia 64×64×3, Cave of Trials 96×96×2.

---

## 3. Passability Model

Per-tile static passability is `Tile.base_passable`. Dynamic occupants — entities with `Physical.solidity == Solid` and a non-empty footprint — are layered on top via the spatial index (§9). The pathfinder query combines both:

```ts
type MoverArchetype = {
  archetype_id:    ArchetypeId
  footprint:       TileFootprint     // §3.1; default {1,1}
  terrain_caps:    TerrainCapSet     // §3.2; e.g. { swim: false, fly: false, lava_immune: false }
  z_capable:       bool              // can traverse stairs (false = quadrupeds, large monsters)
}

is_passable(tile: Tile, occupants: Entity[], mover: MoverArchetype) -> bool:
  if not tile.base_passable: return false
  if tile.terrain_type == "water"  and not mover.terrain_caps.swim and not mover.terrain_caps.fly: return false
  if tile.terrain_type == "lava"   and not mover.terrain_caps.lava_immune: return false
  for occ in occupants:
    if occ.Physical.solidity == "Solid" and footprint_overlaps(occ, tile): return false
    if occ is door and occ.State.open == false and mover not in door.allowed_passers: return false
  return true
```

### 3.1 TileFootprint

```ts
type TileFootprint = {
  width:  int   // tiles in X
  depth:  int   // tiles in Y
  // anchor is the SW (or "primary") tile; footprint extends +x, +y from anchor
}
```

Default footprint `{1,1}` for humanoid NPCs and the Avatar. Cart, ox, dragon, and large fixtures may be `{2,2}` or `{3,2}`; the spatial index multi-buckets these so any tile lookup returns the entity.

Doc #13 §1.1 PhysicalComponent gains an `archetype-level` field:

```ts
PhysicalComponent {
  // ...existing fields from Doc #13 §1.1...
  volume_tile_footprint: TileFootprint   // [A] default {1,1}
}
```

### 3.2 TerrainCapSet

```ts
type TerrainCapSet = {
  swim:           bool   // can enter water tiles
  fly:            bool   // ignores ground passability; treats all tiles as passable except world-edge
  lava_immune:    bool   // can enter lava tiles
  ghostly:        bool   // [BR] ignores Solid occupants (used by spirit summons; not Phase 1)
}
```

Most archetypes default all-false. Boats are special: the boat entity is a mover with `swim=true`, and the Avatar is `containedBy` the boat, so the Avatar's own caps don't matter while at sea.

---

## 4. Pathfinder Algorithm

> Resolves Doc #17 §14 [OPEN] item 3 (pathfinder algorithm).

A* on the tile graph, octile heuristic, with dynamic-obstacle awareness and bounded path repair. Single algorithm services NPC schedules, combat positioning, player click-to-move, companion formation, and `flee`.

### 4.0 Server / Client Boundary (per Doc #41)

Per Doc #41 (Engine & Stack ADR) the engine boundary for spatial work is split as follows:

- **NPCs**: Rust-only grid pathfinding. The Rust server runs A* (this section's algorithm) for every NPC, hostile, companion, and procedural mover. Clients (UE5 production target, TS / PixiJS web prototype) render only the resulting positions delivered over the Protobuf wire protocol; they never compute NPC paths. UE5 NavMesh is forbidden — the "UE5 client is a dumb view" rule applies.
- **Player movement**: client-predicted, server-authoritative. Both the UE5 client and the TS web client run the prediction step locally so player input feels instant; the Rust server is the authority and re-runs the same step. The prediction logic must mirror the server logic line-for-line (shared Rust crate compiled to native for UE5 / WASM for TS, or a hand-port held to byte-equivalent test vectors). On mismatch, the server snaps the client to the authoritative position and the client reconciles forward.
- **Spatial queries** (line-of-sight per §7, AOE / radius per §9, broadcast scopes per Doc #22): server-only. Clients never run LOS, witness, or radius queries; they receive results (or downstream effects like which entities are visible) from the server.

### 4.1 Graph

Nodes = tiles. Edges = 8-connected neighbors per floor (N/NE/E/SE/S/SW/W/NW), plus z-transition edges across `is_stair` tiles (§8).

Edge cost:

```
edge_cost(from, to, mover):
  base = to.base_movement_cost
  diag = 1.4142 if (from.x != to.x and from.y != to.y) else 1.0
  occ_penalty = 0.5 if to has any entity with Schedule component (not the mover) else 0.0
  z_penalty   = 5.0 if from.z != to.z else 0.0           // §8
  return base * diag + occ_penalty + z_penalty
```

The `occ_penalty` biases NPCs to route around each other rather than pile-up on the same tile; it is a soft cost, not a hard block, so a corridor pinch still resolves rather than failing.

### 4.2 Heuristic

Octile distance:

```
h(a, b) = max(|dx|, |dy|) + (1.4142 - 1.0) * min(|dx|, |dy|)
         where dx = b.x - a.x, dy = b.y - a.y
         (z difference adds + 5.0 per floor jump)
```

Admissible against the cost function above (octile is a lower bound on min achievable edge cost).

### 4.3 Dynamic Obstacle Re-validation

Cached paths are re-validated tile-by-tile during `MoveTask` execution (§5). On each step:

```
on_step(actor, path, idx):
  next_tile = path[idx]
  if not is_passable(next_tile, occupants_now(next_tile), actor.mover_archetype):
    repair = a_star(actor.tile, path.goal, mover, max_radius=8)
    if repair.found: actor.path = repair.path; idx = 0
    else if greedy_step(actor, path.goal): actor.path = [greedy_target]   // §4.5 fallback
    else: emit ERR_NO_PATH; cancel MoveTask
```

Repair radius cap (8 tiles) keeps re-plans cheap. If the obstacle is far from the goal, a partial repair stitches back to the original cached suffix; if near the goal, a full re-plan is triggered.

### 4.4 Failure Modes

| Result | Condition | `move_to` return |
|---|---|---|
| Path found | A* yields full path to goal | `ok` (executes) |
| Partial path | Goal unreachable but a path to within `stop_at_distance` exists | `ok` (executes prefix) |
| Repair failed | Mid-execution block, no repair within 8-tile radius | `ERR_NO_PATH` (re-plan once at full radius before failing) |
| Initial fail | A* exhausts open set without reaching goal | `ERR_NO_PATH` |
| Budget exceeded | A* runs over 5 ms hard cap | Greedy fallback (§4.5); if greedy also fails → `ERR_NO_PATH` |

### 4.5 Performance Budget

| Bucket | Target | Hard Cap |
|---|---|---|
| Per-pathfind average (path ≈ 16 tiles) | **1 ms** | — |
| Per-pathfind worst case | — | **5 ms** |
| Per-region pathfinds per second (all NPCs aggregate) | 200 | 500 |
| Repair re-plan (radius 8) | 0.3 ms | 1 ms |
| Greedy fallback (single tile step toward goal) | < 0.05 ms | 0.1 ms |

Budget enforcement: A* runs on a worker thread per region; the open-set expansion loop checks elapsed time every 64 nodes and bails out at 5 ms with current best-effort. On bail, the system returns the path-so-far and queues a `greedy_step` continuation each tick until the actor reaches the goal or the original A* request is re-issued. Greedy step is "step toward goal in the direction of the lowest-cost passable neighbor"; it does not wall-follow and is intentionally dumb — it's a degraded mode, not a substitute pathfinder.

### 4.6 Why A* (not navmesh, not flow field)

| Considered | Decision | Why |
|---|---|---|
| **A* on tile grid** | **Chosen** | Matches BG/SI grid topology exactly; designer-readable; integrates with door/lock/object simulation per-tile. |
| **Navmesh** | Rejected for Phase 1 | Authoring tooling and dynamic-obstacle re-stitch on mesh is heavyweight; benefit is for large open 3D spaces, which BR does not have. Open question for outdoor regions deferred to §15. |
| **Flow field** | Rejected | Useful for many-to-one pathing (RTS swarms); BR has at most ~20 active NPCs per region, so per-actor A* is cheaper than maintaining a per-target flow field. |
| **Hierarchical pathfinder (HPA*)** | Deferred | Worth revisiting if Phase 2 region sizes exceed 512×512 with > 50 active NPCs; not needed for Britain/Castle/Trinsic. |

---

## 5. `move_to` Verb Dispatch

Formalizes the `move_to` verb registered in Doc #14 §5 capability `avatar.basic` and submitted by Doc #17 §7 ScheduleSystem.

### 5.1 Inputs

```ts
type MoveTarget =
  | { kind: "tile",   coord: TileCoord }
  | { kind: "entity", entity_id: EntityId }      // dynamic; tracks entity position

type MoveOptions = {
  stop_at_distance:  float                // tiles; default 0.0
                                          // 1.0 typical for `talk` (Doc #17 §5.1)
                                          // 1.5 typical for melee (Doc #16 §2.1)
                                          // 0.0 for sit-on-chair, use-on-bed
  urgency:           "stroll" | "walk" | "run" | "sprint"   // selects move_speed multiplier
  formation_slot:    int | null           // companion follower offset, §10
  cancellable:       bool                 // default true; set false for cutscene-driven moves
}

move_to(actor: EntityId, target: MoveTarget, options?: MoveOptions) -> MoveResult
```

### 5.2 Returns

```ts
type MoveResult =
  | { ok: true, path_length_tiles: int, eta_ms: int }
  | { ok: false, error: MoveError }

type MoveError =
  | "ERR_NO_PATH"
  | "ERR_INVALID_TARGET"        // entity dead/region-mismatched
  | "ERR_OUT_OF_REGION"         // target in different region (use region handoff, §12)
  | "ERR_INTERRUPTED"           // combat/dialogue/damage/paralysis took over
  | "ERR_BUDGET_EXCEEDED"       // pathfinder bailed and greedy fallback also failed
  | "ERR_CANCELLED"             // newer move_to from same actor superseded this one
```

### 5.3 Resolve order (per Doc #13 §4)

1. **Validate** — actor exists, has `Physical`, is alive (`State.hp > 0`), is not paralyzed; target is reachable region (matches actor.region or routes via §12).
2. **Preconditions** — actor.Physical.containedBy is null (not in a chest/cart) OR the container itself is mobile (boat).
3. **Effects (resolve_effects)** — pathfind A* (§4); if `target.kind == "entity"`, snapshot target position at planning time but mark path as "tracking" so re-plans use updated target position each step.
4. **Virtue scoring** — `move_to` is morally neutral by default. Exception: if the resulting path crosses into a `private` region (housing instance) without permission, dispatcher rejects with `ERR_VIRTUE_REJECTED` upstream; not a pathfinder concern.
5. **Apply writes** — spawn `MoveTask` component on actor; persist `actor.Physical.position` updates per step under `WorldState` scope.
6. **Side effects** — footstep audio events (Doc #10), schedule interruption hook fires if target tile is in a different schedule slot.

### 5.4 MoveTask execution

```ts
type MoveTask = {
  actor_id:        EntityId
  path:            TileCoord[]               // remaining tiles, head = next step
  goal:            MoveTarget
  options:         MoveOptions
  step_idx:        int
  speed_logical_per_sec: float               // derived from urgency × actor.move_speed
  started_at_tick: int
}
```

Ticks at the simulation rate (60 Hz for sub-tile interpolation; tile-boundary crossings are the discrete "step" events that re-validate per §4.3). On each tile-boundary crossing:

1. Emit footstep audio (terrain-type-keyed sample).
2. Re-validate next tile per §4.3.
3. If `dist(actor, resolve_position(goal)) <= options.stop_at_distance`: complete task, emit `MoveCompleted`; release MoveTask.
4. If `options.formation_slot != null`: re-evaluate slot offset against leader's current position (§10).

### 5.5 Cancellation

Subsequent `move_to` from the same actor cancels the prior MoveTask (returns `ERR_CANCELLED` to the previous caller's continuation if any). Combat verbs (`attack`, `defend`, `flee`) implicitly cancel an in-flight move. `talk` does not cancel a move belonging to a companion; the schedule system pauses and resumes per Doc #17 §8.1. Damage taken does not auto-cancel (BG behavior `[BG]`); player must re-issue.

### 5.6 Side-effect channels (per Doc #13 §4)

| Channel | Fires |
|---|---|
| Virtue Engine | No-op for `move_to` itself (movement is morally neutral) |
| Persistence | `actor.Physical.position` written each tile crossing under `WorldState` |
| Replication | Position deltas at 5 Hz to in-region clients per Doc #22 §5 (NOT every 60 Hz interpolation tick) |
| Sound Propagation | Footstep events (Doc #4 §3); heavy-armor or running urgency emits louder events that may alert nearby NPCs |
| Schedule Interruption | If actor is NPC mid-schedule and was forced to move (combat, override slot), preserves `current_slot_idx` for resume |
| MCP Telemetry | If caller is MCP, emits `MoveStarted` and `MoveCompleted` events to that session |

---

## 6. Click-to-Move (Player Input)

BG/SI behavior preserved exactly `[BG]`.

| Input | Behavior |
|---|---|
| Single right-click on tile | One-tile step toward cursor, in cursor's compass direction; path = single tile, no A* required |
| Right-click-and-hold | Continuous stepping toward cursor each tick; cursor moves, target updates; no A* still |
| Double-right-click on tile | Full A* pathfind to target tile; executes as `move_to` MoveTask |
| Double-right-click on entity | Full A* pathfind to entity, with `stop_at_distance = 1.0` (default talk distance) |
| Right-click on unreachable tile | Cursor changes to "no path" icon (Doc #10 cursor library); no verb submitted |

All player movement routes through the same `move_to` verb path under the hood; the only distinction is single-click = synthesized 1-tile path, no pathfinder call.

Auto-pathing exception (Doc #2 §4.1 invariant): the player cannot double-right-click and walk through a closed door without explicit `use(door)`. The pathfinder treats closed doors as impassable; the player must open the door first or the path returns `ERR_NO_PATH`. This preserves the "no pathing breaks simulation" invariant — the world's rules govern movement, not a smarter pathfinder.

---

## 7. Line-of-Sight (LOS)

Bresenham line rasterization from actor's tile to target tile, accumulating `Tile.blocks_los` and dynamic-occupant LOS blockers.

```
line_of_sight(from: TileCoord, to: TileCoord) -> bool:
  if from.region_id != to.region_id: return false
  if from.z != to.z: return false                       // §8: LOS does not cross floors
  for tile in bresenham(from, to):
    if tile == from or tile == to: continue              // endpoints exempt
    if tile.blocks_los: return false
    for occ in occupants(tile):
      if occ.PhysicalComponent.blocks_los: return false   // [BR] field on PhysicalComponent
      if occ is door and occ.State.open == false: return false
  return true
```

Doc #13 §1.1 PhysicalComponent extension:

```ts
PhysicalComponent {
  // ...existing...
  blocks_los: bool   // [A] default: true if solidity == Solid AND volume_tile_footprint area >= 1, else false
}
```

### 7.1 Consumers

| Consumer | Doc | Use |
|---|---|---|
| `attack` range check | #16 §2.1 step 2 | Reject ranged attacks through walls |
| `cast_spell` targeting | #16 §2.2 step 5 | Block entity-targeted spells through walls; area spells require LOS to center |
| `talk` precondition | #17 §5.1 step 2 | NPC must be visible to converse |
| Witness model | #15 §6.2 | Stealing/killing witnessed only if NPC has LOS to event |
| Schedule "see" awareness | #17 §3.1 reactive keywords | Auto-injected `thief` requires NPC had LOS at theft moment |
| Hostile AI Idle→Aware | #16 §9 | Aggression triggers on LOS-confirmed potential target |

### 7.2 Lighting Modulation `[BR]`

Per Doc #4 §3 ("Darkness affects NPC line-of-sight"), LOS effective range is reduced in dark areas. A "dark area" = no light source (torch, candle, fire, daylight-from-window) within 4 tiles of the line endpoints.

```
effective_los_range(from, to, observer) -> bool:
  raw_los = line_of_sight(from, to)
  if not raw_los: return false
  range_tiles = euclidean_distance_tiles(from, to)
  light_at_to = sample_light(to)
  if light_at_to < 0.3:                                  // dark threshold
    max_range = max(2, observer.Stats.dex / 5)            // STR 8 → 2 tiles, DEX 30 → 6 tiles
    if range_tiles > max_range: return false
  return true
```

`sample_light` consults the runtime light field (per-tile `light_level_base` plus dynamic light contributions from torches/fires; see Doc #4 §3 lighting). Avatar with high DEX sees farther in the dark; default beggar or low-DEX guard sees only a few tiles. This is a strict gameplay layer over raw `line_of_sight`; raw LOS remains available for systems that should ignore lighting (e.g., spells that name a target by id).

### 7.3 Partial-Transparency `[OPEN]`

Curtains, foliage, and stained glass partially obscure but do not fully block. See §15 [OPEN] item 2.

---

## 8. Multi-Floor Buildings

Each region may have multiple z-layers; each layer is its own tile grid with its own passability and LOS data. Stairs are the transition mechanism.

```ts
Tile {
  // ...existing fields...
  is_stair:      bool               // true on stair tiles
  stair_to_z:    int | null         // destination floor; null on non-stair tiles
}
```

### 8.1 Stair traversal

Walking onto a stair tile while moving in a direction that aligns with the stair's facing transitions the actor's `Physical.position.z` to `stair_to_z` over the next step. The pathfinder treats z-transitions as a single edge with `+5.0` cost (encourages staying on one floor when possible; a path that climbs unnecessarily loses to a path that doesn't).

Stairs are bidirectional: a tile with `is_stair=true, stair_to_z=1` on floor 0 has a paired tile on floor 1 at the same (x, y) with `stair_to_z=0`. Ladder tiles work the same way; rope-up/rope-down behave as stairs with `+8.0` cost per use.

### 8.2 LOS across floors

LOS does NOT cross floors by default. Specific tiles (balcony cutouts, roof holes) may set `blocks_los=false` AND have a "see-through-z" flag — but Phase 1 ships with no see-through-z tiles; balconies are art-only and LOS treats them as walled. See §15 [OPEN] item 4.

### 8.3 Spatial queries by floor

All `entities_in_radius` and `entities_in_region` queries are floor-aware; a query at z=1 returns entities on floor 1 only unless `include_all_z=true` is passed (rarely needed; designer-only debug flag).

---

## 9. Spatial Queries

Utility surface consumed by AI, combat, dialogue, witness model, and the MCP `forge://` resources.

```ts
namespace query {

  entities_in_radius(
    center: TileCoord,
    radius_tiles: float,
    filter?: EntityFilter
  ) -> Entity[]

  entities_in_region(
    region_id: RegionId,
    filter?: EntityFilter
  ) -> Entity[]

  line_of_sight(
    from: TileCoord,
    to:   TileCoord,
    observer?: EntityId           // optional, for §7.2 lighting modulation
  ) -> bool

  path_exists(
    from:   TileCoord,
    to:     TileCoord,
    mover:  MoverArchetype
  ) -> bool                        // returns true/false WITHOUT executing; budget 0.5 ms

  nearest_entity(
    from:        TileCoord,
    filter:      EntityFilter,
    max_dist:    float
  ) -> Entity | null

  tile_at(coord: TileCoord) -> Tile

  occupants_of(coord: TileCoord) -> Entity[]

  tiles_in_arc(
    from:           TileCoord,
    facing:         Direction8,
    arc_degrees:    float,         // e.g. 90 for "rear arc behind facing"
    radius_tiles:   float
  ) -> TileCoord[]                  // used by Flank AI mode (Doc #16 §4)
}

type EntityFilter = {
  archetype_pattern?: string        // glob, e.g. "npc.*", "item.reagent.*"
  has_component?:     ComponentId[]
  faction?:           string
  hostile_to_faction?: string
  alive?:             bool
  custom_predicate?:  (e: Entity) -> bool
}
```

### 9.1 Spatial Index

Backed by a **uniform grid bucket** per region: 8×8 tile buckets in a flat array, `region.width/8 * region.height/8 * region.z_floors` buckets total. Each bucket holds an `EntityId[]` of currently-occupying entities.

| Operation | Cost |
|---|---|
| Entity move (cross bucket boundary) | O(1) remove + O(1) insert |
| `entities_in_radius` | O(buckets_in_radius × avg_entities_per_bucket); for radius 12 tiles → ~9 buckets × ~3 entities = ~27 entity checks |
| `nearest_entity` | Spiral bucket walk outward from center; early-exits when first match found and remaining buckets cannot beat distance |
| `entities_in_region` | O(N) walk all buckets; rare, used for region-wide diagnostics |

Index update rate: real-time on every entity position write through the dispatcher. The dispatcher is the single ingress (Doc #13 §4), so no race between simulation tick and index rebuild — writes are sequenced.

Memory: Britain at 256×256 with z=1 → 32×32 = 1024 buckets, ~16 bytes per bucket header + 8 bytes per EntityId. With ~500 entities, ~12 KB total per region. Negligible.

---

## 10. Group Movement (Companion Following)

Companions (Doc #15 §3) follow the lead Avatar via formation slots.

```ts
type FormationSlot = {
  slot_idx:     int          // 0..3; up to 4 companions [BR] (BG had 7, BR Phase 1 caps at 4)
  offset_tile:  { dx: int, dy: int }   // from leader, in leader's facing-relative coords
}

DEFAULT_SLOTS = [
  { slot_idx: 0, offset: { dx: -1, dy:  0 } },   // left of leader
  { slot_idx: 1, offset: { dx:  1, dy:  0 } },   // right of leader
  { slot_idx: 2, offset: { dx:  0, dy: -1 } },   // behind leader
  { slot_idx: 3, offset: { dx: -1, dy: -1 } },   // behind-left
]
```

### 10.1 Follow algorithm (per CompanionAI tick, every 500ms; matches Doc #16 §4 cadence)

```
follow_tick(companion, leader):
  desired = leader.tile + rotate(slot.offset, leader.facing)
  current_dist = tiles_between(companion.tile, desired)

  if current_dist <= 1.5: noop                        // close enough, hold
  if current_dist <= 8.0:                              // gentle catch-up
    submit move_to(companion, desired,
                   options={stop_at_distance: 1.0, urgency: "walk", formation_slot: slot.idx})
  else:                                                // fell behind: full re-pathfind to leader
    submit move_to(companion, leader.tile,
                   options={stop_at_distance: 2.0, urgency: "run",  formation_slot: slot.idx})
```

### 10.2 Formation behavior

- Pause: if leader stops moving (no MoveTask, idle for > 1 sec), companions hold position; they do not crowd the leader's tile.
- Resume: on leader's next step, formation re-evaluates and companions re-issue `move_to` to refreshed slot positions.
- Combat override: in combat, formation is suspended; CompanionAI mode (Doc #16 §4) takes ownership.
- Door bottleneck: companions form a single-file queue through chokepoints — the slot system tolerates large `current_dist` while the leader is on the far side of a door; no special-case code, just A* doing its job.

### 10.3 Catastrophic catch-up `[OPEN]`

If `current_dist > 32` (companion got stuck across a region edge or through a teleporter), the path becomes prohibitively long. Phase 1 falls back to **teleport-snap** to leader's tile (matches BG behavior for far-flung companions `[BG]`) — see §14. Phase 2 will replace this with a re-spawn-at-shrine flow.

---

## 11. Combat Positioning

All combat AI modes from Doc #16 §4 use the same A* engine with different goal predicates.

| Mode | Goal Predicate | Goal Distance |
|---|---|---|
| **AttackNearest** / **Weakest** / **Strongest** / **Random** | Target tile | weapon range (1.5 melee, 12 bow) |
| **Defend** | Within 1.5 tiles of `obey_player` | 1.5 |
| **Berserk** | Same as AttackNearest | weapon range |
| **Flee** | Any tile farther than 16 tiles from every hostile, preferring `chaos_zone == false` regions per Doc #16 §2.5 | n/a (predicate-based) |
| **Protect** | Tile between `protect_target` and nearest hostile, on the line segment | 1.0 from line |
| **Flank** | Tile in target's rear 90° arc per `query.tiles_in_arc(target.tile, target.facing, 90, weapon_range)` | weapon range |

Goal predicates are passed to A* as a function `is_goal(tile) -> bool` instead of a fixed target tile. The pathfinder's open-set termination condition is "any tile satisfying `is_goal`, with lowest f-score." Heuristic falls back to `h(a, nearest_satisfying_tile)` precomputed once at A* start (cheap when goal candidates are few; for Flee mode, it's "distance to nearest exit" approximated by region edge).

Implementation note: AI mode handlers compute the goal predicate, then call `pathfind_to_goal(actor, predicate, max_search_radius=64)`. The 64-tile cap prevents Flee mode from chewing the entire region's tile graph when no safe tile exists; on cap exhaustion, pathfinder returns the best candidate found so far and the AI accepts it as a partial flee.

---

## 12. Network Synchronization

Cross-references Doc #22 (in draft alongside this document).

### 12.1 Server authority

The server is authoritative on path execution. Pathfinding runs server-side only; clients never compute paths. A client's click-to-move emits the verb invocation; the server runs A*, executes the MoveTask, and broadcasts position deltas.

### 12.2 Position replication cadence

| Entity Class | Replication Rate | Source |
|---|---|---|
| Avatar of subscribing player | 20 Hz | Doc #22 §5 |
| Other Avatars in region | 10 Hz | Doc #22 §5 |
| NPCs and hostiles in region | 5 Hz per moving entity | Doc #22 §5 |
| Idle / stationary entities | Event-driven only (on next move) | — |

Clients interpolate between received position samples for visual smoothness. Sub-tile precision (§2) means the rendered position is `lerp(last_sample, next_sample, t)` where `t` is the fraction of the inter-sample interval elapsed.

### 12.3 Path NOT replicated

The path itself is NOT sent over the wire. Clients only see resulting position samples. This means:

- A client cannot predict an NPC's future tile-by-tile route (defensible against client-side cheats and bots).
- Reconnecting clients receive only current position; no path replay.
- LLM avatar agents cannot "see" a path; they can only `query.path_exists` if they want to know.

### 12.4 Region handoff

Per Doc #22 §7 (when an actor crosses a region boundary): in-flight pathfind is **cancelled**, MoveTask released, and a fresh `move_to` is re-issued at the destination region with the original goal projected into the new region's tile space (if the original goal was an entity, the entity is re-resolved; if a tile, the tile is the same `TileCoord` since region_ids are explicit). The cancel→re-issue cycle is invisible to the calling system because the dispatcher resubmits internally; observers of the original `move_to` see one continuous MoveTask.

### 12.5 Determinism

A* is deterministic given the same start, goal, mover archetype, and tile state. Tie-breaking in the open set uses (f-score, h-score, tile (x,y,z) lex order) to ensure replay reproducibility for QA and for cross-shard rollback recovery (Doc #22 [OPEN] dependency).

---

## 13. MCP Surface Additions

Amendments to Doc #14 §5 (tools) and §6 (resources). All gated by capabilities defined in Doc #14 §3.

### 13.1 New / Formalized Tools

| Tool | Capability | Envelope Inputs | Returns | Mutates |
|---|---|---|---|---|
| `move_to` | `avatar.basic` | `actor_id`, `target: MoveTarget`, `options?: MoveOptions` | `MoveResult` (§5.2) | Spawns MoveTask; per-step position writes |
| `path_exists` | `avatar.basic` | `from: TileCoord`, `to: TileCoord`, `mover_archetype?: ArchetypeId` (defaults to session avatar's archetype) | `{ exists: bool, approx_length_tiles?: int }` | None — pure query; designer/QA tool |
| `line_of_sight` | `avatar.basic` | `from: TileCoord`, `to: TileCoord`, `observer_id?: EntityId` (for §7.2 lighting) | `{ los: bool, blocked_by?: EntityId \| "tile" }` | None |
| `cancel_move` | `avatar.basic` | `actor_id` | `{ ok: true, prior_path_length: int }` | Cancels in-flight MoveTask |

```json
// move_to (formalized; supersedes the ambiguous Doc #14 §5.11 stub)
{
  "name": "move_to",
  "input": {
    "envelope": "VerbEnvelope",
    "actor_id": "EntityId",
    "target": {
      "oneOf": [
        { "kind": "tile",   "coord": "TileCoord" },
        { "kind": "entity", "entity_id": "EntityId" }
      ]
    },
    "options": {
      "stop_at_distance": "float (default 0.0)",
      "urgency": "stroll | walk | run | sprint (default walk)",
      "formation_slot": "int | null (default null)",
      "cancellable": "bool (default true)"
    }
  },
  "returns": {
    "ok": "boolean",
    "path_length_tiles": "int (if ok)",
    "eta_ms": "int (if ok)",
    "error": "ERR_NO_PATH | ERR_INVALID_TARGET | ERR_OUT_OF_REGION | ERR_INTERRUPTED | ERR_BUDGET_EXCEEDED | ERR_CANCELLED (if not ok)"
  }
}
```

### 13.2 New Resources

| Resource URI | Returns | Capability |
|---|---|---|
| `forge://shard/{s}/region/{r}/tile/{x},{y}` | per-tile inspection: `terrain_type`, `base_passable`, `base_movement_cost`, `blocks_los`, `is_stair`, `light_level`, `occupants: EntityId[]` | `inspect.read` |
| `forge://shard/{s}/region/{r}/tile/{x},{y}/z/{z}` | same as above for multi-floor regions; `z` defaults to 0 if omitted in the shorter URI form | `inspect.read` |
| `forge://shard/{s}/region/{r}/spatial_index_stats` | bucket fill distribution, total entity count, hottest buckets — diagnostic only | designer/QA capability |
| `forge://shard/{s}/avatar/{id}/move_task` | active MoveTask if any: goal, remaining path length, ETA, urgency | `inspect.read` for own avatar; designer for others |

### 13.3 Capability Notes

- `path_exists` and `line_of_sight` are pure queries with no virtue impact and no replication side-effects; granted at `avatar.basic` to allow accessibility shims (e.g., a screen reader that wants to know "can I reach the door?") without elevating to `avatar.full`.
- The path itself is never returned by `move_to` or any resource — only path *length* and ETA. This matches §12.3's no-path-replication rule and prevents MCP clients from extracting routing intelligence beyond what a seated player has.

---

## 14. Phase 1 Prototype Scope

Per Doc #11 (12-week "Britain Alive") and the Phase 1 scope tables in Docs #15, #16, #17.

| Subsystem | In Scope | Deferred |
|---|---|---|
| A* pathfinder | Operational across Britain town tiles (256×256, single floor) | — |
| Multi-floor support | **Castle Britannia (3 floors)** with stair tiles wired up | Other multi-floor regions (Cave of Trials in §16 §12 is single-floor for Phase 1; SI gabled houses deferred) |
| NPC schedules using `move_to` | **15 NPCs** per Doc #17 §13, full daily slots driving real path execution through dispatcher | Override-slot installation for events |
| Player click-to-move | Single right-click step + double-right-click full pathfind, both via `move_to` | Right-click-and-hold continuous path (Phase 1 ships with click-step only; hold-pathfind is Phase 2 polish) |
| LOS | Wired for `talk` precondition (Doc #17 §5.1) and `attack` LOS check (Doc #16 §2.1) | LOS for spells (cast_spell deferred per Doc #16 §12), witness LOS deferred to Phase 2 per Doc #15 §8 |
| Lighting modulation of LOS (§7.2) | **Not in Phase 1** — raw LOS only; dark-area DEX modulation deferred | Active in Phase 2 once full lighting sim ships per Doc #4 §3 |
| Companion formation following | **Not in Phase 1.** Companions teleport-snap to leader when `current_dist > 4` tiles. Crude but ships. | Full formation slot system per §10 deferred to Phase 2 |
| Combat positioning | **Not in Phase 1** — only `Manual` and `AttackNearest` AI modes per Doc #16 §12; neither needs Flank/Protect/Flee paths | Flank/Protect/Flee path predicates per §11 deferred to Phase 2 |
| Spatial queries | `entities_in_radius`, `tile_at`, `nearest_entity`, `line_of_sight` wired; used by talk/attack/witness | `tiles_in_arc` (Flank), `path_exists` MCP tool deferred to Phase 2 |
| MCP surface | `move_to` tool ships (per Doc #14 §8 `avatar.basic` set); `path_exists`/`line_of_sight`/`cancel_move` tools deferred | All §13 resources except per-tile inspection deferred |
| Performance budget | Targets in §4.5 enforced; greedy fallback active | Full HPA* / hierarchical pathfinder evaluation (only if perf data demands) |

**Phase 1 success metric:** the Avatar can stand outside Garritt's bakery, double-right-click on a tile across the Britain town square (path length ~30 tiles, around two market stalls and one passing NPC), arrive in under 30 seconds at walk speed without colliding into stationary obstacles, and during the walk a separate scheduled NPC (the Britain guard on patrol) re-paths around the Avatar's blocking tile rather than stalling. Castle Britannia: Avatar can pathfind from throne room (floor 0) to Lord British's bedchamber (floor 2) via the central staircase, with the pathfinder selecting the staircase route over an unreachable balcony alternative.

---

## 15. Open Questions

1. `[OPEN]` **Pathfinder cache invalidation on bulk world changes.** UGC region reload (Doc #7) or designer hot-reload may invalidate the entire region's tile graph mid-frame. Need a "region rebuild" hook that flushes cached paths for all in-flight MoveTasks in that region, re-issues them, and gracefully degrades for 1–2 frames. Default: invalidate-and-re-issue all; budget impact unstudied.
2. `[OPEN]` **LOS through partially-transparent objects.** §7.3. Curtains, foliage, shop awnings, stained glass — each should reduce LOS range or LOS reliability rather than fully block. Proposal: extend `PhysicalComponent` with `los_attenuation: float (0..1)` and accumulate along Bresenham trace; total > 1.0 = blocked. Cost: every Bresenham step does a float multiply. Defer until Phase 2 lighting work.
3. `[OPEN]` **Pathfinding around moving ships at sea.** Ships occupy multiple water tiles, are mobile, and the Avatar may stand on the deck (containedBy boat). When the boat moves, the Avatar's effective position moves; pathfinding "on" the boat (deck movement) vs "off" the boat (jumping into water) needs disambiguation. Proposal: deck is its own micro-region attached to the boat entity; embarkation/disembarkation is a region handoff per §12.4. Sea travel is post-Phase-1 per Doc #11.
4. `[OPEN]` **Navmesh vs pure tile grid for large outdoor areas.** §4.6 chose tile grid for Phase 1. If Phase 3+ adds 1024×1024 wilderness regions with sparse obstacles, a hybrid (navmesh outdoors, tile grid in towns) may be needed. Decision deferred to performance data from Phase 2.
5. `[OPEN]` **Telekinesis interaction with passability.** Doc #16 §6 references `cast_spell(in_por)` (telekinesis) lifting a barrel into an enemy. While the barrel is mid-cast (in flight), is its tile briefly passable? The §4.3 dynamic obstacle model would make it impassable as soon as it enters the destination tile, possibly causing pathfinder weirdness for nearby NPCs in the same tick. Proposal: in-flight projectiles do NOT register as occupants (only their landing tile does, on impact). Same rule should apply to thrown objects (Doc #16 §2.3) and Telekinesis trajectories.
6. `[OPEN]` **See-through-z tiles for balconies/holes.** §8.2. Specific tiles should allow LOS to/from another floor (a hole in the floor, a balcony rail). Tile schema needs a `los_z_target: int | null` field; pathfinder must NOT treat these as stair edges (no movement, only sight). Defer until first multi-floor region needs it (Castle Britannia's throne hall has a balcony but Phase 1 ships with it walled-LOS).
7. `[OPEN]` **Pathfinder response to door being unlocked mid-path.** If an NPC is pathfinding around a locked door and a player picks the lock during the NPC's path execution, should the NPC re-plan to the now-shorter route? Cheap (next-step re-validation in §4.3 will not detect the new option; would require periodic full re-plan). Proposal: NPCs re-plan every 8 tiles or 5 seconds of path execution, whichever comes first. Adds CPU cost; defer measurement to Phase 2.
8. `[OPEN]` **Formation slot rotation for narrow corridors.** §10. When the leader enters a corridor narrower than the formation width, slots should collapse to single-file order. Current §10.1 algorithm doesn't model this — companions just queue up via A* naturally, which works visually but isn't elegant. Proposal: detect 1-tile-wide passages via spatial index and collapse formation to slot-idx order. Defer to formation-system Phase 2 work.

---

## 16. Cross-Document Integration

| This Doc | Touches |
|---|---|
| §1 Philosophy | Doc #2 §4.1 (no auto-pathing breaks sim invariant), Doc #4 §3 (grid + sub-tile), Doc #4 §5 (NPC schedule pathfinding) |
| §2 Grid Model | Doc #13 §1.1 (PhysicalComponent.position, Vec3) |
| §3 Passability | Doc #13 §1.1 (extension: volume_tile_footprint), Doc #4 §2 (Solidity) |
| §4 A* | Doc #17 §14 [OPEN] item 3 (resolves) |
| §5 move_to verb | Doc #13 §2 (verb registry), Doc #13 §4 (dispatch contract), Doc #14 §5.11 (formalizes) |
| §6 Click-to-Move | Doc #2 §4.1 (preserves auto-pathing invariant), Doc #10 (cursor library) |
| §7 LOS | Doc #4 §3 (lighting), Doc #15 §6.2 (witness model), Doc #16 §2.1 §2.2 (combat LOS), Doc #17 §5.1 (talk LOS) |
| §8 Multi-floor | Castle Britannia layout (Doc #3 World Bible), Doc #15 §3 (party navigation) |
| §9 Spatial Queries | Doc #15 §6.2 (witness queries), Doc #16 §4 (Flank arc, hostile detection), Doc #17 §3.1 (reactive injection) |
| §10 Group Movement | Doc #15 §3 (companion roster), Doc #16 §4 (combat takes ownership) |
| §11 Combat Positioning | Doc #16 §4 (10 AI modes), Doc #16 §2.5 (flee target predicate) |
| §12 Network | Doc #22 §5 (replication cadence), Doc #22 §7 (region handoff) |
| §13 MCP | Doc #14 §3 (capabilities), Doc #14 §5 (tool envelope), Doc #14 §6 (resources) |
| §14 Phase 1 | Doc #11 (milestones), Doc #14 §8, Doc #15 §8, Doc #16 §12, Doc #17 §13 |

### Resolved Open Items

- **Doc #17 §14 [OPEN] item 3 (Pathfinder algorithm)** — fully resolved: A* on 8-connected tile graph, octile heuristic, dynamic-obstacle re-validation per step, repair within 8-tile radius, greedy fallback at 5 ms hard cap. Performance budget: 1 ms average / 5 ms worst case per pathfind. Navmesh authoring deferred to §15 [OPEN] item 4 pending Phase 2+ region scale data.
- **Doc #14 §5.11 (`move_to` envelope ambiguity)** — formalized at §5 and §13.1: `MoveTarget` (tile or entity), `MoveOptions` (stop_at_distance, urgency, formation_slot, cancellable), explicit `MoveResult` with seven enumerated error codes.

See Doc #41 (Engine & Stack ADR) for the canonical engine/stack decision: Rust server runs all pathfinding and spatial queries; UE5 (production) and TS / PixiJS (web prototype) clients are dumb views that render server-authoritative positions and run only mirror-image player-movement prediction.

---

End of Document #23.
