// Spike: pixi-tiledmap integration with the Kenney isometric-miniature-library
// kit hosted on Cloudflare R2 (media.gamecodex.com/tile/library/iso/).
//
// This module is the minimum surface needed to verify that:
//   1. pixi-tiledmap's Assets-loader extension typechecks against our Pixi v8
//   2. A TMX referencing absolute R2 URLs loads via Assets.load
//   3. The returned container can be parented to the GameCanvas world layer
//
// Visual verification happens in the browser (the WSL test runner can't
// render WebGL). The route layer can mount this temporarily during the
// Tiled integration phase, then remove the spike once tiles.ts is rewritten
// to consume real maps via this loader path.
//
// CORS (configured 2026-05-05 on the R2 bucket): GET allowed from
// http://localhost:3000 and :5173–:5178 plus http://virtu3.com. The .tmx
// itself is served same-origin via /maps/library-spike.tmx; only the
// referenced sprite PNGs cross-origin to media.gamecodex.com.
// Follow-up: production uses HTTPS — when virtu3.com goes live, add the
// `https://virtu3.com` (and `https://www.virtu3.com` if applicable) origin
// to the bucket's CORS allow list.

import { tiledMapLoader } from 'pixi-tiledmap';
import type { Container } from 'pixi.js';
import { Assets, extensions } from 'pixi.js';

let registered = false;

/** Idempotent: register the pixi-tiledmap loader extension once per session. */
export function ensureTiledLoader(): void {
  if (registered) return;
  extensions.add(tiledMapLoader);
  registered = true;
}

export interface LoadedTiledMap {
  /** The Pixi container holding the rendered map; parent it under your world. */
  readonly container: Container;
  /** Source URL the map was loaded from (for diagnostics). */
  readonly source: string;
}

/**
 * Load the spike map at /maps/library-spike.tmx. The TMX references R2-hosted
 * sprite PNGs; if R2 CORS is misconfigured the tile images will fail but the
 * map structure will still parse and the container will exist.
 */
export async function loadLibrarySpikeMap(
  source = '/maps/library-spike.tmx',
): Promise<LoadedTiledMap> {
  ensureTiledLoader();
  const result = (await Assets.load(source)) as { container: Container };
  return { container: result.container, source };
}
