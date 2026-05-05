/**
 * Configurable artificial delay for the mock layer. Wave 3 dev panels can
 * override the default by writing to sessionStorage:
 *
 *   sessionStorage.setItem('br.mock.latencyMs', '450');
 *
 * The MockClient reads `getLatencyMs()` on every request.
 */

const STORAGE_KEY = 'br.mock.latencyMs';
const DEFAULT_LATENCY_MS = 80;

let processLatency: number | null = null;

/** Set the in-process latency override (used by Node/SSR/tests). */
export function setLatency(ms: number): void {
  processLatency = Math.max(0, ms);
}

/** Read the active latency in ms (browser sessionStorage takes priority). */
export function getLatencyMs(): number {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage?.getItem(STORAGE_KEY);
      if (raw != null) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
  return processLatency ?? DEFAULT_LATENCY_MS;
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
