// Plausible-compatible analytics stub. No real DSN. Events are dropped if
// the user has not granted consent (lib/consent.ts) — Doc #38 §2.3 requires
// analytics to be opt-in (lawful basis: consent).

import { hasAnalyticsConsent } from './consent';

export interface AnalyticsEvent {
  readonly name: string;
  readonly props?: Readonly<Record<string, string | number | boolean>>;
  readonly path?: string;
}

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

function debug(...args: unknown[]): void {
  if (DEV && isBrowser()) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', ...args);
  }
}

/** Plausible-shaped event dispatcher. No-op until consent is granted. */
export function track(event: AnalyticsEvent): void {
  if (!isBrowser()) return;
  if (!hasAnalyticsConsent()) {
    debug('blocked (no consent):', event.name);
    return;
  }
  debug('track:', event);
  // Real implementation would POST to /api/event with the Plausible payload:
  // { name, url, domain, referrer, props }
  // Stub: no network call; satisfies the analytics contract.
}

export function trackPageview(path: string): void {
  track({ name: 'pageview', path });
}
