// Editor persistence — round-trip the EditorState to localStorage so a
// browser refresh / accidental tab close doesn't lose authoring work.
//
// The persisted shape is intentionally a subset of EditorState (no UI
// affordances like `tool` or `selectedTileId` — only the grid + size).
// That keeps stale data from forcing the editor into a broken UI mode after
// schema changes; we always re-derive the UI defaults on load.
//
// Key: 'pv.editor.state.v1'. Bump the suffix when the persisted shape
// changes incompatibly.

import type { EditorState, GridSize } from './editorState';
import { ALLOWED_GRID_SIZES } from './editorState';

export const STORAGE_KEY = 'pv.editor.state.v1';

interface PersistedV1 {
  readonly v: 1;
  readonly gridSize: GridSize;
  readonly ground: number[];
  readonly decor: number[];
}

export function serialize(state: EditorState): string {
  const payload: PersistedV1 = {
    v: 1,
    gridSize: state.gridSize,
    ground: state.ground.slice(),
    decor: state.decor.slice(),
  };
  return JSON.stringify(payload);
}

export interface DeserializedSnapshot {
  readonly gridSize: GridSize;
  readonly ground: number[];
  readonly decor: number[];
}

/** Parse a persisted snapshot. Returns null on any shape mismatch — the
 *  caller falls back to the default empty state. Never throws. */
export function deserialize(raw: string | null): DeserializedSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<PersistedV1>;
    if (candidate.v !== 1) return null;
    if (!isAllowedGridSize(candidate.gridSize)) return null;
    const expected = candidate.gridSize * candidate.gridSize;
    if (!Array.isArray(candidate.ground) || candidate.ground.length !== expected) return null;
    if (!Array.isArray(candidate.decor) || candidate.decor.length !== expected) return null;
    if (!candidate.ground.every(isNonNegativeInt)) return null;
    if (!candidate.decor.every(isNonNegativeInt)) return null;
    return {
      gridSize: candidate.gridSize,
      ground: candidate.ground.slice(),
      decor: candidate.decor.slice(),
    };
  } catch {
    return null;
  }
}

function isAllowedGridSize(value: unknown): value is GridSize {
  return typeof value === 'number' && (ALLOWED_GRID_SIZES as readonly number[]).includes(value);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** Read the persisted snapshot from localStorage. SSR-safe. */
export function loadFromStorage(): DeserializedSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    return deserialize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist the current editor state. SSR-safe; swallows quota errors. */
export function saveToStorage(state: EditorState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    /* private mode / quota — fail silently */
  }
}

export function clearStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a debounced save callback that fires `delayMs` after the last call. */
export function makeDebouncedSave(
  delayMs = 300,
  saver: (state: EditorState) => void = saveToStorage,
): (state: EditorState) => void {
  if (typeof window === 'undefined') {
    return (state) => saver(state);
  }
  let handle: number | null = null;
  let pending: EditorState | null = null;
  return (state: EditorState) => {
    pending = state;
    if (handle !== null) window.clearTimeout(handle);
    handle = window.setTimeout(() => {
      handle = null;
      if (pending) {
        saver(pending);
        pending = null;
      }
    }, delayMs);
  };
}
