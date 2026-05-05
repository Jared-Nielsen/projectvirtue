// Protected-route guard. Routes wrapped in <Protected> redirect to /login when
// the mock auth signal is not authenticated.

import { Navigate } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';
import { isAuthenticated } from '../state/auth';

export interface ProtectedProps {
  children: JSX.Element;
}

export function Protected(props: ProtectedProps): JSX.Element {
  return (
    <Show when={isAuthenticated()} fallback={<Navigate href="/login" />}>
      {props.children}
    </Show>
  );
}
