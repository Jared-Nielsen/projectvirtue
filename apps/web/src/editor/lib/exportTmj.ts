// Editor → Tiled .tmj exporter.
//
// Produces a Tiled JSON map (the official 1.10/1.11 schema, JSON variant)
// with two `tilelayer`s ("ground" + "decor") and a single external tileset
// reference at `https://media.gamecodex.com/tile/library/iso/library.tsj`.
//
// Round-trip contract: the matching `importTmj.ts` parses this exact shape
// back into the editor state. The pair has a unit-test fixture asserting
// idempotence.
//
// Out of scope (Doc #43 §"Out of scope"):
//   • object layers
//   • animated tiles, tile property overrides
//   • multiple tilesets
//
// Tiled spec reference:
//   https://doc.mapeditor.org/en/stable/reference/json-map-format/

import type { EditorState } from '../state/editorState';

export const TMJ_VERSION = '1.10';
export const TILED_VERSION = '1.11.0';
export const ORIENTATION = 'isometric';
export const RENDER_ORDER = 'right-down';

/** External tileset URL — the .tsj is hosted on R2 and shared between the
 *  in-game canvas and the editor. */
export const LIBRARY_TILESET_URL = 'https://media.gamecodex.com/tile/library/iso/library.tsj';

export interface TmjTilesetRef {
  readonly firstgid: 1;
  readonly source: string;
}

export interface TmjTileLayer {
  readonly type: 'tilelayer';
  readonly id: number;
  readonly name: 'ground' | 'decor';
  readonly width: number;
  readonly height: number;
  readonly opacity: 1;
  readonly visible: true;
  readonly x: 0;
  readonly y: 0;
  readonly data: number[];
}

export interface TmjMap {
  readonly type: 'map';
  readonly version: typeof TMJ_VERSION;
  readonly tiledversion: typeof TILED_VERSION;
  readonly orientation: typeof ORIENTATION;
  readonly renderorder: typeof RENDER_ORDER;
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly infinite: false;
  readonly nextlayerid: 3;
  readonly nextobjectid: 1;
  readonly tilesets: ReadonlyArray<TmjTilesetRef>;
  readonly layers: ReadonlyArray<TmjTileLayer>;
}

export interface ExportOptions {
  readonly tilesetSource?: string;
  readonly tileWidth?: number;
  readonly tileHeight?: number;
}

/** Build the Tiled .tmj JSON object for the current editor state. */
export function exportTmj(state: EditorState, options: ExportOptions = {}): TmjMap {
  const tilesetSource = options.tilesetSource ?? LIBRARY_TILESET_URL;
  const tileWidth = options.tileWidth ?? 256;
  const tileHeight = options.tileHeight ?? 128;
  const w = state.gridSize;
  const h = state.gridSize;
  return {
    type: 'map',
    version: TMJ_VERSION,
    tiledversion: TILED_VERSION,
    orientation: ORIENTATION,
    renderorder: RENDER_ORDER,
    width: w,
    height: h,
    tilewidth: tileWidth,
    tileheight: tileHeight,
    infinite: false,
    nextlayerid: 3,
    nextobjectid: 1,
    tilesets: [{ firstgid: 1, source: tilesetSource }],
    layers: [
      {
        type: 'tilelayer',
        id: 1,
        name: 'ground',
        width: w,
        height: h,
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        data: state.ground.slice(),
      },
      {
        type: 'tilelayer',
        id: 2,
        name: 'decor',
        width: w,
        height: h,
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        data: state.decor.slice(),
      },
    ],
  };
}

/** Trigger a browser file download with the .tmj payload. Returns the
 *  filename used. No-op outside the browser (returns the filename anyway
 *  so callers can log it). */
export function downloadTmj(state: EditorState, basename = 'mythenor-map'): string {
  const map = exportTmj(state);
  const filename = `${basename}.tmj`;
  if (typeof document === 'undefined' || typeof URL === 'undefined') return filename;
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(href);
  }
  return filename;
}
