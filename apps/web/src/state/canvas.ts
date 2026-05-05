// Canvas-state signals — bridge between the Solid HUD layer and the
// PixiJS canvas runtime.
//
// The HUD lives in the Solid component tree; the canvas runtime owns
// `dayNight`, `lighting`, the perf overlay, and other render-side state.
// Direct refs across the two would mix lifetimes (Solid component vs.
// canvas mount/destroy), so we route them through Solid signals here:
//
//   - `currentHour`       drives `dayNight.setHour()` from a HUD slider
//   - `dayNightAutoAdvance` pauses the cycle when the slider is held
//   - `hudOverlaysVisible` toggles the dayNight + lighting + perf
//                          overlays from a HUD button (or the H key)
//
// `GameCanvas.tsx` subscribes to these signals via `createEffect` and
// calls the matching `CanvasRuntime` methods. The HUD writes; the
// canvas reads. No imperative cross-talk.

import { createSignal } from 'solid-js';

const [currentHour, setCurrentHour] = createSignal<number>(12);
const [dayNightAutoAdvance, setDayNightAutoAdvance] = createSignal<boolean>(true);
const [hudOverlaysVisible, setHudOverlaysVisible] = createSignal<boolean>(true);

export const canvasState = {
  currentHour,
  dayNightAutoAdvance,
  hudOverlaysVisible,
  setCurrentHour,
  setDayNightAutoAdvance,
  setHudOverlaysVisible,
};
