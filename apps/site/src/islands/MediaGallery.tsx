// Media gallery with kind filter + lightbox. Hydrated client:visible from
// /media.astro. Shipped at runtime because the filter pills and the lightbox
// modal need DOM interactivity; the SSR'd HTML below it includes the full
// gallery so non-JS crawlers still see every image and caption.

import { type Component, For, Show, createMemo, createSignal } from 'solid-js';
import { MEDIA, MEDIA_KINDS, type MediaItem } from '../data/media';

const KIND_BADGE: Record<MediaItem['kind'], string> = {
  screenshot: 'Screenshot',
  video: 'Video',
  artwork: 'Artwork',
  concept: 'Concept',
};

const MediaGallery: Component = () => {
  const [filter, setFilter] = createSignal<(typeof MEDIA_KINDS)[number]['value']>('all');
  const [active, setActive] = createSignal<MediaItem | null>(null);

  const featured = createMemo(() => MEDIA.find((m) => m.featured));
  const visible = createMemo(() => {
    const f = filter();
    return MEDIA.filter((m) => !m.featured && (f === 'all' || m.kind === f));
  });

  return (
    <>
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
          <a href="/join" class="cta cta--primary">
            Wishlist now
          </a>
        </div>
        <div class="surface media-side__cta">
          <h3>Press Kit</h3>
          <p>Logos, screenshots, fact sheet (PDF, 12 MB).</p>
          <a href="/press-kit.pdf" class="cta cta--ghost" download="press-kit.pdf">
            Download press kit
          </a>
          <p class="media-side__contact">
            Press inquiries: <a href="mailto:press@virtu3.com">press@virtu3.com</a>
          </p>
        </div>
      </aside>

      <div class="media-grid-wrap">
        <Show when={filter() === 'all' ? featured() : undefined}>
          {(f) => (
            <button
              type="button"
              class="media-item media-item--featured"
              onClick={() => setActive(f())}
              aria-label={`${KIND_BADGE[f().kind]}: ${f().title}`}
            >
              <div class="media-item__frame">
                <img
                  src={f().src}
                  alt={f().alt}
                  loading="lazy"
                  decoding="async"
                  width={1200}
                  height={600}
                />
                <span class="media-item__badge">{KIND_BADGE[f().kind]}</span>
              </div>
              <h3 class="media-item__title">{f().title}</h3>
              <p class="media-item__caption">{f().caption}</p>
            </button>
          )}
        </Show>
        <div class="media-grid">
          <For each={visible()}>
            {(m) => (
              <button
                type="button"
                class="media-item"
                onClick={() => setActive(m)}
                aria-label={`${KIND_BADGE[m.kind]}: ${m.title}`}
              >
                <div class="media-item__frame">
                  <img
                    src={m.src}
                    alt={m.alt}
                    loading="lazy"
                    decoding="async"
                    width={600}
                    height={400}
                  />
                  {m.kind === 'video' && (
                    <span class="media-item__play" aria-hidden="true">
                      ▶
                    </span>
                  )}
                  <span class="media-item__badge">{KIND_BADGE[m.kind]}</span>
                </div>
                <h3 class="media-item__title">{m.title}</h3>
                <p class="media-item__caption">{m.caption}</p>
              </button>
            )}
          </For>
        </div>
      </div>

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

      <style>{MEDIA_GALLERY_CSS}</style>
    </>
  );
};

export default MediaGallery;

const MEDIA_GALLERY_CSS = `
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

.media-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  text-align: left;
  background: transparent;
  border: 1px solid rgba(207, 150, 47, 0.15);
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  color: inherit;
  transition: transform 200ms, border-color 200ms;
}
.media-item:hover, .media-item:focus-visible {
  border-color: rgba(207, 150, 47, 0.4);
  transform: translateY(-2px);
}
.media-item__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  background: linear-gradient(135deg, rgba(20, 17, 12, 1), rgba(8, 7, 5, 1));
  overflow: hidden;
}
.media-item__frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 400ms;
}
.media-item:hover .media-item__frame img { transform: scale(1.04); }
.media-item__badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(8, 7, 5, 0.75);
  color: var(--br-sigil-200);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 4px 8px;
  border: 1px solid rgba(207, 150, 47, 0.4);
  border-radius: 2px;
}
.media-item__play {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: var(--br-sigil-200);
  pointer-events: none;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}
.media-item__title {
  margin: 12px 16px 0;
  font-size: 1rem;
  color: var(--br-parchment-50);
}
.media-item__caption {
  margin: 4px 16px 16px;
  font-size: 0.8125rem;
  color: var(--br-parchment-200);
}
.media-item--featured { grid-column: 1 / -1; }
.media-item--featured .media-item__frame { aspect-ratio: 2 / 1; }
@media (min-width: 880px) {
  .media-item--featured { grid-column: span 2; }
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
`;
