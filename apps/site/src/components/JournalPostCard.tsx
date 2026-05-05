import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import type { JournalPost } from '../data/journal-posts';

export interface JournalPostCardProps {
  readonly post: JournalPost;
  readonly featured?: boolean;
}

const CATEGORY_LABEL: Record<JournalPost['category'], string> = {
  'dev-update': 'Dev Update',
  lore: 'Lore',
  tutorial: 'Tutorial',
  community: 'Community',
};

export const JournalPostCard: Component<JournalPostCardProps> = (props) => {
  const cls = (): string => {
    return `journal-card ${props.featured ? 'journal-card--featured' : ''}`;
  };
  const formattedDate = (): string => {
    try {
      return new Date(props.post.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return props.post.date;
    }
  };
  return (
    <article class={cls()}>
      <header class="journal-card__head">
        <span class="journal-card__category">{CATEGORY_LABEL[props.post.category]}</span>
        <time class="journal-card__date" dateTime={props.post.date}>
          {formattedDate()}
        </time>
      </header>
      <h3 class="journal-card__title">
        <A href={`/journal/${props.post.slug}`}>{props.post.title}</A>
      </h3>
      <p class="journal-card__excerpt">{props.post.excerpt}</p>
      <footer class="journal-card__foot">
        <span class="journal-card__author">By {props.post.author}</span>
        <A href={`/journal/${props.post.slug}`} class="journal-card__more">
          Read more →
        </A>
      </footer>
      <style>{JOURNAL_CSS}</style>
    </article>
  );
};

const JOURNAL_CSS = `
.journal-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(20, 17, 12, 0.7) 0%, rgba(8, 7, 5, 0.82) 100%);
  border: 1px solid rgba(207, 150, 47, 0.18);
  border-radius: 4px;
  height: 100%;
  transition: border-color 200ms;
}
.journal-card:hover { border-color: rgba(207, 150, 47, 0.4); }
.journal-card--featured {
  border-color: rgba(207, 150, 47, 0.5);
  background: linear-gradient(180deg, rgba(40, 30, 16, 0.7) 0%, rgba(8, 7, 5, 0.85) 100%);
}
.journal-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.journal-card__category {
  color: var(--br-sigil-300);
  font-weight: 700;
}
.journal-card__date { color: var(--br-parchment-300); }
.journal-card__title {
  margin: 4px 0 6px;
  font-size: 1.25rem;
  line-height: 1.25;
}
.journal-card__title a { color: var(--br-parchment-50); }
.journal-card__title a:hover { color: var(--br-sigil-200); text-decoration: none; }
.journal-card__excerpt {
  color: var(--br-parchment-100);
  font-size: 0.9375rem;
  margin: 0;
  flex: 1;
}
.journal-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(207, 150, 47, 0.12);
}
.journal-card__author { color: var(--br-parchment-300); }
.journal-card__more {
  color: var(--br-sigil-300);
  font-weight: 600;
  letter-spacing: 0.08em;
}
`;
