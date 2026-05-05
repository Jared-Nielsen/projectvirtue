import { A, useLocation } from '@solidjs/router';
import { type Component, For, createSignal } from 'solid-js';
import { Logo } from './Logo';

interface NavItem {
  readonly label: string;
  readonly href: string;
}

const NAV: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Features', href: '/features' },
  { label: 'Worlds', href: '/worlds' },
  { label: 'Journal', href: '/journal' },
  { label: 'Media', href: '/media' },
];

export const Header: Component = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = createSignal(false);

  const isActive = (href: string): boolean => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <header class="site-header">
      <div class="container site-header__inner">
        <A
          href="/"
          aria-label="Project Virtue — home"
          class="site-header__brand"
          onClick={() => setMenuOpen(false)}
        >
          <Logo size={36} />
        </A>

        <button
          type="button"
          class="site-header__toggle"
          aria-expanded={menuOpen()}
          aria-controls="primary-navigation"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen(!menuOpen())}
        >
          <span aria-hidden="true">{menuOpen() ? '✕' : '☰'}</span>
        </button>

        <nav
          id="primary-navigation"
          class={`site-header__nav ${menuOpen() ? 'is-open' : ''}`}
          aria-label="Primary"
        >
          <ul class="site-header__nav-list">
            <For each={NAV}>
              {(item) => (
                <li>
                  <A
                    href={item.href}
                    end={item.href === '/'}
                    class="site-header__nav-link"
                    classList={{ 'is-active': isActive(item.href) }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </A>
                </li>
              )}
            </For>
          </ul>
          <A href="/join" class="site-header__cta" onClick={() => setMenuOpen(false)}>
            Join a World
          </A>
        </nav>
      </div>

      <style>{HEADER_CSS}</style>
    </header>
  );
};

const HEADER_CSS = `
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(180deg, rgba(4, 4, 5, 0.94) 0%, rgba(7, 8, 9, 0.86) 100%);
  border-bottom: 1px solid rgba(207, 150, 47, 0.18);
  backdrop-filter: blur(8px);
}
.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 24px;
}
.site-header__brand {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
.site-header__brand:hover, .site-header__brand:focus-visible {
  text-decoration: none;
}
.site-header__nav {
  display: flex;
  align-items: center;
  gap: 24px;
}
.site-header__nav-list {
  display: flex;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-header__nav-link {
  display: inline-block;
  padding: 8px 14px;
  font-family: var(--br-font-ui);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--br-parchment-100);
  text-decoration: none;
  border-radius: 2px;
  transition: color 200ms;
}
.site-header__nav-link:hover, .site-header__nav-link:focus-visible {
  color: var(--br-sigil-200);
  text-decoration: none;
}
.site-header__nav-link.is-active {
  color: var(--br-sigil-300);
  border-bottom: 1px solid var(--br-sigil-400);
}
.site-header__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-family: var(--br-font-ui);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--br-sigil-100);
  background: transparent;
  border: 1px solid var(--br-sigil-500);
  border-radius: 2px;
  text-decoration: none;
  transition: background 200ms, color 200ms, border-color 200ms;
}
.site-header__cta:hover, .site-header__cta:focus-visible {
  background: var(--br-sigil-500);
  color: var(--br-ink-900);
  border-color: var(--br-sigil-400);
  text-decoration: none;
}
.site-header__toggle {
  display: none;
  background: transparent;
  border: 1px solid rgba(207, 150, 47, 0.4);
  color: var(--br-sigil-200);
  font-size: 1.25rem;
  width: 40px;
  height: 40px;
  cursor: pointer;
  border-radius: 2px;
}
@media (max-width: 880px) {
  .site-header__toggle { display: inline-flex; align-items: center; justify-content: center; }
  .site-header__nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    background: rgba(7, 8, 9, 0.98);
    border-bottom: 1px solid rgba(207, 150, 47, 0.18);
  }
  .site-header__nav.is-open { display: flex; }
  .site-header__nav-list { flex-direction: column; align-items: stretch; gap: 0; }
  .site-header__nav-link { padding: 12px 0; }
}
`;
