// Solid wrapper around the PixiJS canvas runtime.
//
// Lifecycle:
//   - onMount: create a host <div>, call mountCanvas(), keep the runtime
//     handle in a ref.
//   - onCleanup: await runtime.destroy(); strict mode in dev double-mounts,
//     so we guard against torn-down handles.
//
// The component exposes its EventTarget via a prop callback so the route
// layer can subscribe to br:trigger:* events without importing canvas
// internals.

import { createEffect, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { canvasState } from '../state/canvas';
import { type CanvasRuntime, mountCanvas } from './app';

export interface GameCanvasProps {
  readonly onReady?: (runtime: CanvasRuntime) => void;
  readonly events?: EventTarget;
  readonly class?: string;
}

export const GameCanvas: Component<GameCanvasProps> = (props) => {
  let host: HTMLDivElement | undefined;
  let runtime: CanvasRuntime | null = null;
  let cancelled = false;

  onMount(() => {
    if (!host) return;
    void (async () => {
      try {
        const opts = props.events !== undefined ? { host, events: props.events } : { host };
        const next = await mountCanvas(opts);
        if (cancelled) {
          await next.destroy();
          return;
        }
        runtime = next;
        props.onReady?.(next);

        // Bridge HUD signals → canvas runtime. Each effect re-runs whenever
        // the corresponding signal updates and is auto-cleaned with the
        // component lifetime (Solid's tracking scope).
        createEffect(() => {
          next.setHour(canvasState.currentHour());
        });
        createEffect(() => {
          next.setDayNightAutoAdvance(canvasState.dayNightAutoAdvance());
        });
        createEffect(() => {
          next.setOverlaysVisible(canvasState.hudOverlaysVisible());
        });
      } catch (err) {
        // Surface the failure inline so the dev sees something rather than
        // a blank rectangle. The route's error boundary catches re-throws.
        // eslint-disable-next-line no-console
        console.error('[GameCanvas] mount failed', err);
        if (host) {
          host.textContent = 'Canvas failed to start. See console for details.';
          host.style.color = '#fca';
          host.style.padding = '1rem';
          host.style.fontFamily = 'system-ui, sans-serif';
        }
      }
    })();
  });

  onCleanup(() => {
    cancelled = true;
    if (runtime) {
      void runtime.destroy();
      runtime = null;
    }
  });

  return (
    <div
      ref={host}
      class={props.class}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        'min-height': '480px',
        background: '#101418',
        overflow: 'hidden',
      }}
    />
  );
};
