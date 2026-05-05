import { createSignal } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { Drawer } from './Drawer';

const meta = {
  title: 'Primitives/Drawer',
  component: Drawer,
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open inventory</Button>
        <Drawer open={open()} onClose={() => setOpen(false)} title="Inventory">
          <p>Items in your bag appear here.</p>
        </Drawer>
      </div>
    );
  },
};

export const Left: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open journal</Button>
        <Drawer open={open()} onClose={() => setOpen(false)} side="left" title="Journal">
          <p>Notes, lore, and quests.</p>
        </Drawer>
      </div>
    );
  },
};
