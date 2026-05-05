import type { Meta, StoryObj } from 'storybook-solidjs';
import { IconButton } from './IconButton';

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  args: { icon: 'x', label: 'Close' },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <IconButton variant="primary" icon="sword" label="Attack" />
      <IconButton variant="secondary" icon="shield" label="Defend" />
      <IconButton variant="destructive" icon="x" label="Discard" />
      <IconButton variant="icon" icon="scroll" label="Open journal" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
      <IconButton size="sm" icon="search" label="Search small" />
      <IconButton size="md" icon="search" label="Search medium" />
      <IconButton size="lg" icon="search" label="Search large" />
    </div>
  ),
};
