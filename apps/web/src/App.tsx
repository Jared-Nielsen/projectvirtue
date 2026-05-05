// Root component. Composes the @solidjs/router host, the toast viewport, and a
// global key handler that closes the topmost modal on Escape (FocusTrap inside
// each modal handles its own Tab cycling — see @br/ui Modal).

import { ToastViewport } from '@br/ui';
import { type RouteSectionProps, Router } from '@solidjs/router';
import { type Component, type JSX, onCleanup, onMount } from 'solid-js';
import { useRouteSound } from './hooks/useRouteSound';
import { Routes } from './router';

/** Inner component renders inside the router so hooks like useLocation work. */
function RouterChildren(props: RouteSectionProps): JSX.Element {
  useRouteSound();
  return <>{props.children}</>;
}

export const App: Component = () => {
  // Global Esc handler. @br/ui Modal already binds Esc internally via
  // useEscape; this is a fallback for any portal content that does not.
  onMount(() => {
    function onKeyDown(ev: KeyboardEvent): void {
      if (ev.key !== 'Escape') return;
      const overlay = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (!overlay) return;
      // The bound modal owns the dismiss; just dispatch a synthetic close
      // event that listeners can subscribe to. (No-op unless something cares.)
      overlay.dispatchEvent(new CustomEvent('br:escape', { bubbles: true }));
    }
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <>
      <Router root={RouterChildren}>
        <Routes />
      </Router>
      <ToastViewport />
    </>
  );
};
