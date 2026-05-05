import { type JSX, onCleanup, onMount } from 'solid-js';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface FocusTrapProps {
  active?: boolean;
  /** When true, focus first focusable element on mount. Defaults to true. */
  autoFocus?: boolean;
  /** When true, restore focus on unmount. Defaults to true. */
  restoreFocus?: boolean;
  children: JSX.Element;
}

/**
 * Traps Tab / Shift-Tab focus within its children while `active` is true.
 * Used inside Modal/Drawer/Popover for keyboard accessibility.
 */
export function FocusTrap(props: FocusTrapProps): JSX.Element {
  let container: HTMLDivElement | undefined;
  let previouslyFocused: HTMLElement | null = null;

  const handleKey = (event: KeyboardEvent) => {
    if (props.active === false) return;
    if (event.key !== 'Tab' || !container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('aria-hidden'),
    );
    if (nodes.length === 0) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  onMount(() => {
    if (typeof document === 'undefined') return;
    previouslyFocused = document.activeElement as HTMLElement | null;
    if ((props.autoFocus ?? true) && container) {
      const focusable = container.querySelector<HTMLElement>(FOCUSABLE);
      focusable?.focus();
    }
    document.addEventListener('keydown', handleKey);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKey);
      if ((props.restoreFocus ?? true) && previouslyFocused) {
        previouslyFocused.focus();
      }
    });
  });

  return <div ref={container}>{props.children}</div>;
}
