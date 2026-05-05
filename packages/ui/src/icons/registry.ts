// UI affordance icons (toolbar/HUD chrome).
// The dedicated /packages/icons package is reserved for game art icons.
// Each entry: a 24×24 viewBox path. Add more as components require them.

export type IconName =
  | 'sword'
  | 'shield'
  | 'scroll'
  | 'heart'
  | 'star'
  | 'x'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'search'
  | 'eye'
  | 'eye-off'
  | 'spinner';

export interface IconDefinition {
  /** SVG viewBox; default 0 0 24 24. */
  viewBox?: string;
  /** Inner SVG markup (paths, etc.) — `currentColor` for stroke/fill. */
  body: string;
}

export const iconRegistry: Record<IconName, IconDefinition> = {
  sword: {
    body:
      '<path d="M3 21l3.5-1.5L18 8l-2-2L4.5 17.5 3 21z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M14 4l6 6-2 2-6-6 2-2z" fill="currentColor"/>' +
      '<path d="M5 19l1 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
  shield: {
    body:
      '<path d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6l8-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  scroll: {
    body:
      '<path d="M5 4h12a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V6a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M8 8h7M8 12h7M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
  heart: {
    body: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" fill="currentColor"/>',
  },
  star: {
    body: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" fill="currentColor"/>',
  },
  x: {
    body: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  },
  check: {
    body: '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  'chevron-down': {
    body: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  'chevron-right': {
    body: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  search: {
    body:
      '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
      '<path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  },
  eye: {
    body:
      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  },
  'eye-off': {
    body:
      '<path d="M3 3l18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M10.6 10.6a2 2 0 002.8 2.8" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M9.9 5.1A10.5 10.5 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.2 6.2A17.4 17.4 0 002 12s3.5 7 10 7a10.5 10.5 0 005.1-1.3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  },
  spinner: {
    body: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="36 56"/>',
  },
};
