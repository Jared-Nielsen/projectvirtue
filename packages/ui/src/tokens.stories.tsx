import { For } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { colors, motion, radii, shadows, spacing, typography } from './tokens';

const Swatch = (props: { name: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      'flex-direction': 'column',
      'border-radius': '6px',
      overflow: 'hidden',
      border: '1px solid var(--br-border)',
      'font-family': 'var(--br-font-hud-mono)',
      'font-size': '11px',
    }}
  >
    <div style={{ background: props.value, height: '56px' }} />
    <div style={{ padding: '6px 8px', background: 'var(--br-surface)', color: 'var(--br-text)' }}>
      <div>{props.name}</div>
      <div style={{ color: 'var(--br-text-muted)' }}>{props.value}</div>
    </div>
  </div>
);

const Scale = (props: { name: string; values: Record<string, string> }) => (
  <div style={{ 'margin-bottom': '24px' }}>
    <h4 style={{ margin: '0 0 8px 0', 'font-family': 'var(--br-font-display)' }}>{props.name}</h4>
    <div
      style={{
        display: 'grid',
        'grid-template-columns': 'repeat(5, minmax(120px, 1fr))',
        gap: '8px',
      }}
    >
      <For each={Object.entries(props.values)}>
        {([k, v]) => <Swatch name={`${props.name}-${k}`} value={v} />}
      </For>
    </div>
  </div>
);

const Tokens = () => (
  <div style={{ 'font-family': 'var(--br-font-body)', color: 'var(--br-text)' }}>
    <h2 style={{ 'font-family': 'var(--br-font-display)', margin: '0 0 16px 0' }}>
      Britannia Reborn — design tokens
    </h2>

    <Scale name="parchment" values={colors.parchment} />
    <Scale name="ink" values={colors.ink} />
    <Scale name="sigil" values={colors.sigil} />
    <Scale name="virtue" values={colors.virtue} />
    <Scale name="blood" values={colors.blood} />
    <Scale name="mana" values={colors.mana} />
    <Scale name="dungeon" values={colors.dungeon} />

    <h3 style={{ 'font-family': 'var(--br-font-display)' }}>Typography</h3>
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
      <For each={Object.entries(typography.scale)}>
        {([key, def]) => (
          <div
            style={{
              'font-size': def.size,
              'line-height': def.lineHeight,
              'font-weight': def.weight,
              'font-family':
                key === 'hudMono'
                  ? typography.fontFamily.hudMono
                  : key.startsWith('h') || key === 'display'
                    ? typography.fontFamily.display
                    : typography.fontFamily.body,
            }}
          >
            {key} — The quick brown fox jumps over the lazy hydra.
          </div>
        )}
      </For>
    </div>

    <h3 style={{ 'font-family': 'var(--br-font-display)' }}>Spacing</h3>
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
      <For each={Object.entries(spacing)}>
        {([k, v]) => (
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
            <code style={{ width: '60px' }}>{k}</code>
            <code style={{ width: '60px' }}>{v}</code>
            <div style={{ width: v, height: '8px', background: 'var(--br-sigil-400)' }} />
          </div>
        )}
      </For>
    </div>

    <h3 style={{ 'font-family': 'var(--br-font-display)' }}>Radii</h3>
    <div style={{ display: 'flex', gap: '12px' }}>
      <For each={Object.entries(radii)}>
        {([k, v]) => (
          <div
            style={{
              background: 'var(--br-sigil-400)',
              color: 'var(--br-ink-700)',
              width: '80px',
              height: '60px',
              'border-radius': v,
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'font-family': 'var(--br-font-hud-mono)',
              'font-size': '12px',
            }}
          >
            {k}
          </div>
        )}
      </For>
    </div>

    <h3 style={{ 'font-family': 'var(--br-font-display)' }}>Shadows</h3>
    <div style={{ display: 'flex', gap: '24px', 'flex-wrap': 'wrap' }}>
      <For each={Object.entries(shadows)}>
        {([k, v]) => (
          <div
            style={{
              background: 'var(--br-surface)',
              color: 'var(--br-text)',
              width: '160px',
              height: '80px',
              'border-radius': '8px',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'box-shadow': v,
              'font-family': 'var(--br-font-hud-mono)',
              'font-size': '12px',
            }}
          >
            {k}
          </div>
        )}
      </For>
    </div>

    <h3 style={{ 'font-family': 'var(--br-font-display)' }}>Motion</h3>
    <pre style={{ 'font-family': 'var(--br-font-hud-mono)', 'font-size': '12px' }}>
      {JSON.stringify(motion, null, 2)}
    </pre>
  </div>
);

const meta = {
  title: 'Tokens/Overview',
  component: Tokens,
} satisfies Meta<typeof Tokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};
