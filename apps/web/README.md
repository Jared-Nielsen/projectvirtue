# @br/web — Game Client

Solid + Vite + PixiJS client for Project Virtue.

## Stack

- **Solid 1.9** + `@solidjs/router` 0.16 (15-route map; auth-gated `/play/*`)
- **PixiJS v8** for the in-world canvas (mounted at `/play`)
- **Vite 5** dev/build, **Vitest 2** unit tests, **Biome 1.9** lint+format
- **TypeScript 5.6 strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Workspace deps: `@br/ui`, `@br/types`, `@br/mocks`, `@br/icons`

## Scripts

```bash
pnpm --filter @br/web dev        # vite dev on :5173
pnpm --filter @br/web build      # tsc -b && vite build → dist/
pnpm --filter @br/web preview    # serve dist on :4173
pnpm --filter @br/web typecheck  # tsc --noEmit
pnpm --filter @br/web lint       # biome check
pnpm --filter @br/web test       # vitest --run
```

## Layout

```
src/
├── App.tsx + main.tsx + router.tsx       # root + route map
├── routes/                               # 15 game-client screens
│   ├── Landing.tsx, Login.tsx, Home.tsx, CharacterList.tsx,
│   ├── CharacterCreate.tsx, Play.tsx, Combat.tsx, Inventory.tsx,
│   ├── Journal.tsx, Options.tsx, Dialog.tsx, Loot.tsx, LevelUp.tsx,
│   ├── Book.tsx, LoadingScreen.tsx, RouteError.tsx, _Placeholder.tsx
│   └── *.helpers.ts + __tests__/*.test.ts
├── play/                                 # HUD overlays composed over the canvas
│   ├── CombatHud.tsx, BossHud.tsx, CourtHud.tsx, CityHud.tsx,
│   │   PortalModal.tsx, PlatformerStub.tsx
│   ├── TargetFrame.tsx, DamageFeed.tsx, AbilityBar.tsx, SpellRing.tsx
│   └── __tests__/hud-logic.test.ts
├── inventory/InventoryScreen.tsx + weight.ts + tests
├── loading/                              # 4 loading-screen variants + rotator
├── canvas/                               # PixiJS canvas runtime (see below)
├── layouts/{MenuLayout,PlayLayout}.tsx
├── state/{auth,mockClient}.ts
└── hooks/useRouteSound.ts
```

## Canvas runtime (`src/canvas/`)

The in-world view is a PixiJS v8 Application mounted by `<GameCanvas/>` inside
the `/play` route. The HUD layer (`src/play/`) sits *above* the canvas as a
Solid CSS layer with `pointer-events: none` on the wrapper and `pointer-events:
auto` on interactive children — the canvas keeps drag/click while the HUD is
keyboard-reachable.

Modules:

- `app.ts` — boot/teardown runtime; resolves the active scale mode and wires
  every subsystem
- `scale.ts` — **game scale mode** (see below) — single source of truth for
  every scale-sensitive constant
- `tiles.ts` — isometric tile rendering (currently programmatic colored
  diamonds; see "Tile rendering roadmap" below for the migration plan)
- `sprites.ts` — atlas loader, manifest at `public/sprites.json`
- `camera.ts` — pan / zoom / follow with critical-damped easing
- `player.ts` / `npc.ts` — sprites + tile-by-tile A\* walk
- `pathfinding.ts` — 4-connected A\* with binary heap (server-authoritative
  per Doc #23; this is a placeholder)
- `triggers.ts` — emits `br:trigger:dialog` / `loot` / `transition`
  CustomEvents on a shared EventTarget that the route layer consumes
- `dayNight.ts`, `lighting.ts`, `combatFx.ts`, `perfOverlay.ts`,
  `determinism.ts` — visual layers + dev/perf hooks

## Game scale mode

`src/canvas/scale.ts` bundles every scale-sensitive constant (tile pixel
dims, sprite render scale, camera zoom band, walk speeds, lighting radii,
decor anchors, atlas manifest source) into a single switchable preset.

Two presets ship today:

| Mode | Tile (px) | Render | Camera | Notes |
| --- | --- | --- | --- | --- |
| `kenney-miniature` (default) | 128×64 | chunky | 0.4–2.0× | Matches the Kenney isometric-miniature kit currently in `_tileart/` |
| `ultima-vii` | 64×32 | flatter | 0.7–3.5× | Larger world feel — for when we move to flatter Ultima VII-style art |

Active mode resolution chain (first match wins):

1. `mountCanvas({ scaleMode: '...' })` explicit option
2. `?scale=<id>` query param on the URL (handy for testing without rebuilding)
3. `localStorage('pv.canvas.scaleMode')` (sticky preference)
4. `DEFAULT_SCALE_MODE` constant (currently `kenney-miniature`)

Adding a mode: add a const matching the `ScaleMode` shape, register it in
`SCALE_MODES`, extend `ScaleModeId`. Every consumer reading from this module
picks it up automatically — no per-system patches.

## Tile rendering roadmap

Today `tiles.ts` draws colored iso diamonds programmatically (decor too —
trees, buildings, moongates as primitive shapes). This is fine for the demo
but doesn't scale to authoring a real Britannia. Selected approach:

**Tiled Map Editor + `pixi-tiledmap`** (selected 2026-05-05).

- **Tiled** (free, OSS, native isometric support — including staggered/hex)
  is the editor. Designers paint maps with layers, objects, animations, and
  custom properties; export `.tmj` (JSON) or `.tmx`.
- **`pixi-tiledmap`** (npm, v2.4.0, Pixi v8-compatible) loads `.tmj` directly
  into a `PIXI.Container` — handles all orientations, tile/object layers,
  animations, flips, parallax, infinite/chunked maps.
- Kenney publishes Tiled-ready tileset exports for the
  isometric-miniature + retro-fantasy kits already in `_tileart/`.

**Why this over `pixi-isometric-tilemaps`:** the Tiled ecosystem wins on
iteration velocity (designers don't write JSON), maintenance (pixi-tiledmap
v2.4.0 published ~3 weeks ago), and UGC fit (Doc #7 — `.tmj` is the de-facto
community format).

**Integration plan** (deferred — not yet implemented):

1. `pnpm --filter @br/web add pixi-tiledmap@^2.4.0`
2. Add `tileMapSource: string` to `ScaleMode` pointing at e.g.
   `/maps/<region>.<mode>.tmj`. Each scale mode declares the tileset that
   matches its art, so `?scale=ultima-vii` loads a flatter map.
3. New `tiles.ts` path: load `.tmj` via `pixi-tiledmap`, parent its
   container under `world`. Keep the current programmatic drawing as the
   "registry-load-failed" fallback (already useful — see `app.ts:loadAssets`).
4. `tools/tiled/tmj-to-tilemap.ts` — converter that mirrors the editor
   source into `@br/mocks/data/world/tiles/<region>.json`. Tiled becomes
   the *source*; the typed JSON in `@br/mocks` stays the *wire-format*
   placeholder for the eventual protobuf codegen target (Doc #22 §4.5).
5. Per-region maps land in `apps/web/public/maps/<region>.<mode>.tmj`
   alongside their tileset images.

## Mock-to-real swap path

The eventual swap from mocks to real backend goes through the `MockClient`
seam in `@br/mocks` — replace it with a `ProtobufClient` that hits the
Rust shard server (Doc #41).

The HUD → canvas player-intent channel (move/target/cast) is currently
TODO-marked in `src/play/AbilityBar.tsx`, `SpellRing.tsx`, `PortalModal.tsx`.
Wave 4 wires those events back into the canvas (and onward to the server).

## Plan reference

For the full Phase 0–8 plan see `/_todo/todobatch2.txt`. Phases done:

- Phase 0 (foundations) ✓
- Phase 1 (design system) ✓ — see `packages/ui/`
- Phase 2 (mocks + types) ✓ — see `packages/mocks/`
- Phase 3 (app shell + routing) ✓
- Phase 4 (marketing site — Astro) ✓ — see `apps/site/`
- Phase 5 (game screens) ✓
- Phase 6 (PixiJS canvas) ✓
- Phase 7 (a11y/i18n/telemetry polish) — pending
- Phase 8 (docs + handoff) — pending
