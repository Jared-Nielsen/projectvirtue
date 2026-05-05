// Marine variant — concept-art reference 8-1-LoadingScreenMarine.png.
//
// Palette: deep indigo sky, moonlit cobalt sea, distant lighthouse glow.
// Animation: slow horizontal drift on the haze layer to suggest tide and
// drifting clouds. Reduced-motion zeroes the drift but keeps the static art.

import type { JSX } from 'solid-js';
import { LoadingScreenFrame } from './LoadingScreenFrame';

const MARINE_ART = `
  url("data:image/svg+xml;utf8,${encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice">',
      // Distant moon glow
      '<radialGradient id="m" cx="78%" cy="22%" r="38%">',
      '<stop offset="0%" stop-color="#d6e3f5" stop-opacity="0.55"/>',
      '<stop offset="100%" stop-color="#0b1326" stop-opacity="0"/>',
      '</radialGradient>',
      '<rect width="800" height="600" fill="url(%23m)"/>',
      // Distant island silhouette
      '<path d="M260 330 Q360 260 460 320 Q540 360 540 330 L800 380 L800 600 L0 600 L0 380 Q120 360 260 330Z" fill="#0a1726" opacity="0.95"/>',
      // Lighthouse beam
      '<path d="M412 320 L408 250 L416 250 L418 320 Z" fill="#1c2a3f"/>',
      '<circle cx="412" cy="248" r="6" fill="#f4cc66" opacity="0.85"/>',
      // Tall ship silhouette
      '<g transform="translate(120,300)" fill="#070d1a">',
      '<path d="M0 80 L120 80 L100 110 L20 110 Z"/>',
      '<rect x="56" y="0" width="3" height="84"/>',
      '<path d="M30 12 L86 12 L74 56 L42 56 Z" fill="#1a2438" opacity="0.9"/>',
      '</g>',
      // Distant palms (right edge)
      '<g transform="translate(680,290)" fill="#040810">',
      '<rect x="10" y="20" width="4" height="100"/>',
      '<path d="M12 18 Q-8 -2 4 -10 Q14 4 12 18 Q34 -8 44 0 Q26 6 12 18Z"/>',
      '</g>',
      '</svg>',
    ].join(''),
  )}")
`;

const HAZE = `
  radial-gradient(ellipse at 30% 60%, rgba(126, 192, 246, 0.18), transparent 60%),
  radial-gradient(ellipse at 70% 70%, rgba(74, 160, 232, 0.14), transparent 65%)
`;

const CSS_VARS: Readonly<Record<string, string>> = {
  '--bg-top': '#0a1530',
  '--bg-mid': '#0e2244',
  '--bg-bottom': '#040a18',
  '--bg-glow': 'rgba(126, 192, 246, 0.18)',
  '--bg-art': MARINE_ART.trim(),
  '--bg-art-pos': 'center bottom',
  '--bg-art-size': 'cover',
  '--bg-art-opacity': '0.95',
  '--bg-fx': HAZE,
  '--bg-fx-blend': 'screen',
  '--bg-fx-opacity': '0.7',
  '--bg-fx-anim': 'shimmer 14s ease-in-out infinite alternate',
};

export interface LoadingScreenMarineProps {
  readonly tagline?: string;
  readonly quote?: { readonly text: string; readonly attribution: string } | null;
}

export function LoadingScreenMarine(props: LoadingScreenMarineProps): JSX.Element {
  return (
    <LoadingScreenFrame
      variant="marine"
      tagline={props.tagline ?? 'A Journey. A Choice. A Life.'}
      title="ACROSS THE BRITANNIAN MAIN"
      subtitle="By tide and tiller, the Vesper-bound make port at last."
      quote={props.quote ?? null}
      cssVars={CSS_VARS}
    />
  );
}
