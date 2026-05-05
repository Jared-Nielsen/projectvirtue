import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  args: { label: 'Open the journal (J)' },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnButton: Story = {
  render: () => (
    <div style={{ padding: '40px' }}>
      <Tooltip label="Strike the foe (Enter)">
        <Button>Attack</Button>
      </Tooltip>
    </div>
  ),
};

export const OnIconButton: Story = {
  render: () => (
    <div style={{ padding: '40px' }}>
      <Tooltip label="Open the journal (J)">
        <IconButton icon="scroll" label="Open journal" />
      </Tooltip>
    </div>
  ),
};
