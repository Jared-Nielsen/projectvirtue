// Dungeon variant — concept-art reference 8-2-LoadingScreenDungeon.png.
//
// Palette: near-black stone, oily wet floor, twin sconce torches in warm
// amber. Animation: torch flicker on the FX layer; reduced-motion holds a
// static glow. The faint cell-door silhouette at the vanishing point comes
// from the SVG art string.

import type { JSX } from 'solid-js';
import { LoadingScreenFrame } from './LoadingScreenFrame';

const DUNGEON_ART = `
  url("data:image/svg+xml;utf8,${encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice">',
      // Vault perspective
      '<defs>',
      '<linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">',
      '<stop offset="0%" stop-color="#161819" stop-opacity="0.0"/>',
      '<stop offset="100%" stop-color="#080809" stop-opacity="1"/>',
      '</linearGradient>',
      '</defs>',
      // Side walls (trapezoidal masonry)
      '<polygon points="0,0 280,200 280,420 0,600" fill="#15171a"/>',
      '<polygon points="800,0 520,200 520,420 800,600" fill="#15171a"/>',
      '<polygon points="280,200 520,200 520,420 280,420" fill="#0a0c0e"/>',
      // Floor wash
      '<rect x="280" y="420" width="240" height="180" fill="url(%23floor)"/>',
      // Far cell door
      '<rect x="370" y="270" width="60" height="110" fill="#040506"/>',
      '<rect x="378" y="280" width="44" height="90" fill="none" stroke="#1d2024" stroke-width="2"/>',
      '<line x1="386" y1="280" x2="386" y2="370" stroke="#1d2024" stroke-width="1"/>',
      '<line x1="400" y1="280" x2="400" y2="370" stroke="#1d2024" stroke-width="1"/>',
      '<line x1="414" y1="280" x2="414" y2="370" stroke="#1d2024" stroke-width="1"/>',
      // Wet floor highlight
      '<ellipse cx="400" cy="540" rx="180" ry="22" fill="rgba(207, 150, 47, 0.12)"/>',
      '</svg>',
    ].join(''),
  )}")
`;

const TORCHES = `
  radial-gradient(circle at 8% 38%, rgba(244, 165, 60, 0.55), transparent 18%),
  radial-gradient(circle at 92% 38%, rgba(244, 165, 60, 0.55), transparent 18%),
  radial-gradient(circle at 50% 75%, rgba(207, 150, 47, 0.18), transparent 38%)
`;

const CSS_VARS: Readonly<Record<string, string>> = {
  '--bg-top': '#0a0a0c',
  '--bg-mid': '#0c0d0f',
  '--bg-bottom': '#020202',
  '--bg-glow': 'rgba(207, 150, 47, 0.16)',
  '--bg-art': DUNGEON_ART.trim(),
  '--bg-art-pos': 'center center',
  '--bg-art-size': 'cover',
  '--bg-art-opacity': '0.92',
  '--bg-fx': TORCHES,
  '--bg-fx-blend': 'screen',
  '--bg-fx-opacity': '0.85',
  '--bg-fx-anim': 'flicker 1.6s ease-in-out infinite',
};

export interface LoadingScreenDungeonProps {
  readonly tagline?: string;
  readonly quote?: { readonly text: string; readonly attribution: string } | null;
}

export function LoadingScreenDungeon(props: LoadingScreenDungeonProps): JSX.Element {
  return (
    <LoadingScreenFrame
      variant="dungeon"
      tagline={props.tagline ?? 'A Journey. A Choice. A Life.'}
      title="ENTERING THE DEPTHS"
      subtitle="Ancient evil stirs in the darkness below. Trust none but thy allies."
      quote={props.quote ?? null}
      cssVars={CSS_VARS}
    />
  );
}
