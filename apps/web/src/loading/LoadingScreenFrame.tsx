// Shared visual frame for every loading-screen variant. Each variant supplies
// background custom-properties (`--bg-*`) via inline `style` so the same
// skeleton renders four distinct moods. Reduced-motion is honoured via the
// stylesheet (animations collapse to 0s) — no JS branching required.

import { type JSX, Show, splitProps } from 'solid-js';
import styles from './LoadingScreen.module.css';

export interface LoadingScreenFrameProps {
  /** Variant slug used as the data attribute hook. */
  readonly variant: string;
  /** Hero-line above the title (e.g. "By tide and by tiller"). */
  readonly tagline?: string;
  /** Big headline ("ENTERING THE DEPTHS"). */
  readonly title: string;
  /** Optional secondary line under the title (lore intro). */
  readonly subtitle?: string;
  /** The lore quote rotated in by the parent. */
  readonly quote?: { readonly text: string; readonly attribution: string } | null;
  /** Inline CSS custom properties — one per --bg-* hook. */
  readonly cssVars: Readonly<Record<string, string>>;
  /** Optional extra DOM under the bottom progress bar. */
  readonly children?: JSX.Element;
}

export function LoadingScreenFrame(props: LoadingScreenFrameProps): JSX.Element {
  const [own] = splitProps(props, [
    'variant',
    'tagline',
    'title',
    'subtitle',
    'quote',
    'cssVars',
    'children',
  ]);

  return (
    <section
      class={styles.frame}
      data-loading-variant={own.variant}
      style={own.cssVars}
      aria-live="polite"
      aria-busy="true"
      aria-label={`Loading — ${own.title}`}
    >
      <div class={styles.scrim} aria-hidden="true" />

      <div class={styles.banner}>
        <svg
          class={`${styles.sigil} ${styles.sigilPulse}`}
          viewBox="0 0 64 64"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Project Virtue sigil</title>
          <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path
            d="M32 8 V56 M8 32 H56 M16 16 L48 48 M48 16 L16 48"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
          />
          <circle cx="32" cy="32" r="6" fill="currentColor" />
        </svg>
        <Show when={own.tagline}>
          <p class={styles.tagline}>{own.tagline}</p>
        </Show>
        <h1 class={styles.title}>{own.title}</h1>
        <Show when={own.subtitle}>
          <p class={styles.subtitle}>{own.subtitle}</p>
        </Show>
      </div>

      <div class={styles.bottom}>
        <Show when={own.quote}>
          {(q) => (
            <blockquote class={styles.quote}>
              <span>&ldquo;{q().text}&rdquo;</span>
              <footer class={styles.attribution}>— {q().attribution}</footer>
            </blockquote>
          )}
        </Show>
        <div class={styles.bar} aria-hidden="true">
          <div class={styles.barFill} />
        </div>
        <span class={styles.loadingLabel}>Loading…</span>
        {own.children}
      </div>
    </section>
  );
}
