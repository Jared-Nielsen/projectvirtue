import { A } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import { FeatureCard } from '../components/FeatureCard';
import { FEATURES } from '../data/features';
import { useMeta } from '../lib/seo';

export const Features: Component = () => {
  useMeta({
    title: 'Features',
    description:
      'Project Virtue blends classic RPG freedom with modern depth: a living world shaped by thousands of players like you.',
    path: '/features',
  });

  return (
    <>
      <section class="features-hero" aria-labelledby="features-title">
        <div class="container features-hero__inner">
          <h1 id="features-title">Features</h1>
          <p class="lede">
            Project Virtue blends classic RPG freedom with modern depth and a living world shaped by
            thousands of players like you.
          </p>
        </div>
      </section>

      <section class="section" aria-label="Feature pillars">
        <div class="container">
          <div class="features-grid">
            <For each={FEATURES}>{(f) => <FeatureCard feature={f} layout="detailed" />}</For>
          </div>
        </div>
      </section>

      <section class="section legacy" aria-labelledby="legacy-title">
        <div class="container legacy__inner">
          <h2 id="legacy-title">Freedom. Community. Legacy.</h2>
          <p>Your journey begins with a choice. What kind of legend will you become?</p>
          <A href="/join" class="cta cta--primary">
            Join the Journey
          </A>
        </div>
      </section>

      <style>{`
        .features-hero {
          padding: 64px 0 32px;
          text-align: center;
        }
        .features-hero h1 { text-align: center; }
        .features-hero__inner { max-width: 760px; margin: 0 auto; }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 20px;
        }
        @media (max-width: 720px) {
          .features-grid { grid-template-columns: 1fr; }
        }
        .legacy {
          text-align: center;
          background: radial-gradient(ellipse at 50% 50%, rgba(207, 150, 47, 0.08) 0%, transparent 60%);
        }
        .legacy h2 { text-align: center; }
        .legacy__inner { max-width: 640px; margin: 0 auto; }
      `}</style>
    </>
  );
};
