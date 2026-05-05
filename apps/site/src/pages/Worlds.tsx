import { A } from '@solidjs/router';
import { type Component, For, createMemo } from 'solid-js';
import { NewsletterForm } from '../components/NewsletterForm';
import { ShardCard } from '../components/ShardCard';
import { loadShardStatus, loadShards, shardStatusFor } from '../lib/mock-client';
import { useMeta } from '../lib/seo';

export const Worlds: Component = () => {
  useMeta({
    title: 'Worlds',
    description:
      'Countless worlds. Countless stories. Step into a world that calls to you and become part of its legend.',
    path: '/worlds',
  });

  const shards = createMemo(() => loadShards());
  const status = createMemo(() => loadShardStatus());

  return (
    <>
      <section class="worlds-hero" aria-labelledby="worlds-title">
        <div class="container worlds-hero__inner">
          <h1 id="worlds-title">Worlds</h1>
          <p class="lede">
            Countless worlds. Countless stories. Step into a world that calls to you and become part
            of its legend.
          </p>
          <p>
            <A href="/worlds/map" class="cta cta--ghost">
              View interactive map →
            </A>
          </p>
        </div>
      </section>

      <section class="section" aria-label="Shard list">
        <div class="container worlds-grid">
          <For each={shards()}>
            {(shard) => <ShardCard shard={shard} status={shardStatusFor(shard.id, status())} />}
          </For>
        </div>
      </section>

      <section class="section worlds-newsletter" aria-labelledby="worlds-newsletter-title">
        <div class="container">
          <div class="surface worlds-newsletter__inner">
            <h2 id="worlds-newsletter-title">A new world is opening soon</h2>
            <p>
              Be the first to know when the next shard goes live. Subscribe and we'll send a single
              notification — no marketing fluff.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      <style>{`
        .worlds-hero {
          padding: 64px 0 32px;
        }
        .worlds-hero__inner { max-width: 760px; }
        .worlds-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 880px) {
          .worlds-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .worlds-newsletter__inner {
          text-align: center;
          padding: 32px;
        }
        .worlds-newsletter__inner h2 { text-align: center; }
        .worlds-newsletter__inner p {
          color: var(--br-parchment-200);
          margin-bottom: 24px;
          max-width: 56ch;
          margin-left: auto;
          margin-right: auto;
        }
        .worlds-newsletter__inner form { margin: 0 auto; }
      `}</style>
    </>
  );
};
