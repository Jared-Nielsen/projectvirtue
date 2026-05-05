// Category filter pills for the Journal index. Hydrated client:visible.
// The full post grid below is rendered server-side; this island only
// flips a CSS data-attribute on the wrapper to hide/show posts by
// category. Zero shipping of the post bodies, full SEO crawl of the
// static HTML grid.

import { type Component, For, createSignal, onMount } from 'solid-js';

type Category = 'all' | 'dev-update' | 'lore' | 'tutorial' | 'community';

const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dev-update', label: 'Dev Updates' },
  { value: 'lore', label: 'Lore' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'community', label: 'Community' },
];

const JournalFilter: Component = () => {
  const [category, setCategory] = createSignal<Category>('all');

  onMount(() => {
    applyFilter('all');
  });

  const applyFilter = (cat: Category): void => {
    setCategory(cat);
    const wrap = document.querySelector<HTMLElement>('[data-pv-journal-grid]');
    if (!wrap) return;
    wrap.dataset.filter = cat;
  };

  return (
    <div class="journal-tabs" role="tablist" aria-label="Filter posts">
      <For each={CATEGORIES}>
        {(cat) => (
          <button
            type="button"
            role="tab"
            aria-selected={category() === cat.value}
            classList={{ 'is-active': category() === cat.value }}
            onClick={() => applyFilter(cat.value)}
          >
            {cat.label}
          </button>
        )}
      </For>
      <style>{TABS_CSS}</style>
    </div>
  );
};

export default JournalFilter;

const TABS_CSS = `
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
`;
