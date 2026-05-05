import type { Meta, StoryObj } from 'storybook-solidjs';
import { Card, Panel } from './Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <h3 style={{ margin: '0 0 8px 0' }}>The Broken Crown</h3>
      <p style={{ margin: 0 }}>Find the fragments of the king's crown.</p>
    </Card>
  ),
};

export const PanelVariant: Story = {
  render: () => (
    <Panel>
      <strong>Stats</strong>
      <ul style={{ margin: '8px 0 0 16px' }}>
        <li>STR 14</li>
        <li>DEX 12</li>
        <li>INT 10</li>
      </ul>
    </Panel>
  ),
};
