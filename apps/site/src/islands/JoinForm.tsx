// Join-a-world form. Mocked submission (console.info + 700 ms simulated
// latency). Hydrated client:visible from /join.astro.

import type { Shard } from '@br/types';
import { type Component, For, Show, createSignal } from 'solid-js';
import { track } from '../lib/analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; email: string; shardId: string }
  | { kind: 'error'; message: string };

interface FormState {
  email: string;
  shardId: string;
  region: 'na-east' | 'na-west' | 'eu-west' | 'eu-central' | 'apac' | 'sa' | '';
  playstyle: 'order' | 'chaos' | 'gm' | '';
  experience: 'new' | 'returning' | 'veteran' | '';
}

const initial: FormState = {
  email: '',
  shardId: '',
  region: '',
  playstyle: '',
  experience: '',
};

async function submitMockJoin(form: FormState): Promise<void> {
  // eslint-disable-next-line no-console
  console.info('[join] submission (mock):', form);
  await new Promise((r) => setTimeout(r, 700));
}

export interface JoinFormProps {
  /** Shards loaded at build time and passed in serialised. */
  readonly shards: readonly Shard[];
}

const JoinForm: Component<JoinFormProps> = (props) => {
  const [form, setForm] = createSignal<FormState>({ ...initial });
  const [state, setState] = createSignal<SubmitState>({ kind: 'idle' });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm({ ...form(), [key]: value });
  };

  const submit = async (e: SubmitEvent): Promise<void> => {
    e.preventDefault();
    const f = form();
    if (!EMAIL_RE.test(f.email.trim())) {
      setState({ kind: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (!f.shardId) {
      setState({ kind: 'error', message: 'Please pick a shard to join.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      await submitMockJoin(f);
      track({
        name: 'join_signup',
        props: {
          shard_id: f.shardId,
          ...(f.region ? { region: f.region } : {}),
          ...(f.playstyle ? { playstyle: f.playstyle } : {}),
          ...(f.experience ? { experience: f.experience } : {}),
        },
      });
      setState({ kind: 'success', email: f.email.trim(), shardId: f.shardId });
      setForm({ ...initial });
    } catch {
      setState({ kind: 'error', message: 'Submission failed. Try again in a moment.' });
    }
  };

  return (
    <form class="surface join-form" onSubmit={submit} noValidate>
      <h2>Reserve your seat</h2>
      <p class="join-form__intro">
        We'll email you when your selected shard opens, with a single click-through to claim your
        character slot. No marketing spam. See our <a href="/journal">privacy policy</a> for what we
        keep and for how long.
      </p>

      <Show when={state().kind === 'success'}>
        <output class="join-form__success" aria-live="polite">
          <h3>Welcome, traveler.</h3>
          <p>
            We've recorded your interest. Watch{' '}
            <strong>{(state() as { email: string }).email}</strong> for the shard-open notice.
          </p>
        </output>
      </Show>

      <Show when={state().kind !== 'success'}>
        <div class="join-form__field">
          <label for="join-email">Email address</label>
          <input
            id="join-email"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
            value={form().email}
            onInput={(e) => update('email', e.currentTarget.value)}
            aria-invalid={state().kind === 'error' && !EMAIL_RE.test(form().email.trim())}
          />
        </div>

        <div class="join-form__field">
          <label for="join-shard">Pick a shard</label>
          <select
            id="join-shard"
            required
            value={form().shardId}
            onChange={(e) => update('shardId', e.currentTarget.value)}
          >
            <option value="">Choose a shard…</option>
            <For each={props.shards}>
              {(s) => (
                <option value={s.id}>
                  {s.name} ({s.kind} · {s.region})
                </option>
              )}
            </For>
          </select>
        </div>

        <div class="join-form__row">
          <div class="join-form__field">
            <label for="join-region">Preferred region</label>
            <select
              id="join-region"
              value={form().region}
              onChange={(e) => update('region', e.currentTarget.value as FormState['region'])}
            >
              <option value="">No preference</option>
              <option value="na-east">North America East</option>
              <option value="na-west">North America West</option>
              <option value="eu-west">Europe West</option>
              <option value="eu-central">Europe Central</option>
              <option value="apac">Asia Pacific</option>
              <option value="sa">South America</option>
            </select>
          </div>

          <div class="join-form__field">
            <label for="join-playstyle">Playstyle</label>
            <select
              id="join-playstyle"
              value={form().playstyle}
              onChange={(e) => update('playstyle', e.currentTarget.value as FormState['playstyle'])}
            >
              <option value="">Surprise me</option>
              <option value="order">Order — virtue + arena PvP</option>
              <option value="chaos">Chaos — open PvP, full looting</option>
              <option value="gm">GM Campaign — invite-only</option>
            </select>
          </div>
        </div>

        <div class="join-form__field">
          <label for="join-exp">Experience with the genre</label>
          <select
            id="join-exp"
            value={form().experience}
            onChange={(e) => update('experience', e.currentTarget.value as FormState['experience'])}
          >
            <option value="">Skip</option>
            <option value="new">New to MMORPGs</option>
            <option value="returning">Returning player</option>
            <option value="veteran">Veteran (UO, Everquest, etc.)</option>
          </select>
        </div>

        <Show when={state().kind === 'error'}>
          <p class="join-form__error" role="alert">
            {(state() as { message: string }).message}
          </p>
        </Show>

        <button type="submit" class="cta cta--primary" disabled={state().kind === 'submitting'}>
          {state().kind === 'submitting' ? 'Sending…' : 'Reserve my seat'}
        </button>
      </Show>
      <style>{JOIN_FORM_CSS}</style>
    </form>
  );
};

export default JoinForm;

const JOIN_FORM_CSS = `
.join-form { padding: 28px; display: flex; flex-direction: column; gap: 16px; }
.join-form h2 { margin: 0; }
.join-form__intro { font-size: 0.875rem; color: var(--br-parchment-200); }
.join-form__field { display: flex; flex-direction: column; gap: 6px; }
.join-form__field label {
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--br-parchment-300);
}
.join-form input,
.join-form select {
  background: rgba(8, 7, 5, 0.7);
  border: 1px solid rgba(207, 150, 47, 0.3);
  color: var(--br-parchment-50);
  padding: 12px 14px;
  font-family: var(--br-font-body);
  font-size: 0.9375rem;
  border-radius: 2px;
}
.join-form input:focus-visible, .join-form select:focus-visible {
  outline: 2px solid var(--br-sigil-300);
  outline-offset: -1px;
}
.join-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 540px) { .join-form__row { grid-template-columns: 1fr; } }
.join-form__error { color: var(--br-blood-200); font-size: 0.875rem; margin: 0; }
.join-form__success {
  background: rgba(94, 138, 58, 0.15);
  border: 1px solid var(--br-success);
  color: var(--br-parchment-50);
  padding: 16px;
  border-radius: 2px;
}
.join-form__success h3 { margin: 0 0 4px; color: var(--br-success); }
.join-form__success p { margin: 0; font-size: 0.875rem; }
.join-form .cta { align-self: flex-start; }
`;
