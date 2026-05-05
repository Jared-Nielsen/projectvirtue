import { type RouteSectionProps, useLocation } from '@solidjs/router';
import { type Component, createEffect } from 'solid-js';
import { isServer } from 'solid-js/web';
import { trackPageview } from '../lib/analytics';
import { CookieBanner } from './CookieBanner';
import { Footer } from './Footer';
import { Header } from './Header';

export const Layout: Component<RouteSectionProps> = (props) => {
  const location = useLocation();

  // Fire a page-view (consent-gated, see lib/analytics.ts) on every route change.
  // Skipped on the server.
  if (!isServer) {
    createEffect(() => {
      const path = location.pathname;
      trackPageview(path);
    });
  }

  return (
    <div class="site-shell">
      <a href="#main" class="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main" class="site-main" tabindex="-1">
        {props.children}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};
