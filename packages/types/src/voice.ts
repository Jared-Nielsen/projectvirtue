// Mirrors future protobuf message VoiceService; hand-written for now.
//
// Reference: Doc #37 Voice Chat. The web client uses LiveKit at runtime; the
// JSON shape below is what the gateway returns for channel discovery and
// participant listings (transport details — tokens, ICE — are out of band).

import type { ChannelId, CharacterId, Iso8601 } from './common';

export type VoiceChannelKind = 'proximity' | 'party' | 'guild' | 'campaign' | 'system';

export interface VoiceParticipant {
  readonly characterId: CharacterId;
  readonly handle: string;
  readonly displayName: string;
  readonly muted: boolean;
  readonly deafened: boolean;
  readonly speaking: boolean;
  readonly volume: number;
  readonly joinedAt: Iso8601;
}

export interface VoiceChannel {
  readonly id: ChannelId;
  readonly kind: VoiceChannelKind;
  readonly name: string;
  readonly capacity: number;
  readonly pushToTalk: boolean;
  readonly bitrateKbps: number;
  readonly participants: readonly VoiceParticipant[];
  readonly active: boolean;
  readonly regionTag?: string;
}
