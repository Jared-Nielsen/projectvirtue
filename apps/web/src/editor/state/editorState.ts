// Editor state — Solid signals + plain helpers.
//
// The editor MVP keeps every authoring concern in this single module so the
// .tmj export/import code can read a tiny well-defined shape without touching
// PixiJS or the DOM. The grid is two flat `Int32Array`s (one per layer)
// because:
//   • That's the wire format the Tiled .tmj `data` field expects (row-major
//     left-to-right top-to-bottom array of GIDs, 0 = empty).
//   • Resizing is cheap (alloc a new typed array, copy over the surviving
//     overlap) and structuredClone-friendly for the persist layer.
//
// All mutations go through this module's exported helpers — never poke the
// signal value object directly. That keeps `persist.ts` correct (every
// mutation triggers the same setEditorState reaction).
//
// Out of scope for MVP (see Doc #43):
//   • undo/redo (would maintain a Cmd[] stack here)
//   • multi-tileset switching
//   • object layers, custom tile properties

import { type Setter, createSignal } from 'solid-js';

export type EditorTool = 'paint' | 'erase';
export type EditorLayer = 'ground' | 'decor';

export const ALLOWED_GRID_SIZES = [10, 16, 24] as const;
export type GridSize = (typeof ALLOWED_GRID_SIZES)[number];

export const DEFAULT_GRID_SIZE: GridSize = 16;

export interface EditorState {
  /** Active tool. Right-click always erases regardless of tool. */
  readonly tool: EditorTool;
  /** Which layer paint goes to. */
  readonly layer: EditorLayer;
  /** Selected palette tile id (the eventual .tmj GID — 1-indexed). 0 means
   *  no selection (paint clicks are no-ops while 0). */
  readonly selectedTileId: number;
  /** Current grid dims (square). */
  readonly gridSize: GridSize;
  /** Show the grid line overlay on the canvas. */
  readonly showGrid: boolean;
  /** Row-major flat tile id arrays. Length = gridSize*gridSize. */
  readonly ground: ReadonlyArray<number>;
  readonly decor: ReadonlyArray<number>;
}

export interface EditorActions {
  setTool(tool: EditorTool): void;
  setLayer(layer: EditorLayer): void;
  setSelectedTileId(id: number): void;
  setGridSize(size: GridSize): void;
  setShowGrid(show: boolean): void;
  paint(x: number, y: number): void;
  erase(x: number, y: number): void;
  reset(): void;
  /** Replace the editable layers wholesale (used by importTmj + persist). */
  replace(grid: { gridSize: GridSize; ground: number[]; decor: number[] }): void;
}

function emptyLayer(size: GridSize): number[] {
  return new Array<number>(size * size).fill(0);
}

export function makeInitialState(size: GridSize = DEFAULT_GRID_SIZE): EditorState {
  return {
    tool: 'paint',
    layer: 'ground',
    selectedTileId: 0,
    gridSize: size,
    showGrid: true,
    ground: emptyLayer(size),
    decor: emptyLayer(size),
  };
}

/** Pure: return a new state with a single cell painted (or cleared). */
export function applyPaint(
  state: EditorState,
  layer: EditorLayer,
  x: number,
  y: number,
  tileId: number,
): EditorState {
  if (!isInBounds(state.gridSize, x, y)) return state;
  const idx = y * state.gridSize + x;
  const target = layer === 'ground' ? state.ground : state.decor;
  if ((target[idx] ?? 0) === tileId) return state;
  const next = target.slice();
  next[idx] = tileId;
  return layer === 'ground' ? { ...state, ground: next } : { ...state, decor: next };
}

/** Pure: resize the grid, preserving the overlap top-left corner. */
export function applyResize(state: EditorState, next: GridSize): EditorState {
  if (next === state.gridSize) return state;
  const ground = emptyLayer(next);
  const decor = emptyLayer(next);
  const copy = Math.min(state.gridSize, next);
  for (let y = 0; y < copy; y++) {
    for (let x = 0; x < copy; x++) {
      const fromIdx = y * state.gridSize + x;
      const toIdx = y * next + x;
      ground[toIdx] = state.ground[fromIdx] ?? 0;
      decor[toIdx] = state.decor[fromIdx] ?? 0;
    }
  }
  return { ...state, gridSize: next, ground, decor };
}

export function isInBounds(size: GridSize, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

/** Build the Solid signal + matching mutator API. The persistence layer
 *  reads the signal accessor and re-saves on every transition. */
export function createEditorStore(
  initial: EditorState = makeInitialState(),
): readonly [() => EditorState, EditorActions, Setter<EditorState>] {
  const [state, setState] = createSignal(initial, { equals: false });

  const actions: EditorActions = {
    setTool(tool) {
      setState((prev) => (prev.tool === tool ? prev : { ...prev, tool }));
    },
    setLayer(layer) {
      setState((prev) => (prev.layer === layer ? prev : { ...prev, layer }));
    },
    setSelectedTileId(id) {
      setState((prev) => (prev.selectedTileId === id ? prev : { ...prev, selectedTileId: id }));
    },
    setGridSize(size) {
      setState((prev) => applyResize(prev, size));
    },
    setShowGrid(show) {
      setState((prev) => (prev.showGrid === show ? prev : { ...prev, showGrid: show }));
    },
    paint(x, y) {
      setState((prev) => {
        if (prev.selectedTileId <= 0) return prev;
        return applyPaint(prev, prev.layer, x, y, prev.selectedTileId);
      });
    },
    erase(x, y) {
      setState((prev) => applyPaint(prev, prev.layer, x, y, 0));
    },
    reset() {
      setState(makeInitialState(DEFAULT_GRID_SIZE));
    },
    replace(grid) {
      setState((prev) => ({
        ...prev,
        gridSize: grid.gridSize,
        ground: grid.ground.slice(),
        decor: grid.decor.slice(),
      }));
    },
  };

  return [state, actions, setState];
}
