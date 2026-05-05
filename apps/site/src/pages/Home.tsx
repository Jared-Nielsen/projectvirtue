import { A } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import { FeatureCard } from '../components/FeatureCard';
import { NewsletterForm } from '../components/NewsletterForm';
import { FEATURES } from '../data/features';
import { useMeta } from '../lib/seo';

export const Home: Component = () => {
  useMeta({
    title: 'A Journey, A Choice, A Life',
    description:
      'Project Virtue is a spiritual successor to the classic era of open-world RPGs — every choice shapes your character, every action has consequence, and virtue is the truest path to power.',
    path: '/',
  });

  return (
    <>
      {/* HERO */}
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__bg" aria-hidden="true" />
        <div class="container hero__inner">
          <p class="eyebrow hero__eyebrow">A spiritual successor</p>
          <h1 id="hero-title" class="hero__title">
            <span class="hero__title-pre">Project</span>
            <span class="hero__title-main">Virtue</span>
          </h1>
          <p class="hero__tagline">A journey. A choice. A life.</p>
          <p class="lede hero__lede">
            Project Virtue is a spiritual successor to the classic era of open-world RPGs — every
            choice shapes your character, every action has consequence, and virtue is the truest
            path to power.
          </p>
          <div class="hero__cta-row">
            <A href="/join" class="cta cta--primary">
              Wishlist on Steam
            </A>
            <A href="/features" class="cta cta--ghost">
              Learn more
            </A>
          </div>
        </div>
      </section>

      {/* TRAILER */}
      <section class="section" aria-labelledby="trailer-title">
        <div class="container">
          <div class="trailer">
            <div class="trailer__copy">
              <h2 id="trailer-title">
                Live virtuously.
                <br />
                Change the world.
              </h2>
              <p>
                Explore a living world filled with people who think, feel, remember, and react to
                who you are and what you do. Your character is not defined by a class, but by your
                actions. Will you seek power, wealth, or fame? Or will you walk the path of virtue?
              </p>
              <A href="/about" class="cta cta--ghost">
                Learn more
              </A>
            </div>
            <div class="trailer__media" role="img" aria-label="In-game world preview placeholder">
              <div class="trailer__placeholder">
                <span class="eyebrow">Trailer coming soon</span>
                <p>The first cinematic lands with the closed beta.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section class="section" aria-labelledby="features-title">
        <div class="container">
          <p class="eyebrow section-subtitle" style={{ 'margin-bottom': '8px' }}>
            What awaits
          </p>
          <h2 id="features-title" class="section-title">
            A living world, shaped by choice
          </h2>
          <div class="home-features-grid">
            <For each={FEATURES.slice(0, 6)}>
              {(f) => <FeatureCard feature={f} layout="compact" />}
            </For>
          </div>
        </div>
      </section>

      {/* JOIN STRIP */}
      <section class="section join-strip" aria-labelledby="join-strip-title">
        <div class="container join-strip__inner">
          <h2 id="join-strip-title" class="join-strip__title">
            Join the journey
          </h2>
          <p class="join-strip__copy">
            Get journals, dev notes, and be the first to know when Project Virtue launches.
          </p>
          <NewsletterForm />
        </div>
      </section>

      <style>{HOME_CSS}</style>
    </>
  );
};

const HOME_CSS = `
.hero {
  position: relative;
  overflow: hidden;
  padding: 80px 0 96px;
  isolation: isolate;
}
.hero__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse at 75% 40%, rgba(207, 150, 47, 0.12) 0%, transparent 60%),
    linear-gradient(180deg, rgba(7, 8, 9, 0.4) 0%, rgba(2, 2, 3, 0.95) 100%),
    url('/hero-vista.svg') center/cover no-repeat;
}
.hero__inner {
  text-align: left;
  max-width: 720px;
}
.hero__eyebrow {
  margin-bottom: 12px;
  display: inline-block;
}
.hero__title {
  display: flex;
  flex-direction: column;
  font-family: var(--br-font-display);
  margin: 0 0 16px;
  line-height: 0.95;
}
.hero__title-pre {
  font-size: 1.25rem;
  letter-spacing: 0.32em;
  color: var(--br-sigil-400);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.hero__title-main {
  font-size: clamp(3rem, 9vw, 6.5rem);
  letter-spacing: 0.06em;
  color: var(--br-sigil-200);
  text-transform: uppercase;
  font-weight: 700;
  text-shadow: 0 4px 18px rgba(207, 150, 47, 0.25);
}
.hero__tagline {
  font-family: var(--br-font-heading);
  font-size: clamp(1rem, 2vw, 1.25rem);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--br-parchment-200);
  margin: 0 0 24px;
}
.hero__lede {
  margin-bottom: 32px;
}
.hero__cta-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  font-family: var(--br-font-ui);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  border-radius: 2px;
  text-decoration: none;
  transition: background 200ms, color 200ms, border-color 200ms;
}
.cta--primary {
  background: var(--br-sigil-500);
  color: var(--br-ink-900);
  border: 1px solid var(--br-sigil-400);
}
.cta--primary:hover, .cta--primary:focus-visible {
  background: var(--br-sigil-400);
  color: var(--br-ink-900);
  text-decoration: none;
}
.cta--ghost {
  background: transparent;
  color: var(--br-sigil-200);
  border: 1px solid var(--br-sigil-500);
}
.cta--ghost:hover, .cta--ghost:focus-visible {
  background: rgba(207, 150, 47, 0.12);
  color: var(--br-sigil-100);
  border-color: var(--br-sigil-400);
  text-decoration: none;
}

.trailer {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 40px;
  align-items: center;
}
@media (max-width: 880px) {
  .trailer { grid-template-columns: 1fr; }
}
.trailer__copy h2 {
  text-align: left;
}
.trailer__media {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, rgba(20, 17, 12, 1), rgba(2, 2, 3, 1));
  border: 1px solid rgba(207, 150, 47, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.trailer__media::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 60% 40%, rgba(207, 150, 47, 0.18), transparent 60%);
}
.trailer__placeholder {
  text-align: center;
  color: var(--br-parchment-200);
  position: relative;
  z-index: 1;
}
.trailer__placeholder p {
  margin-top: 4px;
  font-size: 0.875rem;
}

.home-features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.join-strip {
  background: linear-gradient(180deg, rgba(20, 17, 12, 0.5) 0%, rgba(7, 8, 9, 0.92) 100%);
  border-top: 1px solid rgba(207, 150, 47, 0.18);
  border-bottom: 1px solid rgba(207, 150, 47, 0.18);
}
.join-strip__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}
.join-strip__title { margin: 0; }
.join-strip__copy {
  color: var(--br-parchment-200);
  margin-bottom: 16px;
}
`;
