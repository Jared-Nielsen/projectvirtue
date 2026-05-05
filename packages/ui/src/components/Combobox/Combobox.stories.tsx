import type { Meta, StoryObj } from 'storybook-solidjs';
import { Combobox } from './Combobox';

const cities = [
  { value: 'britain', label: 'Britain' },
  { value: 'trinsic', label: 'Trinsic' },
  { value: 'magincia', label: 'Magincia' },
  { value: 'moonglow', label: 'Moonglow' },
  { value: 'yew', label: 'Yew' },
  { value: 'jhelom', label: 'Jhelom' },
  { value: 'minoc', label: 'Minoc' },
  { value: 'skara-brae', label: 'Skara Brae' },
];

const meta = {
  title: 'Primitives/Combobox',
  component: Combobox,
  args: { label: 'Recall destination', options: cities, placeholder: 'Type to filter…' },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = { args: { value: 'trinsic' } };
