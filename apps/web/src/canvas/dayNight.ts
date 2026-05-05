// Day/night tint overlay (Doc #17 hook).
//
// A full-viewport sprite tinted with a colour that ramps over a sped-up
// 24-minute cycle. The schedule slot system in Doc #17 §6 expects the
// canvas to expose a `currentSlotIdx` derivable from the in-game time of
// day. This file only covers the visual tint; the logical slot index that
// drives NPC behaviour is on the server-authoritative side and is plumbed
// into Npc records when WorldService snapshots arrive.
//
// Cycle phases (24 min real-time → 24 in-game hours):
//   00:00..04:00 deep night    rgb(20, 30, 60)   alpha 0.55
//   04:00..06:00 dawn          rgb(255, 165, 100) alpha 0.30 → 0.10
//   06:00..18:00 day           rgb(255, 255, 255) alpha 0.00
//   18:00..21:00 dusk          rgb(255, 110, 80)  alpha 0.10 → 0.40
//   21:00..24:00 night         rgb(20, 30, 60)   alpha 0.40 → 0.55

import { type Application, Container, Graphics } from 'pixi.js';

export interface DayNightOptions {
  readonly app: Application;
  readonly cycleSeconds?: number;
  /** Initial in-game hour [0, 24). Defaults to 12 (noon — alpha 0, fully
   *  visible) so the canvas does not boot under a darkness overlay that
   *  reads as a grey-blue blocking rectangle. The cycle still advances
   *  each tick if `update()` is called per frame. */
  readonly initialHour?: number;
  /** When false, `update()` does not advance the cycle — the overlay
   *  stays at whatever hour `setHour()` last fixed. Used by the
   *  time-of-day slider in the HUD so the user can pin a moment. */
  readonly autoAdvance?: boolean;
}

const DEFAULT_CYCLE = 24 * 60; // 24 minutes

interface Phase {
  readonly hour: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const KEYFRAMES: readonly Phase[] = [
  { hour: 0, r: 20, g: 30, b: 60, a: 0.55 },
  { hour: 4, r: 30, g: 40, b: 80, a: 0.5 },
  { hour: 6, r: 255, g: 165, b: 100, a: 0.18 },
  { hour: 8, r: 255, g: 255, b: 255, a: 0 },
  { hour: 17, r: 255, g: 255, b: 220, a: 0 },
  { hour: 19, r: 255, g: 110, b: 80, a: 0.25 },
  { hour: 21, r: 30, g: 40, b: 80, a: 0.45 },
  { hour: 24, r: 20, g: 30, b: 60, a: 0.55 },
];

export class DayNight {
  readonly container: Container;
  private readonly overlay: Graphics;
  private readonly cycleSeconds: number;
  private elapsed: number;
  private autoAdvance: boolean;

  constructor(private readonly opts: DayNightOptions) {
    this.cycleSeconds = opts.cycleSeconds ?? DEFAULT_CYCLE;
    this.autoAdvance = opts.autoAdvance ?? true;
    const startHour = opts.initialHour ?? 12;
    this.elapsed = (startHour / 24) * this.cycleSeconds;
    this.container = new Container();
    this.container.label = 'day-night';
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
    this.redraw();
  }

  /** Force the cycle to a specific in-game hour [0, 24). */
  setHour(hour: number): void {
    const clamped = Math.max(0, Math.min(24, hour));
    this.elapsed = (clamped / 24) * this.cycleSeconds;
    this.redraw();
  }

  /** Read the current in-game hour [0, 24). */
  getHour(): number {
    return this.currentHour();
  }

  /** Pause / resume automatic cycling. When paused the overlay stays
   *  at the last-set hour. */
  setAutoAdvance(on: boolean): void {
    this.autoAdvance = on;
  }

  update(dtSec: number): void {
    if (!this.autoAdvance) return;
    this.elapsed = (this.elapsed + dtSec) % this.cycleSeconds;
    this.redraw();
  }

  private currentHour(): number {
    return (this.elapsed / this.cycleSeconds) * 24;
  }

  private redraw(): void {
    const renderer = this.opts.app.renderer;
    const w = renderer.width / renderer.resolution;
    const h = renderer.height / renderer.resolution;
    const phase = sample(this.currentHour());
    this.overlay.clear();
    this.overlay.rect(0, 0, w, h).fill({ color: rgb(phase.r, phase.g, phase.b), alpha: phase.a });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

function rgb(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function sample(hour: number): Phase {
  // Linear interpolation between adjacent keyframes.
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (!a || !b) continue;
    if (hour >= a.hour && hour <= b.hour) {
      const t = (hour - a.hour) / Math.max(1e-6, b.hour - a.hour);
      return {
        hour,
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
        a: lerp(a.a, b.a, t),
      };
    }
  }
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  return last ?? { hour: 0, r: 0, g: 0, b: 0, a: 0 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
