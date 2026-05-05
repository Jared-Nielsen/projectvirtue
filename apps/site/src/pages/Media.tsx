import { A } from '@solidjs/router';
import { type Component, For, Show, createMemo, createSignal } from 'solid-js';
import { MediaGalleryItem } from '../components/MediaGalleryItem';
import { MEDIA, MEDIA_KINDS, type MediaItem } from '../data/media';
import { useMeta } from '../lib/seo';

export const Media: Component = () => {
  useMeta({
    title: 'Media',
    description:
      'Screenshots, videos, and artwork from the world of Project Virtue. Press kit available on request.',
    path: '/media',
  });

  const [filter, setFilter] = createSignal<(typeof MEDIA_KINDS)[number]['value']>('all');
  const [active, setActive] = createSignal<MediaItem | null>(null);

  const featured = createMemo(() => MEDIA.find((m) => m.featured));
  const visible = createMemo(() => {
    const f = filter();
    return MEDIA.filter((m) => !m.featured && (f === 'all' || m.kind === f));
  });

  return (
    <>
      <section class="media-hero">
        <div class="container media-hero__inner">
          <h1>Media</h1>
          <p class="lede">Screenshots, videos, and artwork from the world of Project Virtue.</p>
        </div>
      </section>

      <section class="section" aria-label="Media gallery">
        <div class="container media-layout">
          <aside class="media-side" aria-label="Filters">
            <h2 class="media-side__title">Browse</h2>
            <ul class="media-side__list">
              <For each={MEDIA_KINDS}>
                {(k) => (
                  <li>
                    <button
                      type="button"
                      classList={{ 'is-active': filter() === k.value }}
                      onClick={() => setFilter(k.value)}
                    >
                      {k.label}
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <div class="surface media-side__cta">
              <h3>Wishlist on Steam</h3>
              <p>Help shape the world of Project Virtue.</p>
              <A href="/join" class="cta cta--primary">
                Wishlist now
              </A>
            </div>
            <div class="surface media-side__cta">
              <h3>Press Kit</h3>
              <p>Logos, screenshots, fact sheet (PDF, 12 MB).</p>
              <a href="/press-kit.pdf" class="cta cta--ghost" download="press-kit.pdf">
                Download press kit
              </a>
              <p class="media-side__contact">
                Press inquiries:{' '}
                <a href="mailto:press@projectvirtue.example">press@projectvirtue.example</a>
              </p>
            </div>
          </aside>

          <div class="media-grid-wrap">
            <Show when={filter() === 'all' ? featured() : undefined}>
              {(f) => <MediaGalleryItem item={f()} featured onSelect={setActive} />}
            </Show>
            <div class="media-grid">
              <For each={visible()}>
                {(m) => <MediaGalleryItem item={m} onSelect={setActive} />}
              </For>
            </div>
          </div>
        </div>
      </section>

      <Show when={active()}>
        {(m) => (
          <div
            class="media-lightbox"
            // biome-ignore lint/a11y/useSemanticElements: <dialog> requires imperative showModal()
            role="dialog"
            aria-modal="true"
            aria-label={m().title}
          >
            <button
              type="button"
              class="media-lightbox__close"
              aria-label="Close"
              onClick={() => setActive(null)}
            >
              ×
            </button>
            <figure class="media-lightbox__figure">
              <img src={m().src} alt={m().alt} />
              <figcaption>
                <strong>{m().title}</strong> — {m().caption}
              </figcaption>
            </figure>
          </div>
        )}
      </Show>

      <style>{`
        .media-hero { padding: 56px 0 24px; }
        .media-hero__inner { max-width: 760px; }
        .media-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
        }
        @media (max-width: 880px) { .media-layout { grid-template-columns: 1fr; } }
        .media-side__title {
          font-size: 0.75rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--br-sigil-400);
          margin: 0 0 12px;
        }
        .media-side__list {
          list-style: none;
          margin: 0 0 24px;
          padding: 0;
        }
        .media-side__list button {
          width: 100%;
          background: transparent;
          border: 1px solid rgba(207, 150, 47, 0.18);
          color: var(--br-parchment-100);
          padding: 10px 14px;
          margin-bottom: 6px;
          font-family: var(--br-font-body);
          font-size: 0.9375rem;
          cursor: pointer;
          border-radius: 2px;
          text-align: left;
        }
        .media-side__list button:hover { border-color: rgba(207, 150, 47, 0.4); color: var(--br-sigil-200); }
        .media-side__list button.is-active {
          background: rgba(207, 150, 47, 0.12);
          border-color: var(--br-sigil-500);
          color: var(--br-sigil-100);
        }
        .media-side__cta {
          margin-bottom: 16px;
          text-align: center;
          padding: 20px;
        }
        .media-side__cta h3 { font-size: 1rem; margin: 0 0 8px; }
        .media-side__cta p { font-size: 0.875rem; color: var(--br-parchment-200); margin: 0 0 12px; }
        .media-side__cta .cta { width: 100%; justify-content: center; }
        .media-side__contact { margin-top: 8px; font-size: 0.75rem; }
        .media-grid-wrap { display: flex; flex-direction: column; gap: 16px; }
        .media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .media-lightbox {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(2, 2, 3, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .media-lightbox__close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid rgba(207, 150, 47, 0.4);
          color: var(--br-sigil-200);
          font-size: 1.5rem;
          cursor: pointer;
          border-radius: 2px;
        }
        .media-lightbox__figure {
          max-width: 1000px;
          width: 100%;
          margin: 0;
        }
        .media-lightbox__figure img {
          width: 100%;
          height: auto;
          border: 1px solid rgba(207, 150, 47, 0.4);
        }
        .media-lightbox__figure figcaption {
          margin-top: 12px;
          color: var(--br-parchment-100);
          text-align: center;
        }
      `}</style>
    </>
  );
};
