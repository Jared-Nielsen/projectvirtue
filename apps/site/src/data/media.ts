// Media gallery — curated set of concept art with captions. The actual
// images live in /_conceptart and are NOT bundled here (their multi-MB sizes
// would tank LCP). For the marketing site we ship cropped, optimized versions
// at /public/media/* — the loader uses those paths via lazy <img loading="lazy">.

export type MediaKind = 'screenshot' | 'video' | 'artwork' | 'concept';

export interface MediaItem {
  readonly id: string;
  readonly kind: MediaKind;
  readonly title: string;
  readonly caption: string;
  /** Public-relative URL — populated when the asset pipeline runs. */
  readonly src: string;
  readonly thumb?: string;
  readonly alt: string;
  readonly featured?: boolean;
}

// SVG placeholders are inlined in <MediaGalleryItem> when src returns 404 in
// development; in production these would point at /media/*.webp.
export const MEDIA: readonly MediaItem[] = [
  {
    id: 'araven-overlook',
    kind: 'concept',
    title: 'Welcome to Ardania',
    caption:
      'A vast and living world awaits. From quiet villages to ancient strongholds, every place has a story to tell.',
    src: '/media/ardania-overlook.svg',
    alt: 'Concept art of a sweeping mountain valley with a castle on the horizon',
    featured: true,
  },
  {
    id: 'silverwood-keep',
    kind: 'concept',
    title: 'Silverwood Keep',
    caption: 'Forest stronghold of the Silvermark.',
    src: '/media/silverwood.svg',
    alt: 'Concept art of a forest keep at twilight',
  },
  {
    id: 'moon-portal',
    kind: 'screenshot',
    title: 'Moon Portal',
    caption: 'Travel between realms is gated by lunar alignment.',
    src: '/media/moon-portal.svg',
    alt: 'In-game screenshot of a glowing moon portal',
  },
  {
    id: 'dragon-encounter',
    kind: 'screenshot',
    title: 'Dragon Encounter',
    caption: 'A boss fight test in the Dread Hour shard.',
    src: '/media/dragon-encounter.svg',
    alt: 'In-game screenshot of a dragon combat encounter',
  },
  {
    id: 'paladin-castle',
    kind: 'artwork',
    title: 'Paladin Castle',
    caption: 'Loading-screen plate by the art team.',
    src: '/media/paladin-castle.svg',
    alt: 'Castle artwork showing a paladin returning at sunrise',
  },
  {
    id: 'dungeon-shame',
    kind: 'artwork',
    title: 'Dungeon: Shame',
    caption: 'One of eight thematic dungeons launching with the prototype.',
    src: '/media/dungeon-shame.svg',
    alt: 'Dark dungeon entrance with iron doors',
  },
  {
    id: 'tavern-ardania',
    kind: 'screenshot',
    title: 'The Wandering Cup, Ardania',
    caption: 'Spatial voice test — see the dev journal entry for the recording.',
    src: '/media/tavern.svg',
    alt: 'Tavern interior with NPCs gathered around tables',
  },
  {
    id: 'serpent-isle-coast',
    kind: 'concept',
    title: 'Serpent Isle Coast',
    caption: 'Strange tides on the EU shard.',
    src: '/media/serpent-isle.svg',
    alt: 'Coastline with twin moons',
  },
];

export const MEDIA_KINDS: readonly { value: MediaKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All Media' },
  { value: 'screenshot', label: 'Screenshots' },
  { value: 'video', label: 'Videos' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'concept', label: 'Concept Art' },
];
