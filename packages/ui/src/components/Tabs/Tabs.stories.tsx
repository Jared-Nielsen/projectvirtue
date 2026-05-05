import type { Meta, StoryObj } from 'storybook-solidjs';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

const meta = {
  title: 'Primitives/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="quests">
      <TabList aria-label="Journal sections">
        <Tab value="quests">Quests</Tab>
        <Tab value="notes">Notes</Tab>
        <Tab value="lore">Lore</Tab>
        <Tab value="bestiary" disabled>
          Bestiary
        </Tab>
      </TabList>
      <TabPanel value="quests">Active quests appear here.</TabPanel>
      <TabPanel value="notes">Personal notes appear here.</TabPanel>
      <TabPanel value="lore">Discovered lore entries.</TabPanel>
      <TabPanel value="bestiary">Bestiary unlocks at level 5.</TabPanel>
    </Tabs>
  ),
};
