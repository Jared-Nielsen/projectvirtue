import type { Meta, StoryObj } from 'storybook-solidjs';
import { HealthBar, ManaBar, MinimapPlaceholder, StatGauge } from './HUD';

const meta = {
  title: 'HUD/HUD primitives',
  component: HealthBar,
} satisfies Meta<typeof HealthBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bars: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'column',
        gap: '12px',
        padding: '24px',
        background: 'var(--br-dungeon-700)',
        'border-radius': '8px',
      }}
    >
      <HealthBar label="HP" value={72} max={100} />
      <ManaBar label="MP" value={45} max={80} />
      <StatGauge label="XP" value={320} max={1000} />
    </div>
  ),
};

export const Minimap: Story = {
  render: () => (
    <div style={{ padding: '24px', background: 'var(--br-dungeon-700)' }}>
      <MinimapPlaceholder />
    </div>
  ),
};

export const FullHUD: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: '32px',
        padding: '32px',
        background: 'radial-gradient(ellipse at top, var(--br-dungeon-500), var(--br-dungeon-700))',
        'border-radius': '12px',
        'align-items': 'flex-end',
      }}
    >
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
        <HealthBar label="HP" value={72} />
        <ManaBar label="MP" value={45} max={80} />
      </div>
      <MinimapPlaceholder />
    </div>
  ),
};
