// Maps URL patterns to data loaders. The MockClient walks this list in order
// to resolve a request to a typed JSON payload. MSW handlers reuse the same
// loaders (see /handlers/*) so the dev-server and SSR/test paths stay in sync.

import * as data from './data-loader';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteEntry {
  readonly method: Method;
  /** Pattern with `:param` placeholders. Matched anchored on path only. */
  readonly pattern: string;
  /** Returns a value to send as the JSON body. May read from request body. */
  readonly handler: (ctx: RouteContext) => unknown | Promise<unknown>;
  /** HTTP status to use on success. Default 200. */
  readonly status?: number;
}

export interface RouteContext {
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export const routeTable: readonly RouteEntry[] = [
  // ---------- Auth ----------
  { method: 'POST', pattern: '/v1/auth/login', handler: () => data.loadLogin() },
  { method: 'GET', pattern: '/v1/auth/me', handler: () => data.loadMe() },
  { method: 'POST', pattern: '/v1/auth/logout', handler: () => data.loadLogout() },

  // ---------- Account ----------
  { method: 'GET', pattern: '/v1/account/profile', handler: () => data.loadProfile() },
  { method: 'GET', pattern: '/v1/account/preferences', handler: () => data.loadPreferences() },
  {
    method: 'PUT',
    pattern: '/v1/account/preferences',
    handler: (ctx) => ({ ...data.loadPreferences(), ...(ctx.body as object) }),
  },

  // ---------- Shard ----------
  { method: 'GET', pattern: '/v1/shards', handler: () => data.loadShards() },
  { method: 'GET', pattern: '/v1/shards/status', handler: () => data.loadShardStatus() },

  // ---------- World ----------
  { method: 'GET', pattern: '/v1/world/regions', handler: () => data.loadRegions() },
  {
    method: 'GET',
    pattern: '/v1/world/tiles/:regionId',
    handler: (ctx) => {
      // Phase 2 only ships sosaria; other regions resolve to the same map.
      void ctx;
      return data.loadTileMapSosaria();
    },
  },
  { method: 'GET', pattern: '/v1/world/npcs', handler: () => data.loadNpcs() },
  { method: 'GET', pattern: '/v1/world/landmarks', handler: () => data.loadLandmarks() },

  // ---------- Character ----------
  { method: 'GET', pattern: '/v1/characters', handler: () => data.loadCharacters() },
  {
    method: 'GET',
    pattern: '/v1/characters/templates',
    handler: () => data.loadCharacterTemplates(),
  },
  { method: 'GET', pattern: '/v1/characters/portraits', handler: () => data.loadPortraits() },
  {
    method: 'POST',
    pattern: '/v1/characters',
    handler: () => data.loadCreateCharacter(),
    status: 201,
  },

  // ---------- Inventory + items ----------
  { method: 'GET', pattern: '/v1/inventory/items', handler: () => data.loadInventoryItems() },
  { method: 'GET', pattern: '/v1/inventory/equipment', handler: () => data.loadEquipment() },
  {
    method: 'GET',
    pattern: '/v1/inventory/loot/:lootId',
    handler: () => data.loadSampleLootChest(),
  },
  { method: 'GET', pattern: '/v1/items/catalog', handler: () => data.loadItemsCatalog() },

  // ---------- Quests + journal + books ----------
  { method: 'GET', pattern: '/v1/quests/active', handler: () => data.loadActiveQuests() },
  { method: 'GET', pattern: '/v1/quests/log', handler: () => data.loadQuestLog() },
  { method: 'GET', pattern: '/v1/quests/templates', handler: () => data.loadQuestTemplates() },
  { method: 'GET', pattern: '/v1/journal', handler: () => data.loadJournalEntries() },
  { method: 'GET', pattern: '/v1/books/codex', handler: () => data.loadCodex() },
  { method: 'GET', pattern: '/v1/books/the-virtues', handler: () => data.loadTheVirtuesBook() },
  {
    method: 'GET',
    pattern: '/v1/books/:bookId',
    handler: () => data.loadTheVirtuesBook(),
  },

  // ---------- Dialog ----------
  {
    method: 'GET',
    pattern: '/v1/dialog/lord-british',
    handler: () => data.loadDialogLordBritish(),
  },
  { method: 'GET', pattern: '/v1/dialog/iolo', handler: () => data.loadDialogIolo() },
  { method: 'GET', pattern: '/v1/dialog/branch', handler: () => data.loadDialogBranch() },

  // ---------- Combat ----------
  { method: 'GET', pattern: '/v1/combat/state', handler: () => data.loadCombatState() },
  { method: 'GET', pattern: '/v1/combat/abilities', handler: () => data.loadAbilities() },
  { method: 'GET', pattern: '/v1/combat/spellbook', handler: () => data.loadSpellbook() },
  {
    method: 'GET',
    pattern: '/v1/combat/dragon-encounter',
    handler: () => data.loadDragonEncounter(),
  },

  // ---------- Economy + crafting ----------
  {
    method: 'GET',
    pattern: '/v1/economy/market-listings',
    handler: () => data.loadMarketListings(),
  },
  { method: 'GET', pattern: '/v1/crafting/recipes', handler: () => data.loadRecipes() },
  { method: 'GET', pattern: '/v1/crafting/stations', handler: () => data.loadCraftingStations() },

  // ---------- Social + voice ----------
  { method: 'GET', pattern: '/v1/social/friends', handler: () => data.loadFriends() },
  { method: 'GET', pattern: '/v1/social/guild', handler: () => data.loadGuild() },
  { method: 'GET', pattern: '/v1/social/chat-history', handler: () => data.loadChatHistory() },
  { method: 'GET', pattern: '/v1/voice/channels', handler: () => data.loadVoiceChannels() },

  // ---------- Options ----------
  { method: 'GET', pattern: '/v1/options/keybindings', handler: () => data.loadKeybindings() },
  { method: 'GET', pattern: '/v1/options/audio', handler: () => data.loadAudioOptions() },
  { method: 'GET', pattern: '/v1/options/video', handler: () => data.loadVideoOptions() },
  {
    method: 'GET',
    pattern: '/v1/options/accessibility',
    handler: () => data.loadAccessibilityOptions(),
  },
  { method: 'GET', pattern: '/v1/options/gameplay', handler: () => data.loadGameplayOptions() },
  // Mutations echo the merged body so screens can roundtrip optimistic state.
  {
    method: 'PUT',
    pattern: '/v1/options/keybindings',
    handler: (ctx) => ({ ...data.loadKeybindings(), ...(ctx.body as object) }),
  },
  {
    method: 'PUT',
    pattern: '/v1/options/audio',
    handler: (ctx) => ({ ...data.loadAudioOptions(), ...(ctx.body as object) }),
  },
  {
    method: 'PUT',
    pattern: '/v1/options/video',
    handler: (ctx) => ({ ...data.loadVideoOptions(), ...(ctx.body as object) }),
  },
  {
    method: 'PUT',
    pattern: '/v1/options/accessibility',
    handler: (ctx) => ({ ...data.loadAccessibilityOptions(), ...(ctx.body as object) }),
  },
  {
    method: 'PUT',
    pattern: '/v1/options/gameplay',
    handler: (ctx) => ({ ...data.loadGameplayOptions(), ...(ctx.body as object) }),
  },

  // ---------- Misc ----------
  { method: 'GET', pattern: '/v1/levelup/sample', handler: () => data.loadLevelUp() },
  { method: 'GET', pattern: '/v1/loading-screens', handler: () => data.loadLoadingScreens() },
  { method: 'GET', pattern: '/v1/discord/presence', handler: () => data.loadDiscordPresence() },
  { method: 'GET', pattern: '/v1/gm/campaigns', handler: () => data.loadCampaignList() },
  { method: 'GET', pattern: '/v1/gm/campaigns/:id', handler: () => data.loadSampleCampaign() },
  {
    method: 'POST',
    pattern: '/v1/telemetry/events',
    handler: () => data.loadTelemetryAck(),
    status: 202,
  },
];

/** Compile a `:param` pattern into a regex anchored to a URL path. */
export function compilePattern(pattern: string): {
  readonly regex: RegExp;
  readonly paramNames: readonly string[];
} {
  const paramNames: string[] = [];
  const segments = pattern.split('/').map((seg) => {
    if (seg.startsWith(':')) {
      paramNames.push(seg.slice(1));
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const regex = new RegExp(`^${segments.join('/')}/?$`);
  return { regex, paramNames };
}

export interface MatchedRoute {
  readonly entry: RouteEntry;
  readonly params: Readonly<Record<string, string>>;
}

export function matchRoute(method: Method, pathname: string): MatchedRoute | null {
  for (const entry of routeTable) {
    if (entry.method !== method) continue;
    const { regex, paramNames } = compilePattern(entry.pattern);
    const match = regex.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    paramNames.forEach((name, idx) => {
      const v = match[idx + 1];
      if (v !== undefined) params[name] = v;
    });
    return { entry, params };
  }
  return null;
}
