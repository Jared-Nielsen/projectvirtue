// Palette manifest fetch + Texture cache.
//
// The MVP ships a hand-listed JSON manifest at
// /maps/library-iso.manifest.json that enumerates the library kit's
// representative sprites with their R2 URLs. Eventually the source-of-truth
// is the .tsj file on R2 itself; this module is the seam that swaps to that
// fetch when the .tsj exists.
//
// Loaded textures are cached on the module so re-mounting the editor screen
// (Solid hot reload, route re-entry) does not re-download the whole palette.

import { Assets, type Texture } from 'pixi.js';

export interface PaletteTile {
  /** Tile GID — 1-indexed to match Tiled's `firstgid`-relative GIDs. 0 is
   *  reserved for "empty cell" in the export. */
  readonly id: number;
  readonly label: string;
  readonly category: string;
  readonly src: string;
  readonly w: number;
  readonly h: number;
}

export interface PaletteManifest {
  readonly version: number;
  readonly kit: string;
  /** External tileset URL emitted in the .tmj `tilesets[0].source`. */
  readonly tilesetSource: string;
  /** Single tile diamond dims; copied into the .tmj header. */
  readonly tile: { readonly w: number; readonly h: number };
  readonly tiles: ReadonlyArray<PaletteTile>;
}

const MANIFEST_URL = '/maps/library-iso.manifest.json';

let cachedManifest: PaletteManifest | null = null;
const textureCache = new Map<number, Texture>();

/** Fetch the palette manifest, caching the result on the module. */
export async function loadPaletteManifest(): Promise<PaletteManifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) {
    throw new Error(`palette manifest fetch failed: ${res.status} ${res.statusText}`);
  }
  const parsed = (await res.json()) as PaletteManifest;
  cachedManifest = parsed;
  return parsed;
}

/** Load a single tile's Texture lazily through Pixi's Assets system. */
export async function loadPaletteTexture(tile: PaletteTile): Promise<Texture> {
  const hit = textureCache.get(tile.id);
  if (hit) return hit;
  const texture = (await Assets.load(tile.src)) as Texture;
  textureCache.set(tile.id, texture);
  return texture;
}

/** Returns a stable lookup map { gid → tile descriptor } for the manifest. */
export function indexById(manifest: PaletteManifest): ReadonlyMap<number, PaletteTile> {
  const map = new Map<number, PaletteTile>();
  for (const tile of manifest.tiles) map.set(tile.id, tile);
  return map;
}

/** Test/dev seam: clear the module-level caches. */
export function _resetForTests(): void {
  cachedManifest = null;
  textureCache.clear();
}
