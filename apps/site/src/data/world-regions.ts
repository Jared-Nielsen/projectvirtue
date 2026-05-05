// SVG-overlay regions for the WorldMap component. Coordinates are normalized
// to the underlying world-map artwork's intrinsic dimensions (1200 x 800).
// Each region has a polygon path and a piece of marketing copy that surfaces
// in the tooltip / detail panel.

export interface WorldRegion {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly kind: 'capital' | 'city' | 'town' | 'wilderness' | 'dungeon';
  /** SVG polygon points (string of "x,y x,y ..." pairs). Coords in 0-1200 / 0-800. */
  readonly polygon: string;
  /** Pin coordinates for label placement. */
  readonly pin: readonly [number, number];
}

export const WORLD_REGIONS: readonly WorldRegion[] = [
  {
    id: 'ardania',
    name: 'Ardania',
    subtitle: 'Capital of the Realm',
    description:
      'Seat of the Council of Eight. A beacon of civilization and learning where the Temple of Truth and the Grand Library still stand.',
    kind: 'capital',
    polygon: '560,360 640,340 700,400 680,460 600,470 540,430',
    pin: [620, 400],
  },
  {
    id: 'silvermark',
    name: 'Silvermark',
    subtitle: 'The Silver Forest',
    description:
      'Old growth woodland and elven settlements. Druid circles meet here at the equinox.',
    kind: 'wilderness',
    polygon: '320,420 460,400 500,500 420,560 320,540',
    pin: [400, 480],
  },
  {
    id: 'ironfang-wastes',
    name: 'Ironfang Wastes',
    subtitle: 'Lands of Blood and Iron',
    description: 'Volcanic plateau home to orcish warbands and the Crimson Keep. Approach armed.',
    kind: 'wilderness',
    polygon: '740,460 880,440 920,540 820,600 740,560',
    pin: [820, 520],
  },
  {
    id: 'highton',
    name: 'Highton',
    subtitle: 'Mountain Pass',
    description:
      'Trade gate to the Northern Reach. Toll guards and tax collectors. Watch your purse.',
    kind: 'town',
    polygon: '500,180 580,170 600,240 520,260 480,220',
    pin: [540, 220],
  },
  {
    id: 'westport',
    name: 'Westport',
    subtitle: 'Port City',
    description:
      "Avermere's busiest harbor. Smugglers, shipwrights, and a black market that pretends to be a bazaar.",
    kind: 'city',
    polygon: '120,340 240,320 280,420 200,460 120,440',
    pin: [200, 390],
  },
  {
    id: 'dungeon-blacktarn',
    name: 'Dungeon: Blacktarn',
    subtitle: 'A Place of Shadow',
    description:
      'Sealed by the Council, broken open by something inside. PvP-enabled regardless of shard kind.',
    kind: 'dungeon',
    polygon: '360,200 420,200 440,260 380,280 340,250',
    pin: [390, 240],
  },
  {
    id: 'rivenhall',
    name: 'Rivenhall',
    subtitle: 'Trade Town',
    description: 'Inland market hub at the river fork. Caravan resupply point.',
    kind: 'town',
    polygon: '660,560 740,560 760,640 680,660 640,620',
    pin: [700, 600],
  },
  {
    id: 'wyrm-reach',
    name: 'Wyrm Reach',
    subtitle: 'Stranger Sea',
    description: 'Beyond the Pillars: ferries leave from here for the The Iron Marches shard.',
    kind: 'wilderness',
    polygon: '900,200 1080,180 1120,300 1020,360 900,320',
    pin: [1000, 270],
  },
];
