// Browser-side MSW worker setup. Apps in dev mode call `startMockWorker()`
// before mounting their root component.
//
// The worker file (`mockServiceWorker.js`) must be served from the app's
// public directory. Generate it once per app with:
//
//   pnpm dlx msw init <app>/public --save
//
// Apps then import:
//
//   import { startMockWorker } from '@br/mocks/browser';
//   if (import.meta.env.DEV) await startMockWorker();

import { type SetupWorker, setupWorker } from 'msw/browser';
import type { FailureMode } from './failure';
import { handlers } from './handlers';

let workerSingleton: SetupWorker | null = null;

export interface StartMockWorkerOptions {
  /** Path to the service worker script; defaults to MSW's standard location. */
  readonly serviceWorkerUrl?: string;
  /** What MSW does for unmatched requests; default 'bypass' so real network
   *  calls (e.g. CDN assets) keep working. */
  readonly onUnhandledRequest?: 'bypass' | 'warn' | 'error';
  /** Initial latency override (ms). */
  readonly latencyMs?: number;
  /** Initial failure mode (writes to sessionStorage). */
  readonly failureMode?: FailureMode | null;
}

export async function startMockWorker(opts: StartMockWorkerOptions = {}): Promise<SetupWorker> {
  if (workerSingleton) return workerSingleton;
  if (typeof window === 'undefined') {
    throw new Error('startMockWorker called in a non-browser environment');
  }

  if (opts.latencyMs !== undefined) {
    window.sessionStorage?.setItem('br.mock.latencyMs', String(opts.latencyMs));
  }
  if (opts.failureMode !== undefined) {
    if (opts.failureMode === null) {
      window.sessionStorage?.removeItem('br.mock.failureMode');
    } else {
      window.sessionStorage?.setItem('br.mock.failureMode', opts.failureMode);
    }
  }

  workerSingleton = setupWorker(...handlers);
  const startOpts: Parameters<SetupWorker['start']>[0] = {
    onUnhandledRequest: opts.onUnhandledRequest ?? 'bypass',
  };
  if (opts.serviceWorkerUrl) {
    (startOpts as { serviceWorker?: { url: string } }).serviceWorker = {
      url: opts.serviceWorkerUrl,
    };
  }
  await workerSingleton.start(startOpts);
  return workerSingleton;
}

export function stopMockWorker(): void {
  if (workerSingleton) {
    workerSingleton.stop();
    workerSingleton = null;
  }
}

export function getMockWorker(): SetupWorker | null {
  return workerSingleton;
}

export { handlers } from './handlers';
