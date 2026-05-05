// Sprite atlas loader.
//
// Consumes /sprites.json (served from apps/web/public/sprites.json) which
// describes named rectangles within /spritesheet.png. The loader fetches the
// manifest, loads the base texture, and produces a registry keyed by sprite
// name. Animation frames are exposed as ordered Texture[] so AnimatedSprite
// can consume them directly.
//
// The manifest also documents the isometric tile diamond size used by
// tiles.ts; tile *art* is drawn programmatically (not in the sheet) so the
// registry has no entries for tile types — tiles.ts falls back to coloured
// graphics when a tile.<type> key is missing.

import { Assets, Rectangle, Texture } from 'pixi.js';

export interface SpriteFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface SpriteManifest {
  readonly image: string;
  readonly size: { readonly width: number; readonly height: number };
  readonly tile: { readonly isoWidth: number; readonly isoHeight: number };
  readonly frames: Readonly<Record<string, SpriteFrame>>;
  readonly animations: Readonly<Record<string, readonly string[]>>;
}

export interface SpriteRegistry {
  readonly manifest: SpriteManifest;
  readonly base: Texture;
  readonly textures: ReadonlyMap<string, Texture>;
  readonly animations: ReadonlyMap<string, readonly Texture[]>;
}

/** Returns null if the registry has no texture for that key (caller falls back). */
export function getTexture(registry: SpriteRegistry, name: string): Texture | null {
  return registry.textures.get(name) ?? null;
}

/** Returns an empty array if the animation is missing — caller can skip rather than crash. */
export function getAnimation(registry: SpriteRegistry, name: string): readonly Texture[] {
  return registry.animations.get(name) ?? [];
}

export async function loadSpriteRegistry(manifestUrl = '/sprites.json'): Promise<SpriteRegistry> {
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) {
    throw new Error(`sprites: failed to fetch manifest at ${manifestUrl}: ${manifestRes.status}`);
  }
  const manifest = (await manifestRes.json()) as SpriteManifest;

  const base = await Assets.load<Texture>(manifest.image);
  // Pixi v8 caches by URL; ensure we always get a Texture instance.
  if (!(base instanceof Texture)) {
    throw new Error('sprites: loaded asset was not a Texture');
  }

  const textures = new Map<string, Texture>();
  for (const [name, frame] of Object.entries(manifest.frames)) {
    // Clamp the frame to image bounds — defensive against manifest typos.
    const x = Math.max(0, Math.min(frame.x, manifest.size.width - 1));
    const y = Math.max(0, Math.min(frame.y, manifest.size.height - 1));
    const w = Math.max(1, Math.min(frame.w, manifest.size.width - x));
    const h = Math.max(1, Math.min(frame.h, manifest.size.height - y));
    const sub = new Texture({
      source: base.source,
      frame: new Rectangle(x, y, w, h),
    });
    textures.set(name, sub);
  }

  const animations = new Map<string, readonly Texture[]>();
  for (const [name, frameKeys] of Object.entries(manifest.animations)) {
    const frames: Texture[] = [];
    for (const key of frameKeys) {
      const tex = textures.get(key);
      if (tex) {
        frames.push(tex);
      }
    }
    if (frames.length > 0) {
      animations.set(name, frames);
    }
  }

  return { manifest, base, textures, animations };
}
