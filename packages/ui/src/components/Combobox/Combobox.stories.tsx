import type { Meta, StoryObj } from 'storybook-solidjs';
import { Combobox } from './Combobox';

const cities = [
  { value: 'highmere', label: 'Highmere' },
  { value: 'stonereach', label: 'Stonereach' },
  { value: 'aurelia', label: 'Aurelia' },
  { value: 'lumencove', label: 'Lumencove' },
  { value: 'blackford', label: 'Blackford' },
  { value: 'jhelom', label: 'Jhelom' },
  { value: 'coldforge', label: 'Coldforge' },
  { value: 'mistwood', label: 'Mistwood' },
];

const meta = {
  title: 'Primitives/Combobox',
  component: Combobox,
  args: { label: 'Recall destination', options: cities, placeholder: 'Type to filter…' },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = { args: { value: 'stonereach' } };
