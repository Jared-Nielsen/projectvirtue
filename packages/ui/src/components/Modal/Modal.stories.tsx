import { createSignal } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { Confirm, Modal } from './Modal';

const meta = {
  title: 'Primitives/Modal',
  component: Modal,
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal
          open={open()}
          onClose={() => setOpen(false)}
          title="Save before leaving?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Discard
              </Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </>
          }
        >
          <p>You have unsaved changes to your character. Save them before exiting?</p>
        </Modal>
      </div>
    );
  },
};

export const ConfirmDestructive: Story = {
  render: () => {
    const [open, setOpen] = createSignal(false);
    return (
      <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete character
        </Button>
        <Confirm
          open={open()}
          title="Delete character?"
          message="This action cannot be undone. The character will be lost forever."
          confirmLabel="Delete"
          destructive
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </div>
    );
  },
};
