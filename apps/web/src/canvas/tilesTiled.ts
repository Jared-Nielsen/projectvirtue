// Tiled Map Editor integration via pixi-tiledmap.
//
// Loads a `.tmx` (or `.tmj`) authored in Tiled and returns a Pixi container
// the canvas runtime can parent under the world layer. The .tmx may reference
// R2-hosted tile PNGs cross-origin; CORS is configured on the
// media.gamecodex.com bucket for the dev origins (see apps/web/README.md).
//
// Walkability is intentionally NOT derived from the Tiled map in this v1 —
// gameplay walkability still flows from the @br/mocks JSON `TileMap` fixture.
// That decoupling keeps the visual layer (Tiled) and the gameplay schema
// (typed JSON, eventual protobuf wire format per Doc #22 §4.5) separately
// authored. A future converter (`tools/tiled/tmj-to-tilemap.ts`) will
// unify them: Tiled becomes the *source*, the JSON the *wire format*.
//
// Failure mode: if the .tmx 404s, parses badly, or the referenced sprite
// PNGs fail (common during early dev — wrong R2 path, missing CORS), the
// loader throws. `app.ts` catches and falls back to the programmatic
// colored-diamond renderer in `tiles.ts` so the canvas still boots.

import { type TiledMap, tiledMapLoader } from 'pixi-tiledmap';
import { Assets, type Container, extensions } from 'pixi.js';

let registered = false;

/** Idempotent: register pixi-tiledmap's Assets-loader extension once. */
export function ensureTiledLoader(): void {
  if (registered) return;
  extensions.add(tiledMapLoader);
  registered = true;
}

export interface LoadedTiledLayer {
  /** The TiledMap container — parent under the canvas world layer. */
  readonly container: Container;
  /** Tile-grid width / height in cells (read from the loaded map). */
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** Pixel dims of one iso tile diamond. */
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Source URL the map was loaded from (for diagnostics). */
  readonly source: string;
}

/**
 * Load a Tiled `.tmx` (or `.tmj`) into a pixi container. Throws on any
 * loader failure — caller decides whether to fall back to a programmatic
 * tile renderer.
 */
export async function loadTiledLayer(source: string): Promise<LoadedTiledLayer> {
  ensureTiledLoader();
  const asset = (await Assets.load(source)) as { container: Container };
  const map = asset.container as TiledMap;
  return {
    container: map,
    mapWidth: map.mapWidth,
    mapHeight: map.mapHeight,
    tileWidth: map.tileWidth,
    tileHeight: map.tileHeight,
    source,
  };
}
