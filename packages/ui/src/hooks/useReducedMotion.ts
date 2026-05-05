import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { isServer } from 'solid-js/web';

/**
 * Returns a reactive boolean that tracks the
 * `(prefers-reduced-motion: reduce)` media query.
 *
 * Defaults to `false` on the server.
 */
export function useReducedMotion(): Accessor<boolean> {
  const [prefers, setPrefers] = createSignal(false);

  if (isServer || typeof window === 'undefined' || !('matchMedia' in window)) {
    return prefers;
  }

  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  setPrefers(mql.matches);
  const listener = (event: MediaQueryListEvent) => setPrefers(event.matches);

  if ('addEventListener' in mql) {
    mql.addEventListener('change', listener);
    onCleanup(() => mql.removeEventListener('change', listener));
  }

  return prefers;
}
