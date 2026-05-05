# Doc #43 — World Editor

**Status:** Drafted 2026-05-05. MVP scoped; v2 deferred.

## Why

Authoring `.tmj`/`.tmx` files in the desktop Tiled editor is the long-term pipeline (Doc #14, integration plan in `apps/web/README.md`). But for designers, modders, and players to iterate on Avermere maps without leaving the game client — and to ship UGC modding (Doc #7) — the project needs a first-class in-app **World Editor**: a Solid + PixiJS screen that loads tile palettes, lets the user paint maps on a grid, and exports `.tmj` round-trip-compatible with Tiled.

The MVP is intentionally narrow: a single-room editor with a tile palette sourced from the Kenney isometric-miniature library kit on R2 (`media.gamecodex.com/tile/library/iso/`). That validates the architecture and ships a useful tool. v2 expands to multi-layer, multi-region, custom properties, and server persistence.

## Entry point

A new **"Open World Editor"** button on the marketing site `/worlds` page navigates to the in-game route `/play/editor` on the game client (auth-gated like every other `/play/*` route). The button is conditionally visible — a feature flag + auth state — so we can soft-launch without confusing public visitors.

## MVP scope

Implemented in `apps/web/src/editor/` and routed at `/play/editor`:

1. **Canvas surface.** Same PixiJS app shape as the in-game canvas — re-uses `apps/web/src/canvas/scale.ts`, the iso projection from `tiles.ts`, and the `pixi-tiledmap` loader from `tilesTiled.ts` for preview rendering. Default scale mode = `kenney-miniature` (256×128 iso, library art).
2. **Tile palette panel.** A scrollable left-side panel that displays every tile defined in the active mode's tileset(s), keyed by id, sourced from the same R2 prefix the in-game canvas uses. MVP loads the **library** kit only; the palette enumerates the ~144 sprites from `media.gamecodex.com/tile/library/iso/` via a manifest fetch (a new `tools/r2-list/library.json` listing kept in `apps/web/public/maps/library-iso.manifest.json` for now — eventually generated from R2 directly).
3. **Grid editor.** A 16×16 tile grid (resizable in the toolbar — see below), default kenney-miniature dims. Click-to-paint with the selected tile. Right-click to erase. Two layers: `ground` (one tile per cell) and `decor` (one optional sprite per cell). Layer toggle in the toolbar.
4. **Toolbar.** Buttons for: Select tool, Paint tool, Erase tool, Layer toggle (ground / decor), Grid size (10×10 / 16×16 / 24×24), Show grid lines toggle, Export `.tmj`, Import `.tmj`, Reset.
5. **Camera + interaction.** Pan with middle/right-drag, zoom with wheel — re-uses `Camera` from `apps/web/src/canvas/camera.ts` with editor-tuned zoom band (0.25x–1.5x).
6. **Export `.tmj`.** Serialize the current grid to a Tiled JSON map with `width`, `height`, `tilewidth`, `tileheight` from the active scale mode, two `tilelayer`s (`ground` and `decor`), and an external `tileset` reference at `https://media.gamecodex.com/tile/library/iso/library.tsj`. Trigger a browser file download (no server upload yet). The `.tmj` is round-trip compatible with desktop Tiled — designers can refine in either tool.
7. **Import `.tmj`.** File-picker upload reads a `.tmj` and re-populates the grid + decor layer. Validates that the tileset matches one of our known kits.
8. **Save state.** Editor state persists to `localStorage('pv.editor.state.v1')` between sessions so accidental tab-closes don't lose work. Cleared by the Reset toolbar button (with confirm).

## Out of scope for MVP

- Server persistence (no `POST /v1/maps`).
- Multi-region / world-stitching.
- Custom Tiled object layers (rectangles, polygons, points).
- Animated tiles or tile property editing.
- Undo/redo (could land in a fast follow-up — leave a `Cmd[]` stack hook).
- Mobile/touch (desktop pointer only for v1).
- Auth-gated UGC publishing.
- The `flat-classic` scale mode's tile palette (only kenney-miniature ships in v1; the editor refuses to switch modes until a flat-classic kit is uploaded to R2).

## Architecture

```
apps/web/src/editor/
├── EditorScreen.tsx          # Solid component; mounted at /play/editor
├── EditorCanvas.tsx          # PixiJS host; analogous to GameCanvas.tsx
├── editor.module.css         # parchment-tinted UI chrome
├── state/
│   ├── editorState.ts        # Solid signals — selectedTool, selectedTileId,
│   │                           layer, gridW, gridH, paintedCells, decorCells
│   ├── persist.ts            # localStorage round-trip
│   └── tileset.ts            # palette manifest fetch + Texture cache
├── ui/
│   ├── Toolbar.tsx           # @br/ui IconButton row
│   ├── PalettePanel.tsx      # scrollable tile grid; keyboard-navigable
│   ├── StatusBar.tsx         # tile count, grid size, hover coords
│   └── ConfirmReset.tsx      # @br/ui Confirm wrapper
├── lib/
│   ├── exportTmj.ts          # current state → Tiled JSON
│   ├── importTmj.ts          # Tiled JSON → state
│   └── isoHit.ts             # screen→grid for paint clicks
└── __tests__/
    ├── exportTmj.test.ts     # known state → expected JSON
    ├── importTmj.test.ts     # round-trip
    └── editorState.test.ts   # paint/erase/undo

apps/web/public/maps/library-iso.manifest.json
                             # MVP-only: hand-listed library sprite ids until
                             # the R2 listing endpoint exists. Each entry is
                             # { id, label, src (absolute R2 URL), w, h }.

apps/site/src/pages/worlds/index.astro
                             # add CTA: "Open World Editor →" linking to
                             # https://web.virtu3.com/play/editor (or a
                             # local equivalent during dev)

apps/web/src/router.tsx      # add the /play/editor route, behind <Guard>
```

## Schema — the export format

Tiled `.tmj` (JSON) per the official spec. We emit the minimal shape:

```jsonc
{
  "type": "map",
  "version": "1.10",
  "tiledversion": "1.11.0",
  "orientation": "isometric",
  "renderorder": "right-down",
  "width": 16,
  "height": 16,
  "tilewidth": 256,
  "tileheight": 128,
  "infinite": false,
  "tilesets": [
    { "firstgid": 1, "source": "https://media.gamecodex.com/tile/library/iso/library.tsj" }
  ],
  "layers": [
    { "type": "tilelayer", "id": 1, "name": "ground", "width": 16, "height": 16, "data": [/* 16*16 ids */] },
    { "type": "tilelayer", "id": 2, "name": "decor",  "width": 16, "height": 16, "data": [/* sparse */] }
  ]
}
```

The external tileset (`library.tsj`) is uploaded to R2 once — it lists every library iso sprite as a `{ id, image }` row with image URLs absolute to the same bucket. Maintaining the tileset on R2 (not in the repo) keeps multi-team authoring sane and matches the "production assets in R2" rule (see asset-pipeline memory).

## Implementation phases

| Phase | Deliverable | Estimate |
|---|---|---|
| **1. Skeleton** | `/play/editor` route renders an empty PixiJS canvas + Toolbar + empty PalettePanel; auth-gated; "Open World Editor" CTA on `/worlds` | 0.5 day |
| **2. Palette** | `tileset.ts` fetches `library-iso.manifest.json`, Texture cache populated, PalettePanel shows ~30 representative library sprites with hover labels | 0.5 day |
| **3. Paint** | Click-to-paint on the grid for the `ground` layer; iso projection from `scale.ts`; cells stored in `editorState`. Erase with right-click. | 0.5 day |
| **4. Decor + layers** | `decor` layer, layer toggle, ground/decor visual separation. Save+restore via `persist.ts`. | 0.5 day |
| **5. Export/Import** | `exportTmj.ts`, `importTmj.ts`, file download/upload UI, round-trip-tested in unit tests + against desktop Tiled. | 0.5 day |
| **6. Polish** | Hover preview, status bar, grid-size toggle, confirm-reset, accessibility (keyboard tile selection, ARIA). | 0.5 day |

Total ~3 days of focused work. Spin one agent for phases 1–5; phase 6 is a fast-follow polish pass.

## v2 (deferred — separate doc when we get there)

- Server persistence + sharing (Doc #7 UGC pipeline)
- Multi-tileset switching (drop in farm + dungeon kits)
- Object layers + custom tile properties (walkability bool, NPC spawn points, region transitions)
- Multi-region world stitching with portal links
- Undo/redo
- Touch + tablet
- Real-time collaborative editing

## Open questions

1. Where does the editor's saved `.tmj` live in production? MVP: browser localStorage + manual file download. v2: `POST /v1/maps` → R2 upload via signed URL. **Default position:** local-only for now; revisit with the auth/persistence work.
2. How does the editor compose with the in-game canvas when the user opens "preview"? MVP: separate route, no preview button; v2: a Preview drawer that boots the runtime canvas with the editor's current state injected as `tileMapSource`. **Default position:** out of scope; document the seam for v2.
3. Does the editor need its own scale mode? MVP: re-uses `kenney-miniature` directly; v2: an `editor` mode with stronger zoom-out. **Default position:** re-use; flag if zoom feels cramped during MVP testing.

## Cross-doc references

- Doc #7 — UGC Modding (the editor is the user-facing on-ramp)
- Doc #14 — MCP Server Surface (the eventual `POST /v1/maps` endpoint lives here)
- Doc #22 — Network Protocol & Replication (map persistence wire format)
- Doc #41 — Engine & Stack ADR (web client is permanent — this editor ships forever)
- `apps/web/README.md` — Tiled integration plan (in-game side; the editor is the authoring side of the same pipeline)
