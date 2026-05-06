// Camera controller: pan, zoom, follow.
//
// The camera owns a Container that the world is parented under. Movement is
// applied to that container's transform; the underlying renderer never moves.
// All input handlers (keyboard, wheel, drag, edge-pan) push *target* values
// and the per-frame update() smoothly eases the actual transform towards
// them. Smoothing is critical-damped: tau ≈ 100ms feels snappy without
// jitter.
//
// Bounds clamping: the camera target is clamped so the visible viewport
// never escapes the world AABB. The viewport size comes from the renderer
// each tick.

import type { Application, Container, FederatedPointerEvent } from 'pixi.js';

export interface CameraBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CameraOptions {
  readonly stage: Container;
  readonly app: Application;
  readonly world: Container;
  readonly bounds: CameraBounds;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  /** Initial zoom — defaults to 1. Scale mode pre-sets a comfortable zoom
   *  for the active art pack. */
  readonly initialZoom?: number;
  /** Skip the keyboard pan listeners (Arrow / WASD / F-follow). The
   *  editor disables these so canvas movement is mouse-only. */
  readonly disableKeyboardPan?: boolean;
  /** Skip the automatic edge-pan inside pointermove. The editor handles
   *  edge-pan locally so it only fires while a paint drag is active. */
  readonly disableEdgePan?: boolean;
}

const KEY_PAN_SPEED = 480; // px/sec at zoom 1
const EDGE_PAN_SPEED = 360;
const EDGE_PAN_THRESHOLD = 24; // px from window edge
const SMOOTH_TAU = 0.1; // seconds

export class Camera {
  private targetX = 0;
  private targetY = 0;
  private targetZoom: number;
  private actualX = 0;
  private actualY = 0;
  private actualZoom: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly keysHeld = new Set<string>();
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private edgePanX = 0;
  private edgePanY = 0;
  private follow: { x: number; y: number } | null = null;
  private followEnabled = false;
  private cleanupFns: Array<() => void> = [];

  constructor(private readonly opts: CameraOptions) {
    this.minZoom = opts.minZoom ?? 0.5;
    this.maxZoom = opts.maxZoom ?? 2.5;
    const initial = Math.max(this.minZoom, Math.min(this.maxZoom, opts.initialZoom ?? 1));
    this.targetZoom = initial;
    this.actualZoom = initial;
    this.attachInput();
  }

  /** Recentre the camera on the given world coordinate. */
  centerOn(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.actualX = x;
    this.actualY = y;
    this.applyTransform();
  }

  setFollow(target: { x: number; y: number } | null): void {
    this.follow = target;
    this.followEnabled = target !== null;
  }

  toggleFollow(): void {
    this.followEnabled = !this.followEnabled && this.follow !== null;
  }

  isFollowing(): boolean {
    return this.followEnabled;
  }

  /** Convert a screen-space point to world (un-projected) coordinates. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const w = this.opts.world;
    return {
      x: (sx - w.x) / w.scale.x,
      y: (sy - w.y) / w.scale.y,
    };
  }

  update(dtSec: number): void {
    if (this.followEnabled && this.follow) {
      this.targetX = this.follow.x;
      this.targetY = this.follow.y;
    } else {
      // Keyboard panning is disabled while following.
      const speed = KEY_PAN_SPEED / this.targetZoom;
      let dx = 0;
      let dy = 0;
      if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('KeyA')) dx -= 1;
      if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('KeyD')) dx += 1;
      if (this.keysHeld.has('ArrowUp') || this.keysHeld.has('KeyW')) dy -= 1;
      if (this.keysHeld.has('ArrowDown') || this.keysHeld.has('KeyS')) dy += 1;
      this.targetX += dx * speed * dtSec;
      this.targetY += dy * speed * dtSec;
      this.targetX += this.edgePanX * (EDGE_PAN_SPEED / this.targetZoom) * dtSec;
      this.targetY += this.edgePanY * (EDGE_PAN_SPEED / this.targetZoom) * dtSec;
    }

    this.clampTarget();

    // Critical-damped easing: alpha = 1 - exp(-dt / tau).
    const alpha = 1 - Math.exp(-dtSec / SMOOTH_TAU);
    this.actualX += (this.targetX - this.actualX) * alpha;
    this.actualY += (this.targetY - this.actualY) * alpha;
    this.actualZoom += (this.targetZoom - this.actualZoom) * alpha;
    this.applyTransform();
  }

  /** Tear down listeners; call from the canvas component's cleanup. */
  destroy(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
  }

  private clampTarget(): void {
    const view = this.viewSize();
    const halfW = view.width / 2 / this.targetZoom;
    const halfH = view.height / 2 / this.targetZoom;
    const { bounds } = this.opts;
    const minX = bounds.minX + halfW;
    const maxX = bounds.maxX - halfW;
    const minY = bounds.minY + halfH;
    const maxY = bounds.maxY - halfH;
    if (minX <= maxX) {
      this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
    } else {
      // World is narrower than the viewport — centre it.
      this.targetX = (bounds.minX + bounds.maxX) / 2;
    }
    if (minY <= maxY) {
      this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
    } else {
      this.targetY = (bounds.minY + bounds.maxY) / 2;
    }
  }

  private applyTransform(): void {
    const view = this.viewSize();
    const w = this.opts.world;
    w.scale.set(this.actualZoom, this.actualZoom);
    w.x = view.width / 2 - this.actualX * this.actualZoom;
    w.y = view.height / 2 - this.actualY * this.actualZoom;
  }

  private viewSize(): { width: number; height: number } {
    const renderer = this.opts.app.renderer;
    return {
      width: renderer.width / renderer.resolution,
      height: renderer.height / renderer.resolution,
    };
  }

  /** External nudge to the camera target (e.g. from a host that wants its
   *  own edge-pan logic). Clamped on the next update tick. */
  panTargetBy(dx: number, dy: number): void {
    this.targetX += dx / this.targetZoom;
    this.targetY += dy / this.targetZoom;
  }

  private attachInput(): void {
    if (!this.opts.disableKeyboardPan) {
      const onKeyDown = (ev: KeyboardEvent): void => {
        this.keysHeld.add(ev.code);
        if (ev.code === 'KeyF') this.toggleFollow();
      };
      const onKeyUp = (ev: KeyboardEvent): void => {
        this.keysHeld.delete(ev.code);
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      this.cleanupFns.push(() => window.removeEventListener('keydown', onKeyDown));
      this.cleanupFns.push(() => window.removeEventListener('keyup', onKeyUp));
    }

    const canvas = this.opts.app.canvas;
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.0015);
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * factor));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    this.cleanupFns.push(() => canvas.removeEventListener('wheel', onWheel));

    const onPointerDown = (ev: FederatedPointerEvent): void => {
      // Middle-click or right-click drag to pan; left-click is reserved for
      // tile selection / click-to-move.
      if (ev.button === 1 || ev.button === 2) {
        this.dragging = true;
        this.lastPointerX = ev.global.x;
        this.lastPointerY = ev.global.y;
        this.followEnabled = false;
      }
    };
    const disableEdgePan = this.opts.disableEdgePan === true;
    const onPointerMove = (ev: FederatedPointerEvent): void => {
      if (this.dragging) {
        const dx = ev.global.x - this.lastPointerX;
        const dy = ev.global.y - this.lastPointerY;
        this.lastPointerX = ev.global.x;
        this.lastPointerY = ev.global.y;
        this.targetX -= dx / this.targetZoom;
        this.targetY -= dy / this.targetZoom;
      }
      if (disableEdgePan) {
        this.edgePanX = 0;
        this.edgePanY = 0;
        return;
      }
      // Edge-pan based on pointer screen position.
      const view = this.viewSize();
      const x = ev.global.x;
      const y = ev.global.y;
      this.edgePanX = x < EDGE_PAN_THRESHOLD ? -1 : x > view.width - EDGE_PAN_THRESHOLD ? 1 : 0;
      this.edgePanY = y < EDGE_PAN_THRESHOLD ? -1 : y > view.height - EDGE_PAN_THRESHOLD ? 1 : 0;
    };
    const onPointerUp = (): void => {
      this.dragging = false;
    };
    const onPointerLeave = (): void => {
      this.dragging = false;
      this.edgePanX = 0;
      this.edgePanY = 0;
    };
    this.opts.stage.eventMode = 'static';
    this.opts.stage.on('pointerdown', onPointerDown);
    this.opts.stage.on('pointermove', onPointerMove);
    this.opts.stage.on('pointerup', onPointerUp);
    this.opts.stage.on('pointerupoutside', onPointerUp);
    this.opts.stage.on('pointerleave', onPointerLeave);
    this.cleanupFns.push(() => this.opts.stage.off('pointerdown', onPointerDown));
    this.cleanupFns.push(() => this.opts.stage.off('pointermove', onPointerMove));
    this.cleanupFns.push(() => this.opts.stage.off('pointerup', onPointerUp));
    this.cleanupFns.push(() => this.opts.stage.off('pointerupoutside', onPointerUp));
    this.cleanupFns.push(() => this.opts.stage.off('pointerleave', onPointerLeave));

    // Suppress browser context menu so right-click drag works as a pan.
    const onContextMenu = (ev: Event): void => ev.preventDefault();
    canvas.addEventListener('contextmenu', onContextMenu);
    this.cleanupFns.push(() => canvas.removeEventListener('contextmenu', onContextMenu));
  }
}
