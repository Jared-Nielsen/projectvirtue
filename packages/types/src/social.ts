// Mirrors future protobuf message SocialService; hand-written for now.

import type { ChannelId, CharacterId, FriendId, GuildId, Iso8601 } from './common';

export type FriendStatus = 'online' | 'offline' | 'away' | 'busy' | 'invisible';

export interface Friend {
  readonly id: FriendId;
  readonly characterId: CharacterId;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string;
  readonly status: FriendStatus;
  readonly note: string;
  readonly favorite: boolean;
  readonly lastSeen: Iso8601;
  readonly currentShard?: string;
  readonly currentRegion?: string;
}

export type GuildRole = 'leader' | 'officer' | 'veteran' | 'member' | 'recruit';

export interface GuildMember {
  readonly characterId: CharacterId;
  readonly handle: string;
  readonly displayName: string;
  readonly role: GuildRole;
  readonly joinedAt: Iso8601;
  readonly lastSeen: Iso8601;
  readonly contributionPoints: number;
}

export interface Guild {
  readonly id: GuildId;
  readonly name: string;
  readonly tag: string;
  readonly motto: string;
  readonly description: string;
  readonly heraldryUrl: string;
  readonly foundedAt: Iso8601;
  readonly homeShard: string;
  readonly homeRegion: string;
  readonly memberCount: number;
  readonly members: readonly GuildMember[];
  readonly publicCharter: boolean;
  readonly discordLinked: boolean;
}

export type ChatChannelKind = 'local' | 'global' | 'guild' | 'party' | 'whisper' | 'system';

export interface ChatChannel {
  readonly id: ChannelId;
  readonly kind: ChatChannelKind;
  readonly name: string;
  readonly muted: boolean;
}

export interface ChatMessage {
  readonly id: string;
  readonly channelId: ChannelId;
  readonly channelKind: ChatChannelKind;
  readonly senderHandle: string;
  readonly senderDisplayName: string;
  readonly senderRole?: GuildRole;
  readonly body: string;
  readonly sentAt: Iso8601;
  readonly system: boolean;
}
