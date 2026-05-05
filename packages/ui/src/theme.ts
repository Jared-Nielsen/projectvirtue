// Theme switching utilities.
// Apps call setTheme('dark') to apply data-theme on the root <html>.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'br.theme';

/** Imperatively set the theme on the document root. */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage?.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

/** Returns the current theme as written on <html data-theme>, defaulting to 'light'. */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const value = document.documentElement.getAttribute('data-theme');
  return value === 'dark' ? 'dark' : 'light';
}

/** Resolves the boot theme from localStorage → prefers-color-scheme → 'light'. */
export function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

/** Toggles between light and dark themes and returns the new value. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
