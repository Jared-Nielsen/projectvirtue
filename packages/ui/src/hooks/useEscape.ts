import { onCleanup, onMount } from 'solid-js';

/**
 * Calls `handler` when the user presses the Escape key, while the bound
 * effect is active. Useful for modals/popovers/drawers.
 */
export function useEscape(
  handler: (event: KeyboardEvent) => void,
  enabled: () => boolean = () => true,
): void {
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!enabled()) return;
      if (event.key === 'Escape') handler(event);
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });
}
