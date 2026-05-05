import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { Popover } from './Popover';

const meta = {
  title: 'Primitives/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ padding: '60px', display: 'flex', 'justify-content': 'center' }}>
      <Popover trigger={<Button>Open spellbook</Button>}>
        <strong style={{ display: 'block', 'margin-bottom': '8px' }}>Quick spells</strong>
        <ul style={{ margin: 0, 'padding-left': '18px' }}>
          <li>Heal</li>
          <li>Magic Arrow</li>
          <li>Recall</li>
        </ul>
      </Popover>
    </div>
  ),
};
