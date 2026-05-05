import { For } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { iconRegistry } from '../../icons/registry';
import { Icon } from './Icon';

const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  args: { name: 'sword', size: 32 },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Registry: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        'grid-template-columns': 'repeat(6, minmax(80px, 1fr))',
        gap: '12px',
        color: 'var(--br-sigil-300)',
        background: 'var(--br-dungeon-600)',
        padding: '16px',
        'border-radius': 'var(--br-radius-lg)',
      }}
    >
      <For each={Object.keys(iconRegistry) as (keyof typeof iconRegistry)[]}>
        {(name) => (
          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              'align-items': 'center',
              gap: '6px',
              'font-family': 'var(--br-font-ui)',
              'font-size': 'var(--br-fs-label)',
              color: 'var(--br-parchment-100)',
            }}
          >
            <Icon name={name} size={28} />
            <code>{name}</code>
          </div>
        )}
      </For>
    </div>
  ),
};

export const Spinner: Story = {
  args: { name: 'spinner', size: 40, spin: true, label: 'Loading' },
};
