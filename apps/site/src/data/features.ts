// Marketing copy for the Features page. Six pillars derived from todobatch2
// Phase 4 line: "virtue system, persistent world, UGC, GM mode, voice, crossplay".

export interface Feature {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly icon: string; // unicode glyph; replaced with @br/icons set later
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'virtue',
    title: 'The Virtue System',
    subtitle: 'Choice has weight',
    description:
      'Eight virtues quietly track every meaningful decision: truth, mercy, courage, justice, devotion, honor, insight, humility. Your alignment shapes how the world responds — which guards greet you, which merchants trust you, which prophecies name you.',
    bullets: [
      'No alignment meter on the HUD — virtue is observed, not gamified',
      'NPCs remember the choices that shaped you',
      'Reputation is regional; you can be a hero in one city, a heretic in another',
    ],
    icon: '⚖',
  },
  {
    id: 'world',
    title: 'A Living, Breathing World',
    subtitle: 'Persistent and reactive',
    description:
      'Mythenor runs on real time and real consequence. Crops grow. Markets shift. Factions march. NPCs follow daily routines — sleeping, working, mourning — and remember what you did to them yesterday.',
    bullets: [
      'Day / night with regional weather systems',
      'Dynamic world events that close after a window — miss them, lose them',
      'Economy driven by player extraction and player demand',
    ],
    icon: '◉',
  },
  {
    id: 'ugc',
    title: 'Player-Built Worlds',
    subtitle: 'Storytellers welcomed',
    description:
      'Every house, every guild hall, every dungeon you craft persists in the shared world. Architect-tier players can publish full regions; the marketplace ranks them by what other players remember a week later.',
    bullets: [
      'Plot-based housing with shared interiors and visitable lore',
      'Dungeon crafting toolkit with creature placement + encounter pacing',
      'Lore-tagged readable books authored by players',
    ],
    icon: '◈',
  },
  {
    id: 'gm',
    title: 'GM Campaign Mode',
    subtitle: "A dungeon master's table, online",
    description:
      'Host a private campaign for six friends. Spawn NPCs in real time, scribe encounters on the fly, and run a season of stories that exists nowhere else. Per Doc #42 — the GM is a player who runs Avermere for an evening, and the world remembers it.',
    bullets: [
      'Invite-only shards, six to eight seats',
      'Live encounter editor: spawn, narrate, branch',
      'Session replays exported as shareable lore',
    ],
    icon: '◇',
  },
  {
    id: 'voice',
    title: 'Spatial Voice',
    subtitle: 'Hear the tavern',
    description:
      'Voice carries by proximity. Whisper a secret in a dungeon. Shout across a battlefield. Push-to-talk by default, with consent flows in every region for cross-border audio.',
    bullets: [
      'Per-session opt-in (Doc #38 GDPR-compliant)',
      'Spatial mixing tied to your avatar position',
      'Subtitle layer for accessibility',
    ],
    icon: '◐',
  },
  {
    id: 'crossplay',
    title: 'Crossplay & Continuity',
    subtitle: 'One world, every device',
    description:
      'Web client today; native PC and console clients on the same shards as the rendering pipelines mature. Your character carries between sessions, between platforms, between regions.',
    bullets: [
      'Web (Solid + canvas) is the canonical bootstrap surface',
      'Native client launches with cross-region account sync',
      'Mobile companion app for journal, market, friends',
    ],
    icon: '◆',
  },
];
