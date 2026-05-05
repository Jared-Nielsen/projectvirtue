// Default catch-all loading screen. Renders when the route's `:variant`
// param is unknown or omitted. Palette: parchment + ink + sigil-gold,
// matching the Codex aesthetic. Animation is the same `sigilPulse` plus a
// faint dust-drift on the FX layer.

import type { JSX } from 'solid-js';
import { LoadingScreenFrame } from './LoadingScreenFrame';

const CODEX_ART = `
  url("data:image/svg+xml;utf8,${encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice">',
      // Eight-Virtue cardinal markers around the centre
      '<g fill="none" stroke="#8a5d15" stroke-width="0.8" opacity="0.5">',
      '<circle cx="400" cy="320" r="220"/>',
      '<circle cx="400" cy="320" r="160"/>',
      '<circle cx="400" cy="320" r="100"/>',
      '<line x1="400" y1="100" x2="400" y2="540"/>',
      '<line x1="180" y1="320" x2="620" y2="320"/>',
      '<line x1="240" y1="160" x2="560" y2="480"/>',
      '<line x1="560" y1="160" x2="240" y2="480"/>',
      '</g>',
      // Eight virtue runes (just dots for simplicity)
      '<g fill="#cf962f" opacity="0.7">',
      '<circle cx="400" cy="100" r="6"/>',
      '<circle cx="555" cy="165" r="6"/>',
      '<circle cx="620" cy="320" r="6"/>',
      '<circle cx="555" cy="475" r="6"/>',
      '<circle cx="400" cy="540" r="6"/>',
      '<circle cx="245" cy="475" r="6"/>',
      '<circle cx="180" cy="320" r="6"/>',
      '<circle cx="245" cy="165" r="6"/>',
      '</g>',
      '</svg>',
    ].join(''),
  )}")
`;

const DUST = `
  radial-gradient(ellipse at 30% 40%, rgba(207, 150, 47, 0.16), transparent 55%),
  radial-gradient(ellipse at 70% 60%, rgba(244, 204, 102, 0.12), transparent 60%)
`;

const CSS_VARS: Readonly<Record<string, string>> = {
  '--bg-top': '#1a1208',
  '--bg-mid': '#2a1d0c',
  '--bg-bottom': '#0c0703',
  '--bg-glow': 'rgba(244, 204, 102, 0.18)',
  '--bg-art': CODEX_ART.trim(),
  '--bg-art-pos': 'center center',
  '--bg-art-size': 'contain',
  '--bg-art-opacity': '0.8',
  '--bg-fx': DUST,
  '--bg-fx-blend': 'screen',
  '--bg-fx-opacity': '0.5',
  '--bg-fx-anim': 'drift 40s linear infinite alternate',
};

export interface LoadingScreenDefaultProps {
  readonly tagline?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly quote?: { readonly text: string; readonly attribution: string } | null;
}

export function LoadingScreenDefault(props: LoadingScreenDefaultProps): JSX.Element {
  return (
    <LoadingScreenFrame
      variant="default"
      tagline={props.tagline ?? 'A Journey. A Choice. A Life.'}
      title={props.title ?? 'WALK IN THE EIGHT'}
      subtitle={props.subtitle ?? 'The veil draws back upon Britannia.'}
      quote={props.quote ?? null}
      cssVars={CSS_VARS}
    />
  );
}
