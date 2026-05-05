// Static JSON loaders. Each domain's loader returns a typed payload.
//
// Static import keeps the data tree-shakeable and bundler-friendly. Vite's
// JSON loader inlines these into the dev server's module graph; vitest /
// Node 20+ resolve them via `resolveJsonModule`.
//
// The casts at the boundary are deliberate — JSON has no nominal types, and
// the brand types in @br/types are erased at runtime. TODO(zod): when runtime
// validation lands, replace these casts with `parse()` calls against the
// matching schema.

import type {
  Ability,
  AccessibilityOptions,
  AudioOptions,
  Book,
  Campaign,
  CampaignSummary,
  Character,
  CharacterTemplate,
  ChatChannel,
  ChatMessage,
  CodexEntry,
  CombatState,
  CraftingStation,
  CreateCharacterResponse,
  Equipment,
  Friend,
  GameplayOptions,
  Guild,
  Item,
  JournalEntry,
  Keybindings,
  Landmark,
  LevelUpEvent,
  LoadingScreenManifest,
  LoginResponse,
  LogoutResponse,
  LootContainer,
  MarketListing,
  Me,
  Npc,
  NpcDialog,
  Portrait,
  Preferences,
  Profile,
  Quest,
  QuestTemplate,
  Recipe,
  Region,
  RichPresence,
  Shard,
  ShardStatusSnapshot,
  Spellbook,
  TelemetryAck,
  TileMap,
  VideoOptions,
  VoiceChannel,
} from '@br/types';

import accountPreferences from '../data/account/preferences.json';
import accountProfile from '../data/account/profile.json';
import authLogin from '../data/auth/login.json';
import authLogout from '../data/auth/logout.json';
import authMe from '../data/auth/me.json';
import booksCodex from '../data/books/codex.json';
import booksTheVirtues from '../data/books/the-virtues.json';
import characterCreateResponse from '../data/character/create.response.json';
import characterList from '../data/character/list.json';
import characterPortraits from '../data/character/portraits.json';
import characterTemplates from '../data/character/templates.json';
import combatAbilities from '../data/combat/abilities.json';
import combatDragon from '../data/combat/dragon-encounter.json';
import combatSpellbook from '../data/combat/spellbook.json';
import combatState from '../data/combat/state.json';
import craftingRecipes from '../data/crafting/recipes.json';
import craftingStations from '../data/crafting/stations.json';
import dialogBranch from '../data/dialog/branch.json';
import dialogIolo from '../data/dialog/iolo.json';
import dialogLordBritish from '../data/dialog/lord-british.json';
import discordPresence from '../data/discord/presence.json';
import economyMarketListings from '../data/economy/market-listings.json';
import gmCampaignList from '../data/gm/campaign-list.json';
import inventoryEquipment from '../data/inventory/equipment.json';
import inventoryItems from '../data/inventory/items.json';
import inventoryLootSampleChest from '../data/inventory/loot/sample-chest.json';
import itemsCatalog from '../data/items/catalog.json';
import journalEntries from '../data/journal/entries.json';
import levelupSample from '../data/levelup/sample.json';
import loadingScreensIndex from '../data/loadingscreens/index.json';
import optionsAccessibility from '../data/options/accessibility.json';
import optionsAudio from '../data/options/audio.json';
import optionsGameplay from '../data/options/gameplay.json';
import optionsKeybindings from '../data/options/keybindings.json';
import optionsVideo from '../data/options/video.json';
import questsActive from '../data/quests/active.json';
import questsLog from '../data/quests/log.json';
import questsTemplates from '../data/quests/templates.json';
import shardsList from '../data/shards/list.json';
import shardsStatus from '../data/shards/status.json';
import socialChatHistory from '../data/social/chat-history.json';
import socialFriends from '../data/social/friends.json';
import socialGuild from '../data/social/guild.json';
import telemetryEventResponse from '../data/telemetry/event.response.json';
import voiceChannels from '../data/voice/channels.json';
import worldLandmarks from '../data/world/landmarks.json';
import worldNpcs from '../data/world/npcs.json';
import worldRegions from '../data/world/regions.json';
import worldTilesSosaria from '../data/world/tiles/sosaria.json';

// ---------- Auth + account ----------

export const loadLogin = (): LoginResponse => authLogin as unknown as LoginResponse;
export const loadMe = (): Me => authMe as unknown as Me;
export const loadLogout = (): LogoutResponse => authLogout as unknown as LogoutResponse;
export const loadProfile = (): Profile => accountProfile as unknown as Profile;
export const loadPreferences = (): Preferences => accountPreferences as unknown as Preferences;

// ---------- Shard ----------

export const loadShards = (): { readonly shards: readonly Shard[] } =>
  shardsList as unknown as { readonly shards: readonly Shard[] };
export const loadShardStatus = (): { readonly snapshots: readonly ShardStatusSnapshot[] } =>
  shardsStatus as unknown as { readonly snapshots: readonly ShardStatusSnapshot[] };

// ---------- World ----------

export const loadRegions = (): { readonly regions: readonly Region[] } =>
  worldRegions as unknown as { readonly regions: readonly Region[] };
export const loadTileMapSosaria = (): TileMap => worldTilesSosaria as unknown as TileMap;
export const loadNpcs = (): { readonly npcs: readonly Npc[] } =>
  worldNpcs as unknown as { readonly npcs: readonly Npc[] };
export const loadLandmarks = (): { readonly landmarks: readonly Landmark[] } =>
  worldLandmarks as unknown as { readonly landmarks: readonly Landmark[] };

// ---------- Character ----------

export const loadCharacters = (): { readonly characters: readonly Character[] } =>
  characterList as unknown as { readonly characters: readonly Character[] };
export const loadCharacterTemplates = (): { readonly templates: readonly CharacterTemplate[] } =>
  characterTemplates as unknown as { readonly templates: readonly CharacterTemplate[] };
export const loadPortraits = (): { readonly portraits: readonly Portrait[] } =>
  characterPortraits as unknown as { readonly portraits: readonly Portrait[] };
export const loadCreateCharacter = (): CreateCharacterResponse =>
  characterCreateResponse as unknown as CreateCharacterResponse;

// ---------- Inventory + items ----------

export const loadInventoryItems = (): { readonly items: readonly Item[] } =>
  inventoryItems as unknown as { readonly items: readonly Item[] };
export const loadEquipment = (): Equipment => inventoryEquipment as unknown as Equipment;
export const loadSampleLootChest = (): LootContainer =>
  inventoryLootSampleChest as unknown as LootContainer;
export const loadItemsCatalog = (): { readonly items: readonly Item[] } =>
  itemsCatalog as unknown as { readonly items: readonly Item[] };

// ---------- Quests + journal + books ----------

export const loadActiveQuests = (): { readonly quests: readonly Quest[] } =>
  questsActive as unknown as { readonly quests: readonly Quest[] };
export const loadQuestLog = (): { readonly quests: readonly Quest[] } =>
  questsLog as unknown as { readonly quests: readonly Quest[] };
export const loadQuestTemplates = (): { readonly templates: readonly QuestTemplate[] } =>
  questsTemplates as unknown as { readonly templates: readonly QuestTemplate[] };
export const loadJournalEntries = (): { readonly entries: readonly JournalEntry[] } =>
  journalEntries as unknown as { readonly entries: readonly JournalEntry[] };
export const loadCodex = (): { readonly entries: readonly CodexEntry[] } =>
  booksCodex as unknown as { readonly entries: readonly CodexEntry[] };
export const loadTheVirtuesBook = (): Book => booksTheVirtues as unknown as Book;

// ---------- Dialog ----------

export const loadDialogLordBritish = (): NpcDialog => dialogLordBritish as unknown as NpcDialog;
export const loadDialogIolo = (): NpcDialog => dialogIolo as unknown as NpcDialog;
export const loadDialogBranch = (): NpcDialog => dialogBranch as unknown as NpcDialog;

// ---------- Combat ----------

export const loadCombatState = (): CombatState => combatState as unknown as CombatState;
export const loadAbilities = (): { readonly abilities: readonly Ability[] } =>
  combatAbilities as unknown as { readonly abilities: readonly Ability[] };
export const loadSpellbook = (): Spellbook => combatSpellbook as unknown as Spellbook;
export const loadDragonEncounter = (): CombatState => combatDragon as unknown as CombatState;

// ---------- Economy + crafting ----------

export const loadMarketListings = (): { readonly listings: readonly MarketListing[] } =>
  economyMarketListings as unknown as { readonly listings: readonly MarketListing[] };
export const loadRecipes = (): { readonly recipes: readonly Recipe[] } =>
  craftingRecipes as unknown as { readonly recipes: readonly Recipe[] };
export const loadCraftingStations = (): { readonly stations: readonly CraftingStation[] } =>
  craftingStations as unknown as { readonly stations: readonly CraftingStation[] };

// ---------- Social + chat + voice ----------

export const loadFriends = (): { readonly friends: readonly Friend[] } =>
  socialFriends as unknown as { readonly friends: readonly Friend[] };
export const loadGuild = (): Guild => socialGuild as unknown as Guild;
export const loadChatHistory = (): {
  readonly channels: readonly ChatChannel[];
  readonly messages: readonly ChatMessage[];
} =>
  socialChatHistory as unknown as {
    readonly channels: readonly ChatChannel[];
    readonly messages: readonly ChatMessage[];
  };
export const loadVoiceChannels = (): { readonly channels: readonly VoiceChannel[] } =>
  voiceChannels as unknown as { readonly channels: readonly VoiceChannel[] };

// ---------- Options ----------

export const loadKeybindings = (): Keybindings => optionsKeybindings as unknown as Keybindings;
export const loadAudioOptions = (): AudioOptions => optionsAudio as unknown as AudioOptions;
export const loadVideoOptions = (): VideoOptions => optionsVideo as unknown as VideoOptions;
export const loadAccessibilityOptions = (): AccessibilityOptions =>
  optionsAccessibility as unknown as AccessibilityOptions;
export const loadGameplayOptions = (): GameplayOptions =>
  optionsGameplay as unknown as GameplayOptions;

// ---------- Misc ----------

export const loadLevelUp = (): LevelUpEvent => levelupSample as unknown as LevelUpEvent;
export const loadLoadingScreens = (): LoadingScreenManifest =>
  loadingScreensIndex as unknown as LoadingScreenManifest;
export const loadDiscordPresence = (): RichPresence => discordPresence as unknown as RichPresence;
export const loadCampaignList = (): { readonly campaigns: readonly CampaignSummary[] } =>
  gmCampaignList as unknown as { readonly campaigns: readonly CampaignSummary[] };
export const loadTelemetryAck = (): TelemetryAck =>
  telemetryEventResponse as unknown as TelemetryAck;

// Convenience: surface a Campaign detail fixture by promoting the first
// summary into a fuller-shape Campaign object (still a fixture; real
// campaign service will persist these). Useful for screens that need a
// full Campaign rather than a summary.
export const loadSampleCampaign = (): Campaign => {
  const first = (gmCampaignList as unknown as { campaigns: readonly CampaignSummary[] })
    .campaigns[0];
  if (!first) {
    throw new Error('mocks: gm/campaign-list.json is empty');
  }
  const base: Omit<Campaign, 'nextSessionAt'> = {
    id: first.id,
    name: first.name,
    description: 'A six-session court intrigue. Bring a quill and a strong stomach.',
    state: first.state,
    gm: {
      accountId: 'acct_wisesage' as unknown as Campaign['gm']['accountId'],
      handle: first.gmHandle,
      displayName: 'WiseSage',
      role: 'gm',
      active: true,
      joinedAt: '2026-04-30T00:00:00.000Z',
    },
    participants: [],
    createdAt: '2026-04-30T00:00:00.000Z',
    playtimeSeconds: 18000,
    questModule: 'module_lord_british_banquet',
    tags: first.tags,
    contentWarnings: ['poison', 'court-intrigue'],
    maxPlayers: first.maxPlayers,
    inviteOnly: true,
  };
  // exactOptionalPropertyTypes: only include nextSessionAt if defined.
  return first.nextSessionAt !== undefined
    ? { ...base, nextSessionAt: first.nextSessionAt }
    : (base as Campaign);
};
