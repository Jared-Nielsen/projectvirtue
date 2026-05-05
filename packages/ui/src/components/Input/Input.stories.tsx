import type { Meta, StoryObj } from 'storybook-solidjs';
import { Icon } from '../Icon/Icon';
import { Input } from './Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  args: { label: 'Character name', placeholder: 'Erevan the Bard' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: { helperText: 'Visible to other adventurers in Avermere.' },
};

export const Invalid: Story = {
  args: { errorText: 'Name is already taken.', value: 'Erevan' },
};

export const SearchWithIcon: Story = {
  args: {
    type: 'search',
    label: 'Find spell',
    placeholder: 'Search the grimoire',
    leadingAddon: <Icon name="search" />,
  },
};

export const Password: Story = {
  args: { type: 'password', label: 'Password', placeholder: 'Speak, friend' },
};
