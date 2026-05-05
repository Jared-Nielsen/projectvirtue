import type { Meta, StoryObj } from 'storybook-solidjs';
import { Card } from '../components/Card/Card';
import { Cluster, Grid, Stack } from './Layout';

const meta = {
  title: 'Layout/Helpers',
  component: Stack,
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

const tile = (label: string) => (
  <Card>
    <strong>{label}</strong>
  </Card>
);

export const StackExample: Story = {
  render: () => (
    <Stack gap="3">
      {tile('First')}
      {tile('Second')}
      {tile('Third')}
    </Stack>
  ),
};

export const ClusterExample: Story = {
  render: () => (
    <Cluster gap="2">
      {tile('Sword')}
      {tile('Shield')}
      {tile('Scroll')}
      {tile('Potion')}
    </Cluster>
  ),
};

export const GridExample: Story = {
  render: () => (
    <Grid minColumn="180px" gap="4">
      {tile('Britain')}
      {tile('Trinsic')}
      {tile('Magincia')}
      {tile('Moonglow')}
      {tile('Yew')}
      {tile('Jhelom')}
    </Grid>
  ),
};
