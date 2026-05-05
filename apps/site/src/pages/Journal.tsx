import { type Component, For, Show, createMemo, createSignal } from 'solid-js';
import { JournalPostCard } from '../components/JournalPostCard';
import { NewsletterForm } from '../components/NewsletterForm';
import { type JournalPost, POSTS } from '../data/journal-posts';
import { useMeta } from '../lib/seo';

type Category = JournalPost['category'] | 'all';

const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dev-update', label: 'Dev Updates' },
  { value: 'lore', label: 'Lore' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'community', label: 'Community' },
];

export const Journal: Component = () => {
  useMeta({
    title: 'Journal',
    description:
      'Stories, dev diaries, and deeper looks into the world of Project Virtue. Follow our journey as we build a world worth getting lost in.',
    path: '/journal',
  });

  const [category, setCategory] = createSignal<Category>('all');
  const visible = createMemo(() => {
    const c = category();
    return c === 'all' ? POSTS : POSTS.filter((p) => p.category === c);
  });
  const featured = createMemo(() => POSTS[0]);
  const others = createMemo(() => visible().filter((p) => p.slug !== featured()?.slug));

  return (
    <>
      <section class="journal-hero" aria-labelledby="journal-title">
        <div class="container">
          <h1 id="journal-title">Journal</h1>
          <p class="lede">
            Stories, dev diaries, and deeper looks into the world of Project Virtue. Follow our
            journey as we build a world worth getting lost in — and a community worth growing up in.
          </p>
        </div>
      </section>

      <section class="section" aria-label="Posts">
        <div class="container journal-layout">
          <div class="journal-main">
            <div class="journal-tabs" role="tablist" aria-label="Filter posts">
              <For each={CATEGORIES}>
                {(cat) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={category() === cat.value}
                    classList={{ 'is-active': category() === cat.value }}
                    onClick={() => setCategory(cat.value)}
                  >
                    {cat.label}
                  </button>
                )}
              </For>
            </div>

            <Show when={category() === 'all' ? featured() : undefined}>
              {(post) => <JournalPostCard post={post()} featured />}
            </Show>

            <div class="journal-grid">
              <For each={others()}>{(p) => <JournalPostCard post={p} />}</For>
            </div>
          </div>

          <aside class="journal-side" aria-label="Journal sidebar">
            <div class="surface journal-side__block">
              <h2>Stay Updated</h2>
              <p>Get journals and behind-the-scenes content delivered every other week.</p>
              <NewsletterForm variant="stacked" />
            </div>
            <div class="surface journal-side__block">
              <h2>Featured Post</h2>
              {featured() && (
                <article class="journal-side__featured">
                  <h3>{featured()?.title}</h3>
                  <p>{featured()?.excerpt}</p>
                  <a href={`/journal/${featured()?.slug ?? ''}`}>Read more →</a>
                </article>
              )}
            </div>
          </aside>
        </div>
      </section>

      <style>{`
        .journal-hero { padding: 64px 0 32px; }
        .journal-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 32px;
        }
        @media (max-width: 880px) {
          .journal-layout { grid-template-columns: 1fr; }
        }
        .journal-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .journal-tabs button {
          background: transparent;
          border: 1px solid rgba(207, 150, 47, 0.25);
          color: var(--br-parchment-200);
          padding: 8px 14px;
          font-family: var(--br-font-ui);
          font-size: 0.8125rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 2px;
        }
        .journal-tabs button:hover { border-color: rgba(207, 150, 47, 0.5); color: var(--br-sigil-200); }
        .journal-tabs button.is-active {
          background: var(--br-sigil-500);
          color: var(--br-ink-900);
          border-color: var(--br-sigil-400);
        }
        .journal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 24px;
        }
        .journal-side__block {
          margin-bottom: 16px;
        }
        .journal-side__block h2 { font-size: 1rem; margin: 0 0 8px; }
        .journal-side__block p {
          font-size: 0.875rem;
          color: var(--br-parchment-200);
          margin-bottom: 12px;
        }
        .journal-side__featured h3 { font-size: 0.9375rem; margin: 0 0 6px; }
        .journal-side__featured p { font-size: 0.8125rem; }
      `}</style>
    </>
  );
};
