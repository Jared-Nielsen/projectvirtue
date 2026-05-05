// Newsletter subscribe form. Mocked: simulated 600 ms latency, console.info,
// no real network call. Hydrated client:visible from any page that mounts it.

import { type Component, createSignal } from 'solid-js';
import { track } from '../lib/analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewsletterFormProps {
  /** Optional UI variant — primary on dark, ghost on parchment, inline (single row). */
  variant?: 'inline' | 'stacked';
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string };

async function submitMockNewsletter(email: string): Promise<void> {
  // The /newsletter route is not part of the MockClient route table; if/when
  // it lands, switch this to: await mockClient.post('/newsletter', { email })
  // For now we simulate latency and resolve.
  // eslint-disable-next-line no-console
  console.info('[newsletter] subscribe (mock):', email);
  await new Promise((r) => setTimeout(r, 600));
}

const NewsletterForm: Component<NewsletterFormProps> = (props) => {
  const [email, setEmail] = createSignal('');
  const [state, setState] = createSignal<SubmitState>({ kind: 'idle' });

  const submit = async (e: SubmitEvent): Promise<void> => {
    e.preventDefault();
    const value = email().trim();
    if (!EMAIL_RE.test(value)) {
      setState({ kind: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      await submitMockNewsletter(value);
      track({ name: 'newsletter_subscribe' });
      setState({ kind: 'success', email: value });
      setEmail('');
    } catch {
      setState({ kind: 'error', message: 'Something went wrong. Try again in a moment.' });
    }
  };

  const variant = (): 'inline' | 'stacked' => props.variant ?? 'inline';
  const status = (): SubmitState => state();

  return (
    <form
      class={`newsletter newsletter--${variant()}`}
      onSubmit={submit}
      noValidate
      aria-describedby="newsletter-status"
    >
      <label class="newsletter__label" for="newsletter-email">
        Get journals, dev notes, and be the first to know when Project Virtue launches.
      </label>
      <div class="newsletter__row">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autocomplete="email"
          required
          inputmode="email"
          placeholder="Enter your email address"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
          disabled={status().kind === 'submitting'}
          aria-invalid={status().kind === 'error'}
        />
        <button type="submit" disabled={status().kind === 'submitting'}>
          {status().kind === 'submitting' ? 'Sending…' : 'Subscribe'}
        </button>
      </div>
      <output id="newsletter-status" class="newsletter__status" aria-live="polite">
        {status().kind === 'success' && (
          <span class="newsletter__success">
            Thank you. We've sent a confirmation to{' '}
            <strong>
              {status().kind === 'success' ? (status() as { email: string }).email : ''}
            </strong>
            .
          </span>
        )}
        {status().kind === 'error' && (
          <span class="newsletter__error">{(status() as { message: string }).message}</span>
        )}
      </output>
      <style>{NEWSLETTER_CSS}</style>
    </form>
  );
};

export default NewsletterForm;

const NEWSLETTER_CSS = `
.newsletter {
  width: 100%;
  max-width: 560px;
}
.newsletter__label {
  display: block;
  font-size: 0.875rem;
  color: var(--br-parchment-200);
  margin-bottom: 12px;
}
.newsletter__row {
  display: flex;
  gap: 8px;
}
.newsletter input {
  flex: 1;
  background: rgba(8, 7, 5, 0.7);
  border: 1px solid rgba(207, 150, 47, 0.35);
  color: var(--br-parchment-50);
  padding: 12px 14px;
  font-family: var(--br-font-body);
  font-size: 0.9375rem;
  border-radius: 2px;
  min-width: 0;
}
.newsletter input::placeholder { color: var(--br-parchment-300); }
.newsletter input:focus-visible {
  outline: 2px solid var(--br-sigil-300);
  outline-offset: -1px;
}
.newsletter input[aria-invalid="true"] {
  border-color: var(--br-blood-400);
}
.newsletter button {
  background: var(--br-sigil-500);
  color: var(--br-ink-900);
  border: 1px solid var(--br-sigil-400);
  font-family: var(--br-font-ui);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 0 22px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 160ms;
}
.newsletter button:hover { background: var(--br-sigil-400); }
.newsletter button:disabled { opacity: 0.6; cursor: progress; }
.newsletter__status {
  margin: 8px 0 0;
  font-size: 0.875rem;
  min-height: 1.2em;
}
.newsletter__success { color: var(--br-success); }
.newsletter__error { color: var(--br-blood-200); }

.newsletter--stacked .newsletter__row { flex-direction: column; }
.newsletter--stacked .newsletter button { padding: 12px; }

@media (max-width: 540px) {
  .newsletter__row { flex-direction: column; }
  .newsletter button { padding: 12px; }
}
`;
