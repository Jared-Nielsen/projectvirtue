import type { Meta, StoryObj } from 'storybook-solidjs';
import { Slider } from './Slider';

const meta = {
  title: 'Primitives/Slider',
  component: Slider,
  args: { label: 'Master volume', defaultValue: 75, min: 0, max: 100 },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMarks: Story = {
  args: {
    label: 'Mouse sensitivity',
    defaultValue: 50,
    marks: [
      { value: 0, label: 'Slow' },
      { value: 50, label: 'Normal' },
      { value: 100, label: 'Fast' },
    ],
  },
};

export const Stepped: Story = {
  args: { label: 'Quality', defaultValue: 2, min: 1, max: 5, step: 1 },
};
