import type { Meta, StoryObj } from 'storybook-solidjs';
import { Button } from '../Button/Button';
import { WindowFrame } from './WindowFrame';

const meta = {
  title: 'Primitives/WindowFrame',
  component: WindowFrame,
  args: { title: 'Options' },
} satisfies Meta<typeof WindowFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <WindowFrame title="Options">
      <p>Configure your audio, video, and input preferences.</p>
      <div style={{ display: 'flex', gap: '8px', 'margin-top': '12px' }}>
        <Button variant="ghost">Reset</Button>
        <Button>Apply</Button>
      </div>
    </WindowFrame>
  ),
};

export const WithCloseButton: Story = {
  render: () => (
    <WindowFrame title="Ancient Text" onClose={() => alert('close')}>
      <p style={{ 'font-style': 'italic' }}>
        "Where light is kept in courage, and faith is forged in devotion, there shall the Dawn
        endure."
      </p>
      <p>— The Canticle of Ilmara</p>
    </WindowFrame>
  ),
};
