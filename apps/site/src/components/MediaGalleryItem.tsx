import type { Component } from 'solid-js';
import type { MediaItem } from '../data/media';

export interface MediaGalleryItemProps {
  readonly item: MediaItem;
  readonly featured?: boolean;
  readonly onSelect?: (item: MediaItem) => void;
}

const KIND_BADGE: Record<MediaItem['kind'], string> = {
  screenshot: 'Screenshot',
  video: 'Video',
  artwork: 'Artwork',
  concept: 'Concept',
};

export const MediaGalleryItem: Component<MediaGalleryItemProps> = (props) => {
  return (
    <button
      type="button"
      class={`media-item ${props.featured ? 'media-item--featured' : ''}`}
      onClick={() => props.onSelect?.(props.item)}
      aria-label={`${KIND_BADGE[props.item.kind]}: ${props.item.title}`}
    >
      <div class="media-item__frame">
        <img
          src={props.item.src}
          alt={props.item.alt}
          loading="lazy"
          decoding="async"
          width={props.featured ? 1200 : 600}
          height={props.featured ? 600 : 400}
        />
        {props.item.kind === 'video' && (
          <span class="media-item__play" aria-hidden="true">
            ▶
          </span>
        )}
        <span class="media-item__badge">{KIND_BADGE[props.item.kind]}</span>
      </div>
      <h3 class="media-item__title">{props.item.title}</h3>
      <p class="media-item__caption">{props.item.caption}</p>
      <style>{MEDIA_CSS}</style>
    </button>
  );
};

const MEDIA_CSS = `
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
.media-item:hover .media-item__frame img {
  transform: scale(1.04);
}
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
.media-item--featured {
  grid-column: 1 / -1;
}
.media-item--featured .media-item__frame {
  aspect-ratio: 2 / 1;
}
@media (min-width: 880px) {
  .media-item--featured {
    grid-column: span 2;
  }
}
`;
