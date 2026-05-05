// Paladin-castle variant — concept-art reference 8-4-LoadingScreenPaladinCastle.png.
//
// Palette: bright sky, stone gold, cobalt heraldic banners. Animation: a
// gentle drift on the cloud layer plus a soft sigil pulse. Reduced-motion
// holds a static frame.

import type { JSX } from 'solid-js';
import { LoadingScreenFrame } from './LoadingScreenFrame';

const CASTLE_ART = `
  url("data:image/svg+xml;utf8,${encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice">',
      // Sky glow
      '<radialGradient id="sun" cx="78%" cy="22%" r="52%">',
      '<stop offset="0%" stop-color="#fff5d2" stop-opacity="0.85"/>',
      '<stop offset="100%" stop-color="#a3c0e0" stop-opacity="0"/>',
      '</radialGradient>',
      '<rect width="800" height="600" fill="url(%23sun)"/>',
      // Distant peaks
      '<polygon points="0,360 220,200 360,330 540,210 700,320 800,260 800,420 0,420" fill="#dcd2b8" opacity="0.6"/>',
      // Castle silhouette (centre)
      '<g fill="#ddd0a6">',
      '<polygon points="280,420 520,420 520,260 470,260 470,210 460,210 460,180 440,180 440,210 430,210 430,260 380,260 380,200 370,200 370,170 350,170 350,200 340,200 340,260 280,260"/>',
      '<polygon points="380,260 470,260 460,200 390,200" fill="#a08c4f"/>',
      '<polygon points="350,200 380,200 365,150" fill="#8b6c2c"/>',
      '<polygon points="430,210 470,210 450,160" fill="#8b6c2c"/>',
      '</g>',
      // Bridge & walls
      '<rect x="240" y="420" width="320" height="40" fill="#cdbf99"/>',
      '<rect x="280" y="430" width="240" height="6" fill="#a08c4f" opacity="0.6"/>',
      // Banners
      '<g fill="#1d4264">',
      '<rect x="100" y="200" width="44" height="180"/>',
      '<polygon points="100,380 144,380 122,410"/>',
      '<rect x="656" y="200" width="44" height="180"/>',
      '<polygon points="656,380 700,380 678,410"/>',
      '</g>',
      // Cross-of-virtue on each banner
      '<g fill="#f4cc66">',
      '<rect x="118" y="240" width="8" height="60"/>',
      '<rect x="100" y="262" width="44" height="8"/>',
      '<rect x="674" y="240" width="8" height="60"/>',
      '<rect x="656" y="262" width="44" height="8"/>',
      '</g>',
      // Statue plinths
      '<rect x="80" y="430" width="80" height="60" fill="#cdbf99"/>',
      '<rect x="640" y="430" width="80" height="60" fill="#cdbf99"/>',
      '</svg>',
    ].join(''),
  )}")
`;

const CLOUDS = `
  radial-gradient(ellipse at 20% 25%, rgba(255, 250, 230, 0.35), transparent 45%),
  radial-gradient(ellipse at 70% 18%, rgba(255, 245, 215, 0.28), transparent 40%),
  radial-gradient(ellipse at 50% 60%, rgba(244, 204, 102, 0.12), transparent 60%)
`;

const CSS_VARS: Readonly<Record<string, string>> = {
  '--bg-top': '#7fa6cf',
  '--bg-mid': '#b6c8de',
  '--bg-bottom': '#5b6c84',
  '--bg-glow': 'rgba(255, 245, 215, 0.45)',
  '--bg-art': CASTLE_ART.trim(),
  '--bg-art-pos': 'center bottom',
  '--bg-art-size': 'cover',
  '--bg-art-opacity': '1',
  '--bg-fx': CLOUDS,
  '--bg-fx-blend': 'screen',
  '--bg-fx-opacity': '0.6',
  '--bg-fx-anim': 'drift 32s linear infinite alternate',
};

export interface LoadingScreenPaladinCastleProps {
  readonly tagline?: string;
  readonly quote?: { readonly text: string; readonly attribution: string } | null;
}

export function LoadingScreenPaladinCastle(props: LoadingScreenPaladinCastleProps): JSX.Element {
  return (
    <LoadingScreenFrame
      variant="paladin-castle"
      tagline={props.tagline ?? 'A Journey. A Choice. A Life.'}
      title="ENTERING THE CASTLE"
      subtitle="Here, faith is thy strength, and Virtue thy guide."
      quote={props.quote ?? null}
      cssVars={CSS_VARS}
    />
  );
}
