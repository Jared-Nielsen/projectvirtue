// Lighting layer — placeholder for future torchlight / spell glow.
//
// The night overlay (dayNight.ts) tints the whole viewport. To carve "holes"
// for player torches, lanterns, and spell effects we need a layer that lives
// *above* the world geometry but is composited with a multiply / screen
// blend so its alpha subtracts darkness rather than additively brightening.
//
// Today this file owns:
//   - A Container for light sources
//   - addLight() / removeLight() to add radial-gradient light blobs
//   - A render hook that updates each light's transform per frame
//
// The actual blend hookup (e.g. RenderTexture mask + multiply blend mode) is
// deferred until we have more than one light to test against. The container
// is currently rendered with `blendMode = 'screen'` which approximates the
// final look; swapping to a mask is a follow-up.

import { Container, Graphics } from 'pixi.js';

export interface LightSource {
  readonly id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: number;
}

export class LightingLayer {
  readonly container: Container;
  private readonly lights = new Map<string, { source: LightSource; sprite: Graphics }>();

  constructor() {
    this.container = new Container();
    this.container.label = 'lighting';
    // 'screen' brightens what it overlaps; combined with the dark dayNight
    // overlay this approximates a torchlight cutout. When the proper mask
    // pipeline lands, this becomes a RenderTexture target that the dayNight
    // overlay reads from as an alpha mask.
    this.container.blendMode = 'screen';
  }

  addLight(source: LightSource): void {
    const sprite = new Graphics();
    drawLight(sprite, source);
    sprite.x = source.x;
    sprite.y = source.y;
    this.container.addChild(sprite);
    this.lights.set(source.id, { source, sprite });
  }

  updateLight(id: string, patch: Partial<LightSource>): void {
    const entry = this.lights.get(id);
    if (!entry) return;
    Object.assign(entry.source, patch);
    drawLight(entry.sprite, entry.source);
    entry.sprite.x = entry.source.x;
    entry.sprite.y = entry.source.y;
  }

  removeLight(id: string): void {
    const entry = this.lights.get(id);
    if (!entry) return;
    this.container.removeChild(entry.sprite);
    entry.sprite.destroy();
    this.lights.delete(id);
  }

  destroy(): void {
    for (const id of [...this.lights.keys()]) {
      this.removeLight(id);
    }
    this.container.destroy({ children: true });
  }
}

function drawLight(g: Graphics, src: LightSource): void {
  g.clear();
  // Approximate radial falloff with concentric alpha bands. Pixi v8 does
  // not ship gradient fills out-of-the-box; this is the cheapest substitute
  // and still reads as a glow when blended.
  const steps = 6;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const r = src.radius * t;
    const alpha = src.intensity * (1 - t) * 0.4;
    g.circle(0, 0, r).fill({ color: src.color, alpha });
  }
}
