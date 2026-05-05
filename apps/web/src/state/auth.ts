// Mock authentication state — a Solid signal that gates the protected routes.
// Real auth is out of scope for the frontend scaffold; the wire/token shape
// lives in @br/types `auth.ts` and will be wired to a real session store
// later. The mock layer just flips the boolean.

import type { Me } from '@br/types';
import { createSignal } from 'solid-js';

export interface AuthState {
  readonly authenticated: boolean;
  readonly me: Me | null;
}

const [authState, setAuthState] = createSignal<AuthState>({
  authenticated: false,
  me: null,
});

export { authState };

export const isAuthenticated = (): boolean => authState().authenticated;

/** Mock sign-in. Real flow goes through `mockClient.post('/v1/auth/login', ...)`. */
export function signIn(me: Me | null = null): void {
  setAuthState({ authenticated: true, me });
}

export function signOut(): void {
  setAuthState({ authenticated: false, me: null });
}
