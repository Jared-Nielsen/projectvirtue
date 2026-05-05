// Editor canvas — PixiJS application that renders the paint grid + overlay.
//
// Mirrors the shape of `apps/web/src/canvas/GameCanvas.tsx` (host div, async
// mount, cleanup-on-unmount) but with a much smaller surface: no NPCs, no
// pathfinding, no day/night. Just:
//   • a Pixi Application
//   • a `world` Container parented to the stage and driven by the shared
//     Camera (zoom band tuned for editor authoring per Doc #43)
//   • a tile container that renders real R2-hosted library sprites for
//     painted cells, faint outline diamonds for empty cells
//   • a thin grid-line overlay (toggleable from the toolbar)
//   • a click-to-paint pointer pipeline routed back to the `actions` API
//
// Texture rendering: when the parent passes a resolved palette manifest, we
// preload every tile texture once via `Assets.load` and cache them keyed by
// gid. Each painted cell becomes a Sprite anchored at (0.5, SPRITE_ANCHOR_Y)
// so the 256x128 diamond at the bottom of each 256x512 Kenney PNG sits at
// the projected screen point. While the textures are still loading, painted
// cells render the legacy tinted-diamond fallback so the grid stays usable.
//
// TODO(editor-v2): Boot a "preview" runtime that re-uses the in-game
// CanvasRuntime with the editor's current grid injected as `tileMapSource`.
// Doc #43 §"Open question 2" — out of scope for MVP.

import {
  Application,
  Assets,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Sprite,
  type Texture,
} from 'pixi.js';
import { type Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Camera } from '../canvas/camera';
import { type IsoMetrics, makeIsoProjector } from '../canvas/tiles';
import { worldToGrid } from './lib/isoHit';
import type { EditorActions, EditorState } from './state/editorState';
import type { PaletteManifest } from './state/tileset';

export interface EditorCanvasProps {
  readonly state: () => EditorState;
  readonly actions: EditorActions;
  readonly metrics: IsoMetrics;
  /** Resolved palette manifest. Pass null while the parent's createResource
   *  is still loading; the canvas will fall back to colored diamonds until
   *  textures are available. */
  readonly manifest: PaletteManifest | null;
  readonly class?: string;
}

const EDITOR_ZOOM = { min: 0.25, max: 1.5, initial: 0.5 } as const;
const GRID_LINE_COLOR = 0xc8b890;
const GRID_LINE_ALPHA = 0.55;
const TILE_OUTLINE_ALPHA = 0.25;

// Kenney isometric-miniature PNGs are 256x512 with the 256x128 iso diamond
// at the bottom. The diamond center sits at row (512 - 64) = 448 from the
// top; as a normalized anchor that's 448/512 = 0.875.
const SPRITE_ANCHOR_X = 0.5;
const SPRITE_ANCHOR_Y = 0.875;

/** Stable colour-from-id hash so the editor's tinted-diamond preview keeps
 *  the same colour for the same tile across paint sessions. Used as a
 *  fallback while the real Texture is still loading. */
function tileColor(id: number): number {
  if (id <= 0) return 0x000000;
  let h = id * 0x9e3779b1;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  const r = 0x60 + (h & 0x7f);
  const g = 0x60 + ((h >>> 7) & 0x7f);
  const b = 0x60 + ((h >>> 14) & 0x7f);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

interface MountedRuntime {
  readonly app: Application;
  readonly destroy: () => Promise<void>;
}

export const EditorCanvas: Component<EditorCanvasProps> = (props) => {
  let host: HTMLDivElement | undefined;
  let runtime: MountedRuntime | null = null;
  let cancelled = false;

  // Per-mount drawing handles, captured during async setup so the
  // createEffect below can rebuild the tile graphics whenever the state
  // signal flips.
  let tilesContainer: Container | null = null;
  let gridLines: Graphics | null = null;

  // Texture cache for the loaded library palette. Keyed by gid; populated
  // asynchronously when the manifest arrives. The signal triggers the
  // rebuild effect once textures are ready.
  const [textures, setTextures] = createSignal<ReadonlyMap<number, Texture>>(new Map());

  /** Render a fallback colored-diamond Graphics for cells whose texture
   *  isn't loaded yet (or for the empty-cell outline). */
  function makeFallbackDiamond(
    metrics: IsoMetrics,
    color: number,
    alpha: number,
    fill: boolean,
  ): Graphics {
    const halfW = metrics.tileW / 2;
    const halfH = metrics.tileH / 2;
    const g = new Graphics().poly([0, -halfH, halfW, 0, 0, halfH, -halfW, 0]);
    if (fill) {
      g.fill({ color, alpha });
    }
    g.stroke({ color: 0x000000, alpha: TILE_OUTLINE_ALPHA, width: 1 });
    return g;
  }

  function rebuildTiles(state: EditorState, metrics: IsoMetrics): void {
    if (!tilesContainer) return;
    tilesContainer.removeChildren();
    const project = makeIsoProjector(metrics);
    const size = state.gridSize;
    const tex = textures();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const groundId = state.ground[idx] ?? 0;
        const decorId = state.decor[idx] ?? 0;
        const { sx, sy } = project(x, y);

        // Empty floor cell — faint outline so authors can see the grid
        // footprint without a noisy fill behind real tiles.
        if (groundId <= 0) {
          const empty = makeFallbackDiamond(metrics, 0x000000, 0, false);
          empty.x = sx;
          empty.y = sy;
          empty.zIndex = x + y;
          tilesContainer.addChild(empty);
        } else {
          const groundTex = tex.get(groundId);
          if (groundTex) {
            const sprite = new Sprite(groundTex);
            sprite.anchor.set(SPRITE_ANCHOR_X, SPRITE_ANCHOR_Y);
            sprite.x = sx;
            sprite.y = sy;
            sprite.zIndex = x + y;
            tilesContainer.addChild(sprite);
          } else {
            // Texture still loading or load failed — colored fallback.
            const fallback = makeFallbackDiamond(metrics, tileColor(groundId), 0.92, true);
            fallback.x = sx;
            fallback.y = sy;
            fallback.zIndex = x + y;
            tilesContainer.addChild(fallback);
          }
        }

        if (decorId > 0) {
          const decorTex = tex.get(decorId);
          if (decorTex) {
            const sprite = new Sprite(decorTex);
            sprite.anchor.set(SPRITE_ANCHOR_X, SPRITE_ANCHOR_Y);
            sprite.x = sx;
            sprite.y = sy;
            sprite.zIndex = x + y + 0.5;
            tilesContainer.addChild(sprite);
          } else {
            const halfW = metrics.tileW / 2;
            const halfH = metrics.tileH / 2;
            const decor = new Graphics()
              .rect(-halfW * 0.32, -halfH * 1.4, halfW * 0.64, halfH * 1.5)
              .fill({ color: tileColor(decorId), alpha: 0.95 });
            decor.x = sx;
            decor.y = sy;
            decor.zIndex = x + y + 0.5;
            tilesContainer.addChild(decor);
          }
        }
      }
    }
  }

  function rebuildGridLines(state: EditorState, metrics: IsoMetrics): void {
    if (!gridLines) return;
    gridLines.clear();
    if (!state.showGrid) {
      gridLines.visible = false;
      return;
    }
    gridLines.visible = true;
    const project = makeIsoProjector(metrics);
    const size = state.gridSize;
    for (let i = 0; i <= size; i++) {
      const a = project(i, 0);
      const b = project(i, size);
      gridLines.moveTo(a.sx, a.sy).lineTo(b.sx, b.sy);
      const c = project(0, i);
      const d = project(size, i);
      gridLines.moveTo(c.sx, c.sy).lineTo(d.sx, d.sy);
    }
    gridLines.stroke({ color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA, width: 1 });
  }

  async function mount(): Promise<MountedRuntime> {
    if (!host) throw new Error('EditorCanvas mounted without host element');
    const app = new Application();
    await app.init({
      background: 0x14110c,
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';

    const world = new Container();
    world.label = 'editor-world';
    world.sortableChildren = true;
    app.stage.addChild(world);

    tilesContainer = new Container();
    tilesContainer.sortableChildren = true;
    tilesContainer.label = 'editor-tiles';
    tilesContainer.eventMode = 'static';
    world.addChild(tilesContainer);

    gridLines = new Graphics();
    gridLines.label = 'editor-grid-lines';
    gridLines.zIndex = 9999;
    world.addChild(gridLines);

    // World bounds so the camera clamps to the painted area + a margin.
    const sizeForBounds = (): number => props.state().gridSize;
    const computeBounds = (): {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } => {
      const project = makeIsoProjector(props.metrics);
      const s = sizeForBounds();
      const corners = [project(0, 0), project(s, 0), project(0, s), project(s, s)];
      const xs = corners.map((c) => c.sx);
      const ys = corners.map((c) => c.sy);
      return {
        minX: Math.min(...xs) - props.metrics.tileW,
        maxX: Math.max(...xs) + props.metrics.tileW,
        minY: Math.min(...ys) - props.metrics.tileH,
        maxY: Math.max(...ys) + props.metrics.tileH,
      };
    };

    const camera = new Camera({
      stage: app.stage,
      app,
      world,
      bounds: computeBounds(),
      minZoom: EDITOR_ZOOM.min,
      maxZoom: EDITOR_ZOOM.max,
      initialZoom: EDITOR_ZOOM.initial,
    });
    camera.centerOn(0, 0);

    // Click-to-paint / right-click-erase. We listen on the world stage
    // because the tiles container's children have eventMode=auto by
    // default and we want a single delegated handler regardless of
    // whether the click landed on a Graphics or empty cell.
    function handlePaintEvent(ev: FederatedPointerEvent): void {
      // Skip middle / right buttons used for camera pan; right-click
      // *without* drag is treated as erase via a separate down handler.
      if (ev.button === 1) return;
      const local = world.toLocal(ev.global);
      const cell = worldToGrid(props.metrics, props.state().gridSize, local.x, local.y);
      if (!cell) return;
      if (ev.button === 2 || props.state().tool === 'erase') {
        props.actions.erase(cell.x, cell.y);
      } else {
        props.actions.paint(cell.x, cell.y);
      }
    }
    tilesContainer.on('pointerdown', handlePaintEvent);
    // Drag-paint: while the left button is held, repeat paint on each
    // pointermove that lands on a new cell. We track the last painted
    // cell so we don't burn cycles on duplicate ops.
    let lastCell: { x: number; y: number } | null = null;
    let dragging = false;
    function onPointerDown(ev: FederatedPointerEvent): void {
      if (ev.button === 0) dragging = true;
    }
    function onPointerUp(): void {
      dragging = false;
      lastCell = null;
    }
    function onPointerMove(ev: FederatedPointerEvent): void {
      if (!dragging) return;
      const local = world.toLocal(ev.global);
      const cell = worldToGrid(props.metrics, props.state().gridSize, local.x, local.y);
      if (!cell) return;
      if (lastCell && lastCell.x === cell.x && lastCell.y === cell.y) return;
      lastCell = cell;
      if (props.state().tool === 'erase') {
        props.actions.erase(cell.x, cell.y);
      } else {
        props.actions.paint(cell.x, cell.y);
      }
    }
    tilesContainer.on('pointerdown', onPointerDown);
    tilesContainer.on('pointermove', onPointerMove);
    tilesContainer.on('pointerup', onPointerUp);
    tilesContainer.on('pointerupoutside', onPointerUp);

    rebuildTiles(props.state(), props.metrics);
    rebuildGridLines(props.state(), props.metrics);

    app.ticker.add((ticker) => {
      camera.update(ticker.deltaMS / 1000);
    });

    return {
      app,
      async destroy() {
        camera.destroy();
        tilesContainer?.off('pointerdown', handlePaintEvent);
        tilesContainer?.off('pointerdown', onPointerDown);
        tilesContainer?.off('pointermove', onPointerMove);
        tilesContainer?.off('pointerup', onPointerUp);
        tilesContainer?.off('pointerupoutside', onPointerUp);
        app.ticker.stop();
        app.destroy(true, { children: true, texture: false });
      },
    };
  }

  onMount(() => {
    void (async () => {
      try {
        const next = await mount();
        if (cancelled) {
          await next.destroy();
          return;
        }
        runtime = next;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EditorCanvas] mount failed', err);
        if (host) {
          host.textContent = 'Editor canvas failed to start. See console.';
          host.style.color = '#fca';
          host.style.padding = '1rem';
        }
      }
    })();
  });

  onCleanup(() => {
    cancelled = true;
    if (runtime) {
      void runtime.destroy();
      runtime = null;
    }
    tilesContainer = null;
    gridLines = null;
  });

  // Re-render the tile graphics whenever state OR the texture cache
  // changes. Solid's createEffect tracks both `props.state()` and `textures()`.
  createEffect(() => {
    const state = props.state();
    textures();
    if (!tilesContainer) return;
    rebuildTiles(state, props.metrics);
    rebuildGridLines(state, props.metrics);
  });

  // Preload all palette textures whenever a fresh manifest arrives. Each
  // load is cached by Pixi's Assets layer so subsequent mounts (Solid HMR,
  // route re-entry) do not re-fetch. We update the signal once at the end
  // of the batch rather than per-tile so Solid only re-runs the rebuild
  // effect once per manifest.
  createEffect(() => {
    const manifest = props.manifest;
    if (!manifest) return;
    let aborted = false;
    void (async () => {
      const next = new Map<number, Texture>();
      try {
        const loaded = await Promise.all(
          manifest.tiles.map(async (t) => {
            try {
              const tex = (await Assets.load(t.src)) as Texture;
              return [t.id, tex] as const;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn(`[editor] texture load failed for gid ${t.id} (${t.src})`, err);
              return null;
            }
          }),
        );
        for (const entry of loaded) {
          if (entry) next.set(entry[0], entry[1]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[editor] palette texture preload failed', err);
      }
      if (!aborted) setTextures(next);
    })();
    onCleanup(() => {
      aborted = true;
    });
  });

  return (
    <div
      ref={host}
      class={props.class}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        'min-height': '480px',
        background: '#101418',
        overflow: 'hidden',
      }}
    />
  );
};
