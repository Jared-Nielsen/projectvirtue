// Editor canvas — PixiJS application that renders the paint grid + overlay.
//
// Mirrors the shape of `apps/web/src/canvas/GameCanvas.tsx` (host div, async
// mount, cleanup-on-unmount) but with a much smaller surface: no NPCs, no
// pathfinding, no day/night. Just:
//   • a Pixi Application
//   • a `world` Container parented to the stage and driven by the shared
//     Camera (zoom band tuned for editor authoring per Doc #43)
//   • a tile container that paints filled diamonds for every cell in the
//     `ground` and `decor` layers
//   • a thin grid-line overlay (toggleable from the toolbar)
//   • a click-to-paint pointer pipeline routed back to the `actions` API
//
// Texture rendering: the MVP uses lightweight tinted Graphics rather than
// loading the full library Texture set into the canvas. The palette panel
// shows the real PNGs (via <img>); the canvas is a sketchy preview keyed
// by tile-id colour so authors can see the layout without paying the full
// PNG download cost on every paint. v2 swaps this to actual Sprites loaded
// from the palette manifest — seam marked with a TODO.
//
// TODO(editor-v2): Boot a "preview" runtime that re-uses the in-game
// CanvasRuntime with the editor's current grid injected as `tileMapSource`.
// Doc #43 §"Open question 2" — out of scope for MVP.

import { Application, Container, type FederatedPointerEvent, Graphics } from 'pixi.js';
import { type Component, createEffect, onCleanup, onMount } from 'solid-js';
import { Camera } from '../canvas/camera';
import { type IsoMetrics, makeIsoProjector } from '../canvas/tiles';
import { worldToGrid } from './lib/isoHit';
import type { EditorActions, EditorState } from './state/editorState';

export interface EditorCanvasProps {
  readonly state: () => EditorState;
  readonly actions: EditorActions;
  readonly metrics: IsoMetrics;
  readonly class?: string;
}

const EDITOR_ZOOM = { min: 0.25, max: 1.5, initial: 0.5 } as const;
const GRID_LINE_COLOR = 0xc8b890;
const GRID_LINE_ALPHA = 0.55;
const TILE_OUTLINE_ALPHA = 0.25;

/** Stable colour-from-id hash so the editor's tinted-diamond preview keeps
 *  the same colour for the same tile across paint sessions. */
function tileColor(id: number): number {
  if (id <= 0) return 0x000000;
  // Cheap hash → 24-bit RGB. Tuned to land in earthy parchment-friendly
  // ranges by clamping each channel to 0x60-0xe0.
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

  function rebuildTiles(state: EditorState, metrics: IsoMetrics): void {
    if (!tilesContainer) return;
    tilesContainer.removeChildren();
    const project = makeIsoProjector(metrics);
    const halfW = metrics.tileW / 2;
    const halfH = metrics.tileH / 2;
    const size = state.gridSize;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const groundId = state.ground[idx] ?? 0;
        const decorId = state.decor[idx] ?? 0;
        const { sx, sy } = project(x, y);
        const groundColor = groundId > 0 ? tileColor(groundId) : 0x1c1812;
        const fillAlpha = groundId > 0 ? 0.92 : 0.6;
        const tile = new Graphics();
        tile
          .poly([0, -halfH, halfW, 0, 0, halfH, -halfW, 0])
          .fill({ color: groundColor, alpha: fillAlpha })
          .stroke({ color: 0x000000, alpha: TILE_OUTLINE_ALPHA, width: 1 });
        tile.x = sx;
        tile.y = sy;
        tile.zIndex = x + y;
        tilesContainer.addChild(tile);

        if (decorId > 0) {
          const decor = new Graphics();
          const decorColor = tileColor(decorId);
          decor.rect(-halfW * 0.32, -halfH * 1.4, halfW * 0.64, halfH * 1.5).fill({
            color: decorColor,
            alpha: 0.95,
          });
          decor.x = sx;
          decor.y = sy;
          decor.zIndex = x + y + 0.5;
          tilesContainer.addChild(decor);
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

  // Re-render the tile graphics whenever state changes. Solid's createEffect
  // tracks the call to props.state().
  createEffect(() => {
    const state = props.state();
    if (!tilesContainer) return;
    rebuildTiles(state, props.metrics);
    rebuildGridLines(state, props.metrics);
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
