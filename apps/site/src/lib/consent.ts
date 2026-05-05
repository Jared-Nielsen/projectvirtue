// GDPR cookie consent (per Doc #38).
// We store a single localStorage key with a typed payload. The banner is
// shown until the user clicks Accept or Decline. The footer's "Reset cookie
// preferences" link clears the key so the banner re-appears.
//
// Per Doc #38 §2.3, telemetry/analytics is consent-based — DEFAULT OFF.
// "Decline" persists a record so we don't re-prompt every visit, and so the
// analytics gate (lib/analytics.ts) treats decline === reject.

import { isServer } from 'solid-js/web';

export type ConsentChoice = 'accept' | 'decline';

export interface ConsentRecord {
  readonly choice: ConsentChoice;
  readonly version: number;
  readonly decidedAt: string;
}

export const CONSENT_KEY = 'br.consent.v1';
export const CONSENT_VERSION = 1;

export function readConsent(): ConsentRecord | null {
  if (isServer || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): ConsentRecord {
  const record: ConsentRecord = {
    choice,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  if (!isServer && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    } catch {
      // ignore (private mode / quota)
    }
  }
  return record;
}

export function clearConsent(): void {
  if (isServer || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.choice === 'accept';
}
