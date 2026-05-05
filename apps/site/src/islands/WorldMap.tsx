// Interactive Sosaria map (zoom + pan + region select). Hydrated client:visible
// from /worlds/map.astro — visible only when the user scrolls the map into view.
//
// Zoom + pan: wheel-zoom on desktop, pinch-zoom on touch, and click-drag pan.

import {
  type Component,
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { WORLD_REGIONS, type WorldRegion } from '../data/world-regions';

const VIEW_W = 1200;
const VIEW_H = 800;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

const initialViewport: Viewport = { scale: 1, tx: 0, ty: 0 };

const KIND_COLOR: Record<WorldRegion['kind'], string> = {
  capital: 'rgba(244, 204, 102, 0.45)',
  city: 'rgba(126, 192, 246, 0.4)',
  town: 'rgba(94, 138, 58, 0.4)',
  wilderness: 'rgba(132, 105, 60, 0.35)',
  dungeon: 'rgba(150, 43, 30, 0.45)',
};

const WorldMap: Component = () => {
  const [viewport, setViewport] = createSignal<Viewport>(initialViewport);
  const [active, setActive] = createSignal<WorldRegion | null>(WORLD_REGIONS[0] ?? null);
  let svgEl: SVGSVGElement | undefined;
  let containerEl: HTMLDivElement | undefined;

  const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

  const clampTx = (tx: number, scale: number): number => {
    const overflow = VIEW_W * (scale - 1);
    return clamp(tx, -overflow, 0);
  };
  const clampTy = (ty: number, scale: number): number => {
    const overflow = VIEW_H * (scale - 1);
    return clamp(ty, -overflow, 0);
  };

  const zoomBy = (factor: number, originX = 0.5, originY = 0.5): void => {
    const v = viewport();
    const newScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    if (newScale === v.scale) return;
    const dx = originX * VIEW_W * (newScale - v.scale);
    const dy = originY * VIEW_H * (newScale - v.scale);
    setViewport({
      scale: newScale,
      tx: clampTx(v.tx - dx, newScale),
      ty: clampTy(v.ty - dy, newScale),
    });
  };

  const reset = (): void => {
    setViewport({ ...initialViewport });
  };

  let panStart: { x: number; y: number; tx: number; ty: number } | null = null;
  let pinchStart: { distance: number; scale: number } | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    if (!containerEl || !svgEl) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    containerEl.setPointerCapture(e.pointerId);
    const v = viewport();
    panStart = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!panStart) return;
    e.preventDefault();
    const v = viewport();
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setViewport({
      scale: v.scale,
      tx: clampTx(panStart.tx + dx * (VIEW_W / (containerEl?.clientWidth ?? VIEW_W)), v.scale),
      ty: clampTy(panStart.ty + dy * (VIEW_H / (containerEl?.clientHeight ?? VIEW_H)), v.scale),
    });
  };
  const onPointerUp = (e: PointerEvent): void => {
    panStart = null;
    if (containerEl?.hasPointerCapture(e.pointerId)) {
      containerEl.releasePointerCapture(e.pointerId);
    }
  };
  const onWheel = (e: WheelEvent): void => {
    if (!containerEl) return;
    e.preventDefault();
    const rect = containerEl.getBoundingClientRect();
    const ox = (e.clientX - rect.left) / rect.width;
    const oy = (e.clientY - rect.top) / rect.height;
    zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, ox, oy);
  };
  const activePointers = new Map<number, { x: number; y: number }>();
  const onTouchStart = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      const [a, b] = Array.from(activePointers.values());
      if (!a || !b) return;
      pinchStart = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: viewport().scale,
      };
    }
  };
  const onTouchMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' || !pinchStart) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      const [a, b] = Array.from(activePointers.values());
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / pinchStart.distance;
      const newScale = clamp(pinchStart.scale * ratio, MIN_SCALE, MAX_SCALE);
      const v = viewport();
      setViewport({ ...v, scale: newScale });
    }
  };
  const onTouchEnd = (e: PointerEvent): void => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStart = null;
  };

  onMount(() => {
    if (!containerEl) return;
    containerEl.addEventListener('wheel', onWheel, { passive: false });
    onCleanup(() => containerEl?.removeEventListener('wheel', onWheel));
  });

  let panelEl: HTMLDivElement | undefined;
  createEffect(() => {
    const r = active();
    if (panelEl && r) {
      panelEl.setAttribute('aria-label', `${r.name} — ${r.subtitle}`);
    }
  });

  const transform = (): string => {
    const v = viewport();
    return `translate(${v.tx}, ${v.ty}) scale(${v.scale})`;
  };

  return (
    <section class="worldmap" aria-label="Map of Sosaria">
      <div class="worldmap__inner">
        <div
          class="worldmap__viewport"
          ref={containerEl}
          onPointerDown={(e) => {
            onPointerDown(e);
            onTouchStart(e);
          }}
          onPointerMove={(e) => {
            onPointerMove(e);
            onTouchMove(e);
          }}
          onPointerUp={(e) => {
            onPointerUp(e);
            onTouchEnd(e);
          }}
          onPointerCancel={(e) => {
            onPointerUp(e);
            onTouchEnd(e);
          }}
        >
          <svg
            ref={svgEl}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            class="worldmap__svg"
            role="img"
            aria-label="Interactive map of Sosaria"
            preserveAspectRatio="xMidYMid meet"
          >
            <title>Sosaria</title>
            <g transform={transform()}>
              <defs>
                <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stop-color="#1a160c" />
                  <stop offset="100%" stop-color="#040405" />
                </radialGradient>
                <pattern
                  id="parchment-grain"
                  width="120"
                  height="120"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="120" height="120" fill="rgba(207, 150, 47, 0.04)" />
                  <circle cx="20" cy="40" r="1.5" fill="rgba(244, 204, 102, 0.05)" />
                  <circle cx="80" cy="90" r="1" fill="rgba(244, 204, 102, 0.04)" />
                </pattern>
              </defs>
              <rect width={VIEW_W} height={VIEW_H} fill="url(#vignette)" />
              <rect width={VIEW_W} height={VIEW_H} fill="url(#parchment-grain)" />
              <path
                d="M 80 200 Q 200 120 360 160 T 700 200 Q 900 180 1080 220 L 1140 380 Q 1100 540 980 620 Q 800 700 600 680 Q 380 700 220 620 Q 100 540 80 380 Z"
                fill="rgba(36, 30, 16, 0.85)"
                stroke="rgba(207, 150, 47, 0.35)"
                stroke-width="1.5"
              />
              <path
                d="M 480 240 L 540 180 L 600 240 M 580 250 L 640 200 L 700 250"
                fill="none"
                stroke="rgba(207, 150, 47, 0.5)"
                stroke-width="2"
              />
              <g fill="rgba(94, 138, 58, 0.45)">
                <circle cx="300" cy="500" r="6" />
                <circle cx="320" cy="490" r="5" />
                <circle cx="340" cy="510" r="6" />
                <circle cx="380" cy="500" r="5" />
                <circle cx="420" cy="520" r="6" />
              </g>
              <g transform="translate(1080, 130)" opacity="0.6">
                <circle r="32" fill="none" stroke="rgba(207, 150, 47, 0.5)" />
                <text
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="14"
                  font-family='"Cinzel", serif'
                  fill="rgba(244, 204, 102, 0.8)"
                >
                  N
                </text>
              </g>
              <For each={WORLD_REGIONS}>
                {(region) => (
                  <g
                    class="worldmap__region"
                    classList={{ 'is-active': active()?.id === region.id }}
                  >
                    <polygon
                      points={region.polygon}
                      fill={KIND_COLOR[region.kind]}
                      stroke="rgba(244, 204, 102, 0.7)"
                      stroke-width="1.5"
                      tabindex="0"
                      role="button"
                      aria-label={`${region.name} — ${region.subtitle}`}
                      onClick={() => setActive(region)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActive(region);
                        }
                      }}
                    />
                    <text
                      x={region.pin[0]}
                      y={region.pin[1]}
                      text-anchor="middle"
                      font-size="14"
                      font-family='"Cinzel", serif'
                      fill="rgba(244, 204, 102, 0.9)"
                      pointer-events="none"
                    >
                      {region.name}
                    </text>
                  </g>
                )}
              </For>
            </g>
          </svg>

          <div class="worldmap__controls" aria-label="Map controls">
            <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
              +
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
              −
            </button>
            <button type="button" onClick={reset} aria-label="Reset view">
              ⌖
            </button>
          </div>
        </div>

        <aside class="worldmap__panel" ref={panelEl} aria-live="polite">
          <Show when={active()}>
            {(region) => (
              <>
                <span class="worldmap__panel-kind">
                  {region().kind.charAt(0).toUpperCase() + region().kind.slice(1)}
                </span>
                <h2 class="worldmap__panel-name">{region().name}</h2>
                <p class="worldmap__panel-subtitle">{region().subtitle}</p>
                <p class="worldmap__panel-description">{region().description}</p>
              </>
            )}
          </Show>
          <ol class="worldmap__list">
            <For each={WORLD_REGIONS}>
              {(region) => (
                <li>
                  <button
                    type="button"
                    onClick={() => setActive(region)}
                    classList={{ 'is-active': active()?.id === region.id }}
                  >
                    <span class="worldmap__list-dot" aria-hidden="true" />
                    <span>{region.name}</span>
                  </button>
                </li>
              )}
            </For>
          </ol>
        </aside>
      </div>
      <style>{WORLDMAP_CSS}</style>
    </section>
  );
};

export default WorldMap;

const WORLDMAP_CSS = `
.worldmap {
  margin: 24px 0;
}
.worldmap__inner {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}
@media (max-width: 880px) {
  .worldmap__inner { grid-template-columns: 1fr; }
}
.worldmap__viewport {
  position: relative;
  background: #050505;
  border: 1px solid rgba(207, 150, 47, 0.3);
  border-radius: 4px;
  overflow: hidden;
  aspect-ratio: 3 / 2;
  touch-action: none;
  cursor: grab;
}
.worldmap__viewport:active { cursor: grabbing; }
.worldmap__svg {
  width: 100%;
  height: 100%;
  display: block;
}
.worldmap__region polygon {
  cursor: pointer;
  transition: fill 200ms, stroke 200ms;
}
.worldmap__region polygon:hover,
.worldmap__region polygon:focus-visible,
.worldmap__region.is-active polygon {
  fill-opacity: 0.85;
  stroke: var(--br-sigil-200);
  stroke-width: 2.5;
  outline: none;
}
.worldmap__controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 4px;
  background: rgba(8, 7, 5, 0.85);
  padding: 4px;
  border: 1px solid rgba(207, 150, 47, 0.3);
  border-radius: 2px;
}
.worldmap__controls button {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(207, 150, 47, 0.3);
  color: var(--br-sigil-200);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 2px;
}
.worldmap__controls button:hover { background: rgba(207, 150, 47, 0.15); }
.worldmap__panel {
  background: linear-gradient(180deg, rgba(20, 17, 12, 0.78) 0%, rgba(8, 7, 5, 0.85) 100%);
  border: 1px solid rgba(207, 150, 47, 0.25);
  border-radius: 4px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}
.worldmap__panel-kind {
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--br-sigil-300);
}
.worldmap__panel-name {
  margin: 4px 0 4px;
  font-size: 1.5rem;
}
.worldmap__panel-subtitle {
  font-style: italic;
  color: var(--br-parchment-300);
  margin: 0 0 12px;
}
.worldmap__panel-description {
  color: var(--br-parchment-100);
  font-size: 0.9375rem;
  margin: 0 0 16px;
}
.worldmap__list {
  list-style: none;
  margin: 16px 0 0;
  padding: 16px 0 0;
  border-top: 1px solid rgba(207, 150, 47, 0.15);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.worldmap__list button {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  background: transparent;
  border: 0;
  color: var(--br-parchment-100);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  border-radius: 2px;
  font-family: var(--br-font-body);
}
.worldmap__list button:hover { background: rgba(207, 150, 47, 0.08); }
.worldmap__list button.is-active {
  background: rgba(207, 150, 47, 0.12);
  color: var(--br-sigil-200);
}
.worldmap__list-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--br-sigil-400);
}
`;
