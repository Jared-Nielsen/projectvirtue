import type { Meta, StoryObj } from 'storybook-solidjs';
import { Icon } from '../Icon/Icon';
import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Continue' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'destructive', 'ghost', 'icon'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', 'align-items': 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <Button leadingIcon={<Icon name="sword" />}>Attack</Button>
      <Button variant="secondary" trailingIcon={<Icon name="chevron-right" />}>
        Continue
      </Button>
    </div>
  ),
};

export const Loading: Story = { args: { loading: true } };
