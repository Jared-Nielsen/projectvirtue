// Sound-on-route-change stub. No actual audio yet — Phase 7 wires real cues
// from the audio bus described in Doc #29. This hook subscribes to the active
// router location and logs which cue *would* play on each transition.

import { useLocation } from '@solidjs/router';
import { createEffect } from 'solid-js';

export type RouteCue =
  | 'menu-enter'
  | 'menu-back'
  | 'play-enter'
  | 'modal-open'
  | 'loading-veil'
  | 'silence';

/** Returns the audio cue identifier for a given pathname. */
export function cueForPath(path: string): RouteCue {
  if (path === '/' || path === '/login') return 'menu-enter';
  if (path === '/home' || path.startsWith('/character')) return 'menu-back';
  if (path.startsWith('/loading')) return 'loading-veil';
  if (
    path.startsWith('/play/dialog') ||
    path.startsWith('/play/loot') ||
    path.startsWith('/play/levelup') ||
    path.startsWith('/play/book') ||
    path.startsWith('/play/inventory') ||
    path.startsWith('/play/journal') ||
    path.startsWith('/play/options')
  ) {
    return 'modal-open';
  }
  if (path.startsWith('/play')) return 'play-enter';
  return 'silence';
}

/** Logs the cue that *would* play when the active route changes. */
export function useRouteSound(): void {
  const location = useLocation();
  let lastPath = '';
  createEffect(() => {
    const path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    const cue = cueForPath(path);
    // Intentionally a console.info; replace with audio.dispatch(cue) in Phase 7.
    // eslint-disable-next-line no-console
    console.info(`[audio] route ${path} -> ${cue}`);
  });
}
