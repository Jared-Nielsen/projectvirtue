import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { ToastViewport, toast } from './Toast';

const meta = {
  title: 'Primitives/Toast',
  component: ToastViewport,
} satisfies Meta<typeof ToastViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div>
      <ToastViewport />
      <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
        <Button onClick={() => toast.success('Quest completed: The Broken Crown')}>Success</Button>
        <Button variant="secondary" onClick={() => toast.info('A merchant has new wares')}>
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.warning('You are encumbered.', { title: 'Heavy load' })}
        >
          Warning
        </Button>
        <Button variant="destructive" onClick={() => toast.error('Connection to Britannia lost.')}>
          Error
        </Button>
      </div>
    </div>
  ),
};
