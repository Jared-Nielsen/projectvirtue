import type { Meta, StoryObj } from 'storybook-solidjs';
import { Select } from './Select';

const races = [
  { value: 'human', label: 'Human' },
  { value: 'elf', label: 'Elf' },
  { value: 'gargoyle', label: 'Gargoyle' },
  { value: 'orc', label: 'Orc', disabled: true },
];

const meta = {
  title: 'Primitives/Select',
  component: Select,
  args: { label: 'Race', options: races, placeholder: 'Choose a race' },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = { args: { value: 'elf' } };

export const Disabled: Story = { args: { disabled: true } };
