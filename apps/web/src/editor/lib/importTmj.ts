// Tiled .tmj importer — reads a Tiled JSON map back into editor state.
//
// Validation philosophy: be strict, return a result object, never throw.
// The UI layer surfaces a `toast.error()` with the human-readable reason.
// We accept any tileset URL that points at the kenney-miniature library kit
// (the `library.tsj` we authored, or a sibling URL under the same R2 prefix
// — `media.gamecodex.com/tile/library/iso/`). Other tilesets reject for now;
// multi-tileset support is v2.

import { ALLOWED_GRID_SIZES, type GridSize } from '../state/editorState';

export interface ImportSuccess {
  readonly ok: true;
  readonly gridSize: GridSize;
  readonly ground: number[];
  readonly decor: number[];
}

export interface ImportFailure {
  readonly ok: false;
  readonly error: string;
}

export type ImportResult = ImportSuccess | ImportFailure;

/** R2 prefix used by every kenney-miniature library asset. */
export const LIBRARY_TILESET_PREFIX = 'https://media.gamecodex.com/tile/library/iso/';

interface RawLayer {
  readonly type?: unknown;
  readonly name?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
  readonly data?: unknown;
}

interface RawTileset {
  readonly source?: unknown;
}

interface RawMap {
  readonly type?: unknown;
  readonly orientation?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
  readonly tilesets?: unknown;
  readonly layers?: unknown;
}

export function parseTmj(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('File is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') {
    return fail('Expected a JSON object at the file root.');
  }
  const map = parsed as RawMap;
  if (map.type !== 'map') return fail('Not a Tiled map (missing `"type": "map"`).');
  if (map.orientation !== 'isometric') {
    return fail('Editor only imports isometric maps.');
  }
  const width = map.width;
  const height = map.height;
  if (!isAllowedGridSize(width) || width !== height) {
    return fail('Map must be square at 10×10, 16×16, or 24×24.');
  }

  if (!Array.isArray(map.tilesets) || map.tilesets.length === 0) {
    return fail('Map has no tilesets.');
  }
  const ts = map.tilesets[0] as RawTileset;
  if (typeof ts.source !== 'string' || !ts.source.startsWith(LIBRARY_TILESET_PREFIX)) {
    return fail(
      `Editor only accepts the kenney-miniature library tileset (${LIBRARY_TILESET_PREFIX}…).`,
    );
  }

  if (!Array.isArray(map.layers)) return fail('Map has no layers.');
  const ground = pickLayer(map.layers, 'ground', width);
  if (ground.kind === 'error') return fail(ground.message);
  const decor = pickLayer(map.layers, 'decor', width);
  if (decor.kind === 'error') return fail(decor.message);

  return {
    ok: true,
    gridSize: width,
    ground: ground.data,
    decor: decor.data,
  };
}

function pickLayer(
  layers: ReadonlyArray<unknown>,
  name: 'ground' | 'decor',
  size: number,
): { kind: 'ok'; data: number[] } | { kind: 'error'; message: string } {
  const found = layers.find(
    (l): l is RawLayer => isLayerObject(l) && l.type === 'tilelayer' && l.name === name,
  );
  if (!found) return { kind: 'error', message: `Layer "${name}" missing.` };
  if (found.width !== size || found.height !== size) {
    return { kind: 'error', message: `Layer "${name}" dims mismatch the map header.` };
  }
  if (!Array.isArray(found.data) || found.data.length !== size * size) {
    return { kind: 'error', message: `Layer "${name}" data length is wrong.` };
  }
  if (!found.data.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0)) {
    return { kind: 'error', message: `Layer "${name}" contains non-integer GIDs.` };
  }
  return { kind: 'ok', data: found.data.slice() as number[] };
}

function isLayerObject(value: unknown): value is RawLayer {
  return !!value && typeof value === 'object';
}

function isAllowedGridSize(value: unknown): value is GridSize {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (ALLOWED_GRID_SIZES as readonly number[]).includes(value)
  );
}

function fail(error: string): ImportFailure {
  return { ok: false, error };
}
