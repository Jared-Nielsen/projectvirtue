import type { Meta, StoryObj } from 'storybook-solidjs';
import { Loading, Skeleton, Spinner } from './Loading';

const meta = {
  title: 'Primitives/Loading',
  component: Loading,
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpinnerOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', 'align-items': 'center' }}>
      <Spinner />
      <Spinner size={36} />
    </div>
  ),
};

export const FullLoading: Story = {
  render: () => <Loading label="Travelling to Britain…" />,
};

export const SkeletonStack: Story = {
  render: () => (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', width: '320px' }}>
      <Skeleton height={28} width="60%" />
      <Skeleton height={14} />
      <Skeleton height={14} />
      <Skeleton height={14} width="80%" />
    </div>
  ),
};
