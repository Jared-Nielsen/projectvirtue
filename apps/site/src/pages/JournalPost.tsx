import { A, useParams } from '@solidjs/router';
import { type Component, For, Show, createEffect, createMemo } from 'solid-js';
import { isServer } from 'solid-js/web';
import { getPost } from '../data/journal-posts';

export const JournalPost: Component = () => {
  const params = useParams<{ slug: string }>();
  const post = createMemo(() => getPost(params.slug));

  // Reactive meta application — re-runs on slug change.
  if (!isServer) {
    createEffect(() => {
      const p = post();
      const title = p ? `${p.title} — Project Virtue` : 'Post not found — Project Virtue';
      const description = p ? p.excerpt : 'The journal entry you requested is not available.';
      if (typeof document !== 'undefined') {
        document.title = title;
        const desc = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (desc) desc.setAttribute('content', description);
      }
    });
  }

  return (
    <>
      <Show
        when={post()}
        fallback={
          <section class="section">
            <div class="container surface" style={{ 'text-align': 'center' }}>
              <h1>Post not found</h1>
              <p>The entry you requested is not on the shelf.</p>
              <A href="/journal" class="cta cta--ghost">
                Back to Journal
              </A>
            </div>
          </section>
        }
      >
        {(p) => (
          <article class="journal-post">
            <header class="journal-post__hero">
              <div class="container">
                <p>
                  <A href="/journal">← Journal</A>
                </p>
                <p class="eyebrow journal-post__category">{p().category.replace('-', ' ')}</p>
                <h1>{p().title}</h1>
                <p class="journal-post__meta">
                  <time dateTime={p().date}>
                    {new Date(p().date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>By {p().author}</span>
                </p>
              </div>
            </header>
            <div class="container">
              <div class="surface journal-post__body">
                <p class="lede journal-post__excerpt">{p().excerpt}</p>
                <For each={p().body}>{(paragraph) => <p>{paragraph}</p>}</For>
                <p class="journal-post__tags">
                  Tags:{' '}
                  {p()
                    .tags.map((t) => `#${t}`)
                    .join(' ')}
                </p>
              </div>
            </div>
          </article>
        )}
      </Show>

      <style>{`
        .journal-post__hero {
          padding: 56px 0 24px;
          background: radial-gradient(ellipse at 50% 0%, rgba(207, 150, 47, 0.08) 0%, transparent 60%);
        }
        .journal-post__category { color: var(--br-sigil-400); }
        .journal-post__meta {
          color: var(--br-parchment-300);
          font-size: 0.875rem;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .journal-post__body {
          max-width: 720px;
          margin: 0 auto;
          padding: 32px;
        }
        .journal-post__excerpt {
          color: var(--br-parchment-100);
          margin-bottom: 24px;
          padding-left: 14px;
          border-left: 2px solid var(--br-sigil-500);
        }
        .journal-post__tags {
          color: var(--br-parchment-300);
          font-size: 0.875rem;
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid rgba(207, 150, 47, 0.18);
        }
      `}</style>
    </>
  );
};
