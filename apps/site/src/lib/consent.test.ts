import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_KEY,
  clearConsent,
  hasAnalyticsConsent,
  readConsent,
  writeConsent,
} from './consent';

describe('consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no consent has been recorded', () => {
    expect(readConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('persists accept', () => {
    const record = writeConsent('accept');
    expect(record.choice).toBe('accept');
    expect(readConsent()?.choice).toBe('accept');
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('persists decline and treats it as no analytics', () => {
    writeConsent('decline');
    expect(readConsent()?.choice).toBe('decline');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('clearConsent removes the record', () => {
    writeConsent('accept');
    clearConsent();
    expect(readConsent()).toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it('returns null on an unknown version', () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: 'accept', version: 99 }));
    expect(readConsent()).toBeNull();
  });
});
