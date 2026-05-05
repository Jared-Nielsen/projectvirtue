import type { ApiError } from '@br/types';

/**
 * Failure-injection modes for the dev panel. The MockClient consults this on
 * every request; if set, it short-circuits the response with the matching
 * synthetic failure.
 */
export type FailureMode = 'auth' | 'forbidden' | 'not-found' | 'server' | 'timeout' | 'network';

export interface FailureResult {
  readonly status: number;
  readonly error: ApiError;
}

const STATUS: Record<FailureMode, FailureResult> = {
  auth: {
    status: 401,
    error: { code: 'ERR_AUTH', message: 'Mock failure: 401 Unauthorized' },
  },
  forbidden: {
    status: 403,
    error: { code: 'ERR_CAPABILITY', message: 'Mock failure: 403 Forbidden' },
  },
  'not-found': {
    status: 404,
    error: { code: 'ERR_NOT_FOUND', message: 'Mock failure: 404 Not Found' },
  },
  server: {
    status: 500,
    error: { code: 'ERR_INTERNAL', message: 'Mock failure: 500 Internal Server Error' },
  },
  timeout: {
    status: 504,
    error: { code: 'ERR_INTERNAL', message: 'Mock failure: 504 Gateway Timeout' },
  },
  network: {
    status: 0,
    error: { code: 'ERR_INTERNAL', message: 'Mock failure: simulated network error' },
  },
};

export function failureFor(mode: FailureMode): FailureResult {
  return STATUS[mode];
}

/** Thrown by MockClient when failure injection is active. */
export class MockFailure extends Error {
  readonly status: number;
  readonly apiError: ApiError;
  constructor(mode: FailureMode) {
    const f = failureFor(mode);
    super(f.error.message);
    this.name = 'MockFailure';
    this.status = f.status;
    this.apiError = f.error;
  }
}
