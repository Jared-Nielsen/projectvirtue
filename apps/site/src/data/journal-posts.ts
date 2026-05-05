// Inline mock dev journal posts — replaced by a CMS in Phase 7.
// Slugs are stable so /journal/:slug routes work in SSG.

export interface JournalPost {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: readonly string[];
  readonly date: string;
  readonly author: string;
  readonly tags: readonly string[];
  readonly category: 'dev-update' | 'lore' | 'tutorial' | 'community';
}

export const POSTS: readonly JournalPost[] = [
  {
    slug: 'why-the-eight-virtues-still-matter',
    title: 'Why the Eight Virtues Still Matter',
    excerpt:
      'Honesty, compassion, valor, justice, sacrifice, honor, spirituality, humility. We unpack why a thirty-year-old moral system is the spine of a 2026 RPG.',
    date: '2026-04-28',
    author: 'Jared',
    tags: ['design', 'lore'],
    category: 'lore',
    body: [
      "When we set out to rebuild Britannia, we kept asking: what made the original feel different? It wasn't the graphics. It wasn't the loot tables. It was the moment you realized the game was watching how you played, not just whether you won.",
      "The Eight Virtues were Richard Garriott's answer to a moral panic that the original Ultima series had triggered. They were also a quiet bet that role-playing games could be about character — about the kind of person you choose to become inside a fiction.",
      'In Project Virtue the virtues are tracked but never displayed. There is no alignment meter. No popup that says "+3 Compassion." Instead, NPCs remember. Guards greet you differently. Merchants trust you with rare goods. The world tells you who you are by how it treats you.',
      "It's slower. It's less satisfying than a number going up. We think it's also why people will still talk about their playthroughs ten years from now.",
    ],
  },
  {
    slug: 'shard-architecture-deep-dive',
    title: 'Shard Architecture Deep Dive',
    excerpt:
      'A look at how Order shards, Chaos shards, and GM-hosted campaigns share infrastructure but diverge sharply on rules, latency, and player density.',
    date: '2026-04-21',
    author: 'Josh',
    tags: ['engineering', 'architecture'],
    category: 'dev-update',
    body: [
      'A "shard" in our terminology is a self-contained instance of Sosaria — a complete world with its own population, economy, history, and tick cadence. We launch with two flavors that share infrastructure but disagree on the rules.',
      'Order shards enforce the virtue system as a hard ruleset. PvP is consensual or arena-bounded. Looting is restricted. Reputation is sticky. These are the canonical Britannia experience.',
      "Chaos shards remove the velvet rope. Open PvP, full looting, reduced virtue rewards. Same world, different social contract. They're also the source of the most talked-about emergent stories.",
      "Then there's GM mode: a private shard hosted by a single player for six to eight friends, running a curated campaign over multiple sessions. Per Doc #42, GM mode is a first-class shard kind, not an afterthought.",
    ],
  },
  {
    slug: 'building-a-living-economy',
    title: 'Building a Living Economy',
    excerpt:
      'Why we kill the auction house, why every silver coin has provenance, and how player-driven extraction will shape the marketplace from day one.',
    date: '2026-04-14',
    author: 'Jared',
    tags: ['design', 'economy'],
    category: 'dev-update',
    body: [
      "The auction house killed two MMOs we loved. So we're not shipping one.",
      "Project Virtue's economy is regional and physical. A sword forged in Trinsic has to travel — by player, by caravan — to the buyer in Yew. Goods have provenance: who crafted them, who carried them, who fenced them.",
      "This means the marketplace is real. Logistics is a profession. Smuggling is possible. Highway robbery is possible. We don't expect everyone to love this — we expect the people who love it to love it intensely.",
    ],
  },
  {
    slug: 'first-look-spatial-voice',
    title: 'First Look: Spatial Voice in the Tavern',
    excerpt:
      'A short clip from our internal alpha showing how spatial voice changes tavern social dynamics — and how the GDPR consent flow stays out of the way.',
    date: '2026-04-04',
    author: 'Josh',
    tags: ['voice', 'community'],
    category: 'community',
    body: [
      'We ran an internal alpha with twenty playtesters in a single tavern interior. The thing nobody expected: people whispered.',
      'Spatial voice — where audio falls off with distance — recreates the ambient texture of a real social space. You hear the table next to you only if you lean in. You hear the bard from the corner faintly, and you can choose to walk over. People form small groups naturally because the audio rewards it.',
      'On the privacy side, we keep voice opt-in per session, with the cross-border consent flow surfaced in the connect modal. Doc #38 §2.3 is our compliance floor.',
    ],
  },
  {
    slug: 'roadmap-2026',
    title: 'Roadmap to End of 2026',
    excerpt:
      "What's landing, what's shifting, what we're cutting. The honest version. No hype, no anniversaries.",
    date: '2026-03-30',
    author: 'Jared',
    tags: ['roadmap'],
    category: 'dev-update',
    body: [
      'Q2: Web client beta with two Order shards, one Chaos shard, and a GM-hosted demo campaign. Voice is opt-in. Trade is regional. Inventory and combat are mock-driven.',
      'Q3: First end-to-end vertical slice — login, character creation, port city, dungeon, return. Real persistence on at least one shard.',
      'Q4: Open beta wave. Native client behind a flag for testers willing to install Unreal Engine binaries.',
      "What we're cutting: real-time PvP outside arenas (deferred to 2027), mobile companion app (deferred to launch+1), full procedural dungeon generation (we're shipping authored dungeons first).",
    ],
  },
];

export function getPost(slug: string): JournalPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
