import type { Meta, StoryObj } from 'storybook-solidjs';
import { Radio, RadioGroup } from './Radio';

const meta = {
  title: 'Primitives/Radio',
  component: Radio,
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  args: { name: 'difficulty', label: 'Casual', value: 'casual' },
};

export const Group: Story = {
  render: () => (
    <RadioGroup
      name="difficulty"
      label="Difficulty"
      value="normal"
      options={[
        { value: 'casual', label: 'Casual' },
        { value: 'normal', label: 'Normal' },
        { value: 'hardcore', label: 'Hardcore' },
        { value: 'permadeath', label: 'Permadeath', disabled: true },
      ]}
    />
  ),
};
