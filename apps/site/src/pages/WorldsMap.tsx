import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import { WorldMap } from '../components/WorldMap';
import { useMeta } from '../lib/seo';

export const WorldsMap: Component = () => {
  useMeta({
    title: 'World Map',
    description:
      'Explore Sosaria — interactive map of cities, dungeons, and wilderness regions across the realm.',
    path: '/worlds/map',
  });

  return (
    <>
      <section class="worlds-hero" aria-labelledby="map-title">
        <div class="container">
          <h1 id="map-title">The Map of Sosaria</h1>
          <p class="lede">
            Explore the realm. Click any region for its lore. Wheel-zoom or pinch to study a feature
            in detail.
          </p>
          <p>
            <A href="/worlds" class="cta cta--ghost">
              ← Back to shards
            </A>
          </p>
        </div>
      </section>
      <section class="section" aria-label="Interactive map">
        <div class="container">
          <WorldMap />
        </div>
      </section>
      <style>{`
        .worlds-hero { padding: 48px 0 16px; }
      `}</style>
    </>
  );
};
