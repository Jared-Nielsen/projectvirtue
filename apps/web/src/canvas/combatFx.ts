// Combat visualisation placeholder.
//
// Real combat resolves on the server (Doc #41 §3); the client here only
// renders feedback. This module owns:
//   - Target ring: a pulsing circle painted under whichever entity the
//     pointer hovers over while combat is active.
//   - Floating damage numbers: short-lived Text objects that drift up and
//     fade out. The route layer eventually plumbs real damage events; for
//     the demo we synthesise one every few seconds against a fixed target.

import { Container, Graphics, Text } from 'pixi.js';

export class CombatFx {
  readonly container: Container;
  private readonly ring: Graphics;
  private ringTime = 0;
  private ringTarget: { x: number; y: number } | null = null;
  private readonly damageNumbers: Array<{ text: Text; ttl: number; vy: number }> = [];
  private demoTimer = 2.5;

  constructor() {
    this.container = new Container();
    this.container.label = 'combat-fx';
    this.ring = new Graphics();
    this.ring.visible = false;
    this.container.addChild(this.ring);
  }

  setTarget(world: { x: number; y: number } | null): void {
    this.ringTarget = world;
    this.ring.visible = world !== null;
    if (world) {
      this.ring.x = world.x;
      this.ring.y = world.y;
    }
  }

  spawnDamageNumber(world: { x: number; y: number }, value: number, color = 0xff5252): void {
    const text = new Text({
      text: String(value),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    text.anchor.set(0.5, 1);
    text.x = world.x + (Math.random() * 16 - 8);
    text.y = world.y - 20;
    this.container.addChild(text);
    this.damageNumbers.push({ text, ttl: 1.0, vy: -36 });
  }

  update(dtSec: number): void {
    if (this.ring.visible) {
      this.ringTime += dtSec;
      const pulse = 1 + Math.sin(this.ringTime * 4) * 0.08;
      this.ring.clear();
      this.ring.circle(0, 0, 22 * pulse).stroke({ color: 0xff4040, alpha: 0.85, width: 2 });
      this.ring.circle(0, 0, 28 * pulse).stroke({ color: 0xff4040, alpha: 0.35, width: 1 });
      if (this.ringTarget) {
        this.ring.x = this.ringTarget.x;
        this.ring.y = this.ringTarget.y;
      }
    }

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      if (!dn) continue;
      dn.ttl -= dtSec;
      dn.text.y += dn.vy * dtSec;
      dn.text.alpha = Math.max(0, dn.ttl);
      if (dn.ttl <= 0) {
        this.container.removeChild(dn.text);
        dn.text.destroy();
        this.damageNumbers.splice(i, 1);
      }
    }

    // Demo loop: synthesise damage numbers near the active ring target.
    this.demoTimer -= dtSec;
    if (this.demoTimer <= 0 && this.ringTarget) {
      this.demoTimer = 2.0 + Math.random() * 1.5;
      const dmg = 5 + Math.floor(Math.random() * 28);
      this.spawnDamageNumber(this.ringTarget, dmg, dmg > 20 ? 0xffd24a : 0xff8060);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
