import type { Component, JSX } from 'solid-js';

export interface LogoProps {
  /** Pixel size for the sigil mark. The wordmark scales beside it. */
  size?: number;
  /** Render the wordmark next to the sigil. */
  withWordmark?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

/**
 * Inline SVG sigil for Project Virtue — a sword inside an arched gate,
 * matching the framed mark in /_conceptart/_Branding/logoProjectVirtue.png.
 * Inline so it ships in the SSR'd HTML with no extra request and no LCP hit.
 */
export const Logo: Component<LogoProps> = (props) => {
  const size = () => props.size ?? 40;
  return (
    <span
      class={`pv-logo ${props.class ?? ''}`}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '12px',
        ...props.style,
      }}
    >
      <svg width={size()} height={size() * 1.2} viewBox="0 0 50 60" aria-hidden="true">
        <title>Project Virtue sigil</title>
        <defs>
          <linearGradient id="pv-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f4cc66" />
            <stop offset="60%" stop-color="#cf962f" />
            <stop offset="100%" stop-color="#8a5d15" />
          </linearGradient>
        </defs>
        {/* Arched gate frame */}
        <path
          d="M25 2 C 12 2 4 10 4 24 L 4 56 L 46 56 L 46 24 C 46 10 38 2 25 2 Z"
          fill="rgba(8, 7, 5, 0.85)"
          stroke="url(#pv-gold)"
          stroke-width="2"
        />
        {/* Inner ring */}
        <circle cx="25" cy="30" r="14" fill="none" stroke="url(#pv-gold)" stroke-width="1.5" />
        {/* Sword */}
        <line x1="25" y1="14" x2="25" y2="46" stroke="url(#pv-gold)" stroke-width="2" />
        {/* Crossguard */}
        <line x1="18" y1="40" x2="32" y2="40" stroke="url(#pv-gold)" stroke-width="2" />
        {/* Pommel */}
        <circle cx="25" cy="14" r="2" fill="url(#pv-gold)" />
      </svg>
      {props.withWordmark !== false && (
        <span
          style={{
            display: 'inline-flex',
            'flex-direction': 'column',
            'line-height': '1',
          }}
        >
          <span
            style={{
              'font-family': 'var(--br-font-heading)',
              'font-size': '0.7rem',
              'letter-spacing': '0.32em',
              color: 'var(--br-sigil-400)',
              'text-transform': 'uppercase',
            }}
          >
            Project
          </span>
          <span
            style={{
              'font-family': 'var(--br-font-heading)',
              'font-size': '1.4rem',
              'letter-spacing': '0.16em',
              color: 'var(--br-sigil-200)',
              'text-transform': 'uppercase',
              'font-weight': 700,
            }}
          >
            Virtue
          </span>
        </span>
      )}
    </span>
  );
};
