// Mock authentication state — a Solid signal that gates the protected routes.
// Real auth is out of scope for the frontend scaffold; the wire/token shape
// lives in @br/types `auth.ts` and will be wired to a real session store
// later. The mock layer just flips the boolean.
//
// Persistence: the signal mirrors `localStorage('pv.auth.session.v1')` so a
// page reload, a fresh tab, or a deep-link in via `?editor` survives the
// route guard. Sign-out clears the key. The persistence is best-effort —
// SSR / private mode storage failures fail safe to "not authenticated".

import type { Me } from '@br/types';
import { createSignal } from 'solid-js';

export interface AuthState {
  readonly authenticated: boolean;
  readonly me: Me | null;
}

const STORAGE_KEY = 'pv.auth.session.v1';

function readStoredAuth(): AuthState {
  if (typeof window === 'undefined') return { authenticated: false, me: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { authenticated: false, me: null };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (parsed && parsed.authenticated === true) {
      return { authenticated: true, me: parsed.me ?? null };
    }
  } catch {
    /* private-mode storage / corrupt JSON — fail safe */
  }
  return { authenticated: false, me: null };
}

function writeStoredAuth(state: AuthState): void {
  if (typeof window === 'undefined') return;
  try {
    if (state.authenticated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* sandboxed storage — drop the write */
  }
}

const [authState, setAuthState] = createSignal<AuthState>(readStoredAuth());

export { authState };

export const isAuthenticated = (): boolean => authState().authenticated;

/** Mock sign-in. Real flow goes through `mockClient.post('/v1/auth/login', ...)`. */
export function signIn(me: Me | null = null): void {
  const next: AuthState = { authenticated: true, me };
  setAuthState(next);
  writeStoredAuth(next);
}

export function signOut(): void {
  const next: AuthState = { authenticated: false, me: null };
  setAuthState(next);
  writeStoredAuth(next);
}
