// MockClient — a fetch-shaped, in-process JSON shim for SSR/tests/dev.
//
// Apps in browser dev mode should prefer the MSW worker (see ./browser.ts);
// the MockClient covers SSR, vitest, and "before MSW boots" code paths.
//
// Wave 3 will likely wrap this in a typed service-layer (e.g. `accountService`,
// `worldService`) — the client itself stays endpoint-shaped so the eventual
// swap to a `ProtobufClient` is a one-file substitution.

import type { ApiError } from '@br/types';
import { type FailureMode, MockFailure } from './failure';
import { getLatencyMs, setLatency, sleep } from './latency';
import { type Method, matchRoute } from './route-table';

export interface MockClientOptions {
  readonly baseUrl?: string;
  readonly latencyMs?: number;
  readonly failureMode?: FailureMode | null;
}

export interface MockRequestInit {
  readonly url: string;
  readonly method?: Method;
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly headers?: Readonly<Record<string, string>>;
}

export class MockClient {
  #baseUrl: string;
  #failureMode: FailureMode | null;

  constructor(opts: MockClientOptions = {}) {
    this.#baseUrl = opts.baseUrl ?? 'https://mock.avermere.local';
    this.#failureMode = opts.failureMode ?? null;
    if (opts.latencyMs !== undefined) setLatency(opts.latencyMs);
  }

  setLatency(ms: number): void {
    setLatency(ms);
  }

  setFailureMode(mode: FailureMode | null): void {
    this.#failureMode = mode;
  }

  async get<T>(url: string, init?: Omit<MockRequestInit, 'url' | 'method' | 'body'>): Promise<T> {
    return this.request<T>({ ...init, url, method: 'GET' });
  }

  async post<T>(
    url: string,
    body?: unknown,
    init?: Omit<MockRequestInit, 'url' | 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>({ ...init, url, method: 'POST', body });
  }

  async put<T>(
    url: string,
    body?: unknown,
    init?: Omit<MockRequestInit, 'url' | 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>({ ...init, url, method: 'PUT', body });
  }

  async delete<T>(
    url: string,
    init?: Omit<MockRequestInit, 'url' | 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>({ ...init, url, method: 'DELETE' });
  }

  async request<T>(init: MockRequestInit): Promise<T> {
    await sleep(getLatencyMs());

    if (this.#failureMode) {
      throw new MockFailure(this.#failureMode);
    }

    const method = (init.method ?? 'GET') as Method;
    const target = this.#resolveUrl(init.url, init.query);
    const matched = matchRoute(method, target.pathname);

    if (!matched) {
      const err: ApiError = {
        code: 'ERR_NOT_FOUND',
        message: `MockClient: no route for ${method} ${target.pathname}`,
      };
      throw new MockClientError(404, err);
    }

    const result = await matched.entry.handler({
      url: target,
      params: matched.params,
      query: Object.fromEntries(target.searchParams.entries()),
      body: init.body,
    });

    return result as T;
  }

  #resolveUrl(
    raw: string,
    query?: Readonly<Record<string, string | number | boolean | undefined>>,
  ): URL {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, this.#baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url;
  }
}

/** Thrown for non-failure-injection request errors (404 from a missing route). */
export class MockClientError extends Error {
  readonly status: number;
  readonly apiError: ApiError;
  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.name = 'MockClientError';
    this.status = status;
    this.apiError = apiError;
  }
}
