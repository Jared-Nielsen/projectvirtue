// Shared helpers for MSW handlers. Each per-domain handler module imports
// `domainHandlers(prefix)` to convert matching route-table entries into MSW
// `http.*` registrations.

import {
  http,
  type DefaultBodyType,
  type HttpHandler,
  HttpResponse,
  type StrictResponse,
} from 'msw';
import { type FailureMode, failureFor } from '../failure';
import { getLatencyMs, sleep } from '../latency';
import { type Method, type RouteEntry, matchRoute, routeTable } from '../route-table';

/** Read the active failure mode from sessionStorage at request time. */
function readFailureMode(): FailureMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem('br.mock.failureMode');
    if (!raw) return null;
    if (
      raw === 'auth' ||
      raw === 'forbidden' ||
      raw === 'not-found' ||
      raw === 'server' ||
      raw === 'timeout' ||
      raw === 'network'
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

type Resolver = (info: {
  request: Request;
  params: Record<string, string | readonly string[]>;
}) => Promise<StrictResponse<DefaultBodyType> | Response>;

type Factory = (path: string, resolver: Resolver) => HttpHandler;

const METHOD_TO_HTTP: Record<Method, Factory> = {
  GET: http.get as unknown as Factory,
  POST: http.post as unknown as Factory,
  PUT: http.put as unknown as Factory,
  PATCH: http.patch as unknown as Factory,
  DELETE: http.delete as unknown as Factory,
};

function entryToHandler(entry: RouteEntry): HttpHandler {
  // MSW path syntax (`:param`) matches our pattern format directly. The
  // leading `*` lets MSW match any host the app talks to (apps may baseUrl
  // their fetches at relative paths or full URLs).
  const factory = METHOD_TO_HTTP[entry.method];
  return factory(`*${entry.pattern}`, async ({ request, params }) => {
    await sleep(getLatencyMs());

    const failure = readFailureMode();
    if (failure === 'network') {
      // MSW will surface this as a network error to the fetch caller.
      return HttpResponse.error();
    }
    if (failure) {
      const f = failureFor(failure);
      return HttpResponse.json(f.error as unknown as DefaultBodyType, { status: f.status });
    }

    const url = new URL(request.url);
    const matched = matchRoute(entry.method, url.pathname);
    if (!matched) {
      return HttpResponse.json(
        { code: 'ERR_NOT_FOUND', message: 'no route' } as unknown as DefaultBodyType,
        { status: 404 },
      );
    }

    let body: unknown = undefined;
    if (entry.method !== 'GET' && entry.method !== 'DELETE') {
      try {
        body = await request.clone().json();
      } catch {
        body = undefined;
      }
    }

    const flatParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      flatParams[k] = Array.isArray(v) ? (v[0] ?? '') : (v as string);
    }

    const result = await entry.handler({
      url,
      params: { ...matched.params, ...flatParams },
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    });

    return HttpResponse.json(result as DefaultBodyType, { status: entry.status ?? 200 });
  });
}

export function domainHandlers(prefix: string): HttpHandler[] {
  return routeTable.filter((e) => e.pattern.startsWith(prefix)).map((e) => entryToHandler(e));
}

/** All handlers, in route-table order. */
export function allHandlers(): HttpHandler[] {
  return routeTable.map((e) => entryToHandler(e));
}
