// Dev-only performance overlay.
//
// Renders a small text panel in the top-left of the canvas with FPS, draw
// calls, and per-tick CPU time. Gated by `import.meta.env.DEV` at the call
// site so it tree-shakes out of production builds.

import { type Application, Container, Graphics, Text } from 'pixi.js';

export class PerfOverlay {
  readonly container: Container;
  private readonly bg: Graphics;
  private readonly text: Text;
  private fpsAccum = 0;
  private framesAccum = 0;
  private fps = 0;
  private lastTickStart = performance.now();
  private tickAvgMs = 0;
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.container.label = 'perf-overlay';
    this.bg = new Graphics();
    this.bg.rect(0, 0, 200, 56).fill({ color: 0x000000, alpha: 0.55 });
    this.container.addChild(this.bg);

    this.text = new Text({
      text: '',
      style: {
        fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
        fontSize: 12,
        fill: 0xb0e0a0,
      },
    });
    this.text.x = 8;
    this.text.y = 6;
    this.container.addChild(this.text);
  }

  beginTick(): void {
    this.lastTickStart = performance.now();
  }

  endTick(dtSec: number): void {
    const tickMs = performance.now() - this.lastTickStart;
    this.tickAvgMs = this.tickAvgMs * 0.9 + tickMs * 0.1;
    this.fpsAccum += dtSec;
    this.framesAccum++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.framesAccum / this.fpsAccum;
      this.fpsAccum = 0;
      this.framesAccum = 0;
    }
    const drawCalls = (this.app.renderer as { textureGC?: unknown; renderingToScreen?: boolean })
      ? readDrawCalls(this.app)
      : 0;
    this.text.text = [
      `FPS  ${this.fps.toFixed(1)}`,
      `tick ${this.tickAvgMs.toFixed(2)}ms`,
      `draw ${drawCalls}`,
    ].join('\n');
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

function readDrawCalls(app: Application): number {
  // Pixi v8 does not expose draw-call counters on the public Renderer
  // surface in a stable shape; reach in defensively.
  const r = app.renderer as unknown as { batch?: { _drawCallPoolIndex?: number } };
  const idx = r.batch?._drawCallPoolIndex;
  return typeof idx === 'number' ? idx : 0;
}
