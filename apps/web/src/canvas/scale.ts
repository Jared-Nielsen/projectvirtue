// Game scale mode — single source of truth for every scale-sensitive constant
// in the canvas. Switching modes re-tunes tile diamond size, sprite render
// scale, camera zoom limits + initial zoom, walk speeds, and lighting radii in
// one place.
//
// We currently develop against the Kenney isometric-miniature art (chunky, 3D-
// feeling tiles — `kenney-miniature` mode is the default). When the project
// later moves to flatter Ultima VII-style art with a larger-feeling world,
// switching `DEFAULT_SCALE_MODE` (or selecting via `?scale=ultima-vii`) tunes
// the entire canvas without per-system patches.
//
// Adding a new mode: add a const matching the `ScaleMode` shape, register it
// in `SCALE_MODES`, and extend `ScaleModeId`. Every consumer that already
// reads from this module picks it up automatically.

export type ScaleModeId = 'kenney-miniature' | 'ultima-vii';

export interface ScaleMode {
  readonly id: ScaleModeId;
  readonly label: string;

  /** Iso diamond pixel dimensions (the tile body). */
  readonly tile: {
    readonly w: number;
    readonly h: number;
  };

  /** Render scale applied uniformly to character sprites. */
  readonly spriteScale: {
    readonly player: number;
    readonly npc: number;
  };

  /** Camera zoom band + initial zoom for this scale. */
  readonly camera: {
    readonly minZoom: number;
    readonly maxZoom: number;
    readonly initialZoom: number;
  };

  /** Walk speed in tiles/sec. Same value across modes still produces
   *  different pixel speeds because the projector scales the metric. */
  readonly walk: {
    readonly playerTilesPerSec: number;
    readonly npcTilesPerSec: number;
  };

  /** Lighting radii (pixels at zoom 1). */
  readonly lighting: {
    readonly torchRadius: number;
  };

  /** Decor anchor point in normalised sprite coords. Tall miniatures
   *  anchor near the bottom; flatter sheets may anchor centred. */
  readonly decorAnchor: {
    readonly x: number;
    readonly y: number;
  };

  /** Sprite atlas manifest URL, served from the app's `public/` dir. */
  readonly atlasManifest: string;
}

const KENNEY_MINIATURE: ScaleMode = {
  id: 'kenney-miniature',
  label: 'Kenney miniature (chunky 3D-feel)',
  tile: { w: 128, h: 64 },
  spriteScale: { player: 0.55, npc: 0.5 },
  camera: { minZoom: 0.4, maxZoom: 2.0, initialZoom: 1.0 },
  walk: { playerTilesPerSec: 4, npcTilesPerSec: 1.5 },
  lighting: { torchRadius: 220 },
  decorAnchor: { x: 0.5, y: 0.85 },
  atlasManifest: '/sprites.json',
};

const ULTIMA_VII: ScaleMode = {
  id: 'ultima-vii',
  label: 'Ultima VII (flat, expansive world feel)',
  tile: { w: 64, h: 32 },
  spriteScale: { player: 0.85, npc: 0.8 },
  camera: { minZoom: 0.7, maxZoom: 3.5, initialZoom: 1.5 },
  walk: { playerTilesPerSec: 6, npcTilesPerSec: 2.0 },
  lighting: { torchRadius: 140 },
  decorAnchor: { x: 0.5, y: 0.85 },
  atlasManifest: '/sprites.json',
};

export const SCALE_MODES = {
  'kenney-miniature': KENNEY_MINIATURE,
  'ultima-vii': ULTIMA_VII,
} as const satisfies Record<ScaleModeId, ScaleMode>;

/** Default scale mode used when no override is provided. */
export const DEFAULT_SCALE_MODE: ScaleModeId = 'kenney-miniature';

/** Resolve a scale mode by id; falls back to the default for unknown ids. */
export function getScaleMode(id?: ScaleModeId | null): ScaleMode {
  if (id && id in SCALE_MODES) return SCALE_MODES[id];
  return SCALE_MODES[DEFAULT_SCALE_MODE];
}

/** Read the active scale mode from `?scale=<id>` then `localStorage`,
 *  falling back to the default. Pure — does not throw if window is missing
 *  (SSR / vitest non-jsdom) or localStorage is sandboxed. */
export function getActiveScaleMode(): ScaleMode {
  return getScaleMode(readScaleOverride());
}

/** Internal: read `?scale=<id>` then `localStorage('pv.canvas.scaleMode')`.
 *  Returns null when nothing valid is set. */
export function readScaleOverride(): ScaleModeId | null {
  if (typeof globalThis === 'undefined') return null;
  const win = (globalThis as { window?: Window }).window;
  if (!win) return null;
  try {
    const params = new URLSearchParams(win.location.search);
    const fromUrl = params.get('scale');
    if (fromUrl && isScaleModeId(fromUrl)) return fromUrl;
    const fromStorage = win.localStorage?.getItem('pv.canvas.scaleMode');
    if (fromStorage && isScaleModeId(fromStorage)) return fromStorage;
  } catch {
    /* private-mode storage / sandboxed window — fail safe */
  }
  return null;
}

function isScaleModeId(value: string): value is ScaleModeId {
  return value in SCALE_MODES;
}

/** Convenience: derive the iso tile metrics that `tiles.ts` consumes. */
export function isoMetricsFor(mode: ScaleMode): { tileW: number; tileH: number } {
  return { tileW: mode.tile.w, tileH: mode.tile.h };
}
