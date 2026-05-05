// GDPR cookie / privacy banner. Per Doc #38 §2.3 we treat analytics +
// marketing as **consent-based** (default OFF). The banner is visible until
// the visitor clicks Accept or Decline; either choice persists to localStorage.
//
// Visual: parchment surface anchored to the bottom of the viewport.

import { type Component, Show, createSignal, onMount } from 'solid-js';
import { isServer } from 'solid-js/web';
import { readConsent, writeConsent } from '../lib/consent';

export const CookieBanner: Component = () => {
  // Default visible=false: we only show after onMount confirms there's no record.
  // This avoids hydration mismatch (the server has no localStorage so it can't
  // know whether to render the banner — defaulting to hidden is safe; the
  // banner appears after hydration if needed).
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    if (isServer) return;
    if (!readConsent()) setVisible(true);
  });

  const handle = (choice: 'accept' | 'decline') => () => {
    writeConsent(choice);
    setVisible(false);
  };

  return (
    <Show when={visible()}>
      <aside
        class="cookie-banner"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-body"
      >
        <div class="cookie-banner__inner">
          <div class="cookie-banner__copy">
            <h2 id="cookie-banner-title" class="cookie-banner__title">
              Cookies & Privacy
            </h2>
            <p id="cookie-banner-body" class="cookie-banner__body">
              Project Virtue uses essential cookies to make this site work. With your consent, we'd
              also like to use anonymized analytics to understand how visitors find us. You can
              change your mind anytime from the footer.
            </p>
          </div>
          <div class="cookie-banner__actions">
            <button
              type="button"
              class="cookie-banner__btn cookie-banner__btn--ghost"
              onClick={handle('decline')}
            >
              Decline analytics
            </button>
            <button
              type="button"
              class="cookie-banner__btn cookie-banner__btn--primary"
              onClick={handle('accept')}
            >
              Accept all
            </button>
          </div>
        </div>
        <style>{BANNER_CSS}</style>
      </aside>
    </Show>
  );
};

const BANNER_CSS = `
.cookie-banner {
  position: fixed;
  inset: auto 16px 16px 16px;
  z-index: 60;
  background: linear-gradient(
    180deg,
    rgba(20, 17, 12, 0.96) 0%,
    rgba(8, 7, 5, 0.98) 100%
  );
  border: 1px solid rgba(207, 150, 47, 0.4);
  border-radius: 4px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6);
  color: var(--br-parchment-100);
}
.cookie-banner__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 22px;
  flex-wrap: wrap;
}
.cookie-banner__title {
  font-family: var(--br-font-heading);
  font-size: 1rem;
  margin: 0 0 4px;
  color: var(--br-sigil-200);
  letter-spacing: 0.08em;
}
.cookie-banner__body {
  margin: 0;
  font-size: 0.875rem;
  max-width: 60ch;
}
.cookie-banner__actions {
  display: inline-flex;
  gap: 12px;
  flex-shrink: 0;
}
.cookie-banner__btn {
  font-family: var(--br-font-ui);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 10px 16px;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid var(--br-sigil-500);
  transition: background 160ms, color 160ms;
}
.cookie-banner__btn--ghost {
  background: transparent;
  color: var(--br-parchment-100);
}
.cookie-banner__btn--ghost:hover {
  background: rgba(207, 150, 47, 0.1);
  color: var(--br-sigil-200);
}
.cookie-banner__btn--primary {
  background: var(--br-sigil-500);
  color: var(--br-ink-900);
  border-color: var(--br-sigil-400);
}
.cookie-banner__btn--primary:hover {
  background: var(--br-sigil-400);
}
@media (max-width: 640px) {
  .cookie-banner__actions { width: 100%; }
  .cookie-banner__btn { flex: 1; }
}
`;
