import { A } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import { clearConsent } from '../lib/consent';
import { Logo } from './Logo';

interface ExternalLink {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

const EXTERNAL: readonly ExternalLink[] = [
  { label: 'Discord', href: 'https://discord.gg/projectvirtue', icon: '◈' },
  { label: 'X (Twitter)', href: 'https://x.com/projectvirtue', icon: '✕' },
  { label: 'Steam', href: 'https://store.steampowered.com', icon: '⊕' },
  { label: 'Kickstarter', href: 'https://kickstarter.com/projectvirtue', icon: '✦' },
  { label: 'GameFound', href: 'https://gamefound.com/projectvirtue', icon: '◆' },
  { label: 'Reddit', href: 'https://reddit.com/r/projectvirtue', icon: '◐' },
  { label: 'YouTube', href: 'https://youtube.com/@projectvirtue', icon: '▶' },
];

interface FooterColumn {
  readonly title: string;
  readonly links: readonly { label: string; href: string; external?: boolean }[];
}

const COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Explore',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Features', href: '/features' },
      { label: 'Worlds', href: '/worlds' },
      { label: 'World Map', href: '/worlds/map' },
      { label: 'Journal', href: '/journal' },
      { label: 'Media', href: '/media' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'FAQ', href: '/journal' },
      { label: 'Roadmap', href: '/journal' },
      { label: 'Press Contact', href: 'mailto:press@projectvirtue.example', external: true },
    ],
  },
];

const handleResetConsent = (e: Event): void => {
  e.preventDefault();
  clearConsent();
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

export const Footer: Component = () => {
  const year = new Date().getFullYear();
  return (
    <footer class="site-footer">
      <div class="container site-footer__inner">
        <div class="site-footer__brand">
          <Logo size={48} />
          <p class="site-footer__tagline">A journey, a choice, a life.</p>
        </div>

        <For each={COLUMNS}>
          {(col) => (
            <div class="site-footer__col">
              <h2 class="site-footer__heading">{col.title}</h2>
              <ul class="site-footer__list">
                <For each={col.links}>
                  {(link) => (
                    <li>
                      {link.external ? (
                        <a href={link.href} rel="noopener noreferrer">
                          {link.label}
                        </a>
                      ) : (
                        <A href={link.href}>{link.label}</A>
                      )}
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>

        <div class="site-footer__col site-footer__col--social">
          <h2 class="site-footer__heading">Connect</h2>
          <ul class="site-footer__social">
            <For each={EXTERNAL}>
              {(link) => (
                <li>
                  <a
                    href={link.href}
                    aria-label={link.label}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={link.label}
                  >
                    <span aria-hidden="true">{link.icon}</span>
                    <span class="sr-only">{link.label}</span>
                  </a>
                </li>
              )}
            </For>
          </ul>
          <p class="site-footer__quote">
            <em>
              "The path of virtue is not easy, but it is the only path that leads to true power."
            </em>
          </p>
        </div>
      </div>

      <div class="site-footer__legal">
        <div class="container site-footer__legal-row">
          <span>© {year} Project Virtue / Britannia Reborn. All rights reserved.</span>
          <span class="site-footer__legal-links">
            <A href="/journal">Privacy Policy</A>
            <span aria-hidden="true">·</span>
            <A href="/journal">Terms of Service</A>
            <span aria-hidden="true">·</span>
            <button type="button" class="site-footer__reset" onClick={(e) => handleResetConsent(e)}>
              Reset cookie preferences
            </button>
          </span>
        </div>
      </div>

      <style>{FOOTER_CSS}</style>
    </footer>
  );
};

const FOOTER_CSS = `
.site-footer {
  margin-top: 80px;
  background: linear-gradient(180deg, rgba(4, 4, 5, 0.92) 0%, rgba(2, 2, 3, 1) 100%);
  border-top: 1px solid rgba(207, 150, 47, 0.18);
  color: var(--br-parchment-100);
}
.site-footer__inner {
  display: grid;
  grid-template-columns: 1.4fr repeat(2, 1fr) 1.4fr;
  gap: 40px;
  padding: 56px 24px 32px;
}
@media (max-width: 880px) {
  .site-footer__inner { grid-template-columns: 1fr 1fr; }
  .site-footer__col--social { grid-column: span 2; }
}
@media (max-width: 540px) {
  .site-footer__inner { grid-template-columns: 1fr; }
  .site-footer__col--social { grid-column: auto; }
}
.site-footer__tagline {
  font-style: italic;
  color: var(--br-parchment-200);
  margin-top: 12px;
  font-size: 0.875rem;
}
.site-footer__heading {
  font-family: var(--br-font-ui);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--br-sigil-400);
  margin: 0 0 16px;
}
.site-footer__list,
.site-footer__social {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-footer__list li {
  margin-bottom: 8px;
}
.site-footer__list a {
  color: var(--br-parchment-100);
  font-size: 0.9375rem;
}
.site-footer__list a:hover { color: var(--br-sigil-200); }
.site-footer__social {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.site-footer__social a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(207, 150, 47, 0.3);
  border-radius: 4px;
  color: var(--br-sigil-300);
  font-size: 1rem;
  transition: background 160ms, color 160ms, border-color 160ms;
}
.site-footer__social a:hover, .site-footer__social a:focus-visible {
  background: rgba(207, 150, 47, 0.12);
  border-color: var(--br-sigil-400);
  color: var(--br-sigil-100);
  text-decoration: none;
}
.site-footer__quote {
  margin-top: 16px;
  font-size: 0.875rem;
  color: var(--br-parchment-200);
  max-width: 28ch;
}
.site-footer__legal {
  border-top: 1px solid rgba(207, 150, 47, 0.12);
  padding: 16px 0;
  font-size: 0.8125rem;
  color: var(--br-parchment-200);
}
.site-footer__legal-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 24px;
}
.site-footer__legal-links {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}
.site-footer__reset {
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--br-parchment-200);
  cursor: pointer;
  text-decoration: underline;
}
.site-footer__reset:hover { color: var(--br-sigil-200); }
.site-footer__legal-links a {
  color: var(--br-parchment-200);
}
.site-footer__legal-links a:hover { color: var(--br-sigil-200); }
`;
