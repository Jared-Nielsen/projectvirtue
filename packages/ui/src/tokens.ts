// Project Virtue — design tokens.
// Single source of truth for color, type, space, motion, etc.
// Mirrored as CSS custom properties in tokens.css for runtime theming.
//
// The palette is extracted from /_conceptart (parchment scrolls, gilded
// sigils, virtue-blue HUD chrome, dungeon-dark backplates).

export const colors = {
  // Parchment / cream — warm cream → aged brown.
  parchment: {
    50: '#fbf3e2',
    100: '#f5e7c6',
    200: '#ebd6a3',
    300: '#dcc080',
    400: '#c8a763',
    500: '#a8854a',
    600: '#856738',
    700: '#624c2a',
    800: '#42331c',
    900: '#251c10',
  },

  // Ink — deep brown/black for type on parchment.
  ink: {
    50: '#e6e1d4',
    100: '#bdb4a0',
    200: '#8d8266',
    300: '#5e5440',
    400: '#3d3526',
    500: '#251f12',
    600: '#1a160c',
    700: '#120e07',
    800: '#0b0904',
    900: '#050402',
  },

  // Sigil-gold — the gilded accents on the logo and frames.
  sigil: {
    50: '#fdf4d3',
    100: '#fae29a',
    200: '#f4cc66',
    300: '#e6b246',
    400: '#cf962f',
    500: '#b07a1f',
    600: '#8a5d15',
    700: '#65430e',
    800: '#412b08',
    900: '#221603',
  },

  // Virtue-blue — UI accent / HUD chrome.
  virtue: {
    50: '#e6eef6',
    100: '#c1d3e6',
    200: '#94b1cf',
    300: '#6890b6',
    400: '#42729b',
    500: '#2a587e',
    600: '#1d4264',
    700: '#142f4a',
    800: '#0c1d31',
    900: '#070f1c',
  },

  // Blood-red — damage / destructive actions.
  blood: {
    50: '#fbe1de',
    100: '#f4b5ad',
    200: '#e98678',
    300: '#d85a48',
    400: '#bb3c2b',
    500: '#962b1e',
    600: '#751f15',
    700: '#56150e',
    800: '#380c08',
    900: '#1c0503',
  },

  // Mana-azure — mana / arcane bars and glows.
  mana: {
    50: '#dff1ff',
    100: '#b3dcfc',
    200: '#7ec0f6',
    300: '#4aa0e8',
    400: '#2a7fcb',
    500: '#1c63a8',
    600: '#134a82',
    700: '#0d345d',
    800: '#08213c',
    900: '#04111f',
  },

  // Dungeon-black — deep void / vignette.
  dungeon: {
    50: '#9aa0a8',
    100: '#6c727a',
    200: '#494d54',
    300: '#2f3239',
    400: '#1f2127',
    500: '#13151a',
    600: '#0c0d11',
    700: '#070809',
    800: '#040405',
    900: '#020203',
  },

  // Single-value semantic / functional swatches with -on (foreground) pair.
  success: { base: '#5e8a3a', on: '#0d1808' },
  warning: { base: '#cf962f', on: '#1f1502' },
  danger: { base: '#962b1e', on: '#1c0503' },
  info: { base: '#2a7fcb', on: '#04111f' },

  // Pure helpers.
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const typography = {
  fontFamily: {
    // Display + headings — fantasy serif. Custom faces ship later.
    display: '"Cinzel", "Trajan Pro", "Cormorant Garamond", Georgia, serif',
    heading: '"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif',
    // Body / UI — humanist sans for readability.
    body: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    ui: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    // HUD numerics / mono.
    hudMono: '"JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, monospace',
  },
  scale: {
    display: { size: '4rem', lineHeight: '1.05', weight: 700, tracking: '0.02em' },
    h1: { size: '3rem', lineHeight: '1.1', weight: 700, tracking: '0.01em' },
    h2: { size: '2.25rem', lineHeight: '1.15', weight: 700, tracking: '0.01em' },
    h3: { size: '1.75rem', lineHeight: '1.2', weight: 600, tracking: '0' },
    h4: { size: '1.375rem', lineHeight: '1.25', weight: 600, tracking: '0' },
    h5: { size: '1.125rem', lineHeight: '1.3', weight: 600, tracking: '0' },
    h6: { size: '1rem', lineHeight: '1.35', weight: 600, tracking: '0.02em' },
    body: { size: '1rem', lineHeight: '1.5', weight: 400, tracking: '0' },
    bodySm: { size: '0.875rem', lineHeight: '1.5', weight: 400, tracking: '0' },
    ui: { size: '0.9375rem', lineHeight: '1.4', weight: 500, tracking: '0' },
    label: { size: '0.75rem', lineHeight: '1.3', weight: 600, tracking: '0.06em' },
    hudMono: { size: '0.875rem', lineHeight: '1.2', weight: 500, tracking: '0.04em' },
  },
} as const;

// 4px base spacing scale — keys are in units of 4px (so 1 === 4px, 4 === 16px).
export const spacing = {
  0: '0px',
  '0.5': '2px',
  1: '4px',
  '1.5': '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const radii = {
  none: '0px',
  sm: '2px',
  md: '4px',
  lg: '8px',
  xl: '14px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
  md: '0 4px 8px rgba(0, 0, 0, 0.4)',
  lg: '0 12px 28px rgba(0, 0, 0, 0.5)',
  glowGold: '0 0 12px rgba(207, 150, 47, 0.55), 0 0 2px rgba(244, 204, 102, 0.8)',
  glowBlue: '0 0 12px rgba(74, 160, 232, 0.55), 0 0 2px rgba(126, 192, 246, 0.8)',
  parchmentEmboss:
    'inset 0 1px 0 rgba(255, 240, 210, 0.55), inset 0 -1px 0 rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.35)',
} as const;

export const blur = {
  sm: '4px',
  md: '10px',
  lg: '24px',
} as const;

export const zIndex = {
  canvas: 0,
  hud: 100,
  modal: 1000,
  toast: 2000,
  debug: 9000,
} as const;

export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    base: '200ms',
    slow: '360ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  blur,
  zIndex,
  motion,
  breakpoints,
} as const;

export type Tokens = typeof tokens;
export type ColorScale = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radii;
export type ShadowKey = keyof typeof shadows;

export default tokens;
