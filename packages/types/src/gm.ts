// Mirrors future protobuf message CampaignService; hand-written for now.
//
// Reference: Doc #42 — three game modes; this file covers Mode C (GM Campaign).

import type { AccountId, CampaignId, Iso8601 } from './common';

export type CampaignState =
  | 'DRAFT'
  | 'INVITED'
  | 'RUNNING'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'ARCHIVED'
  | 'DELETED';

export interface CampaignParticipant {
  readonly accountId: AccountId;
  readonly handle: string;
  readonly displayName: string;
  readonly role: 'gm' | 'player';
  readonly active: boolean;
  readonly joinedAt: Iso8601;
}

export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly description: string;
  readonly state: CampaignState;
  readonly gm: CampaignParticipant;
  readonly participants: readonly CampaignParticipant[];
  readonly createdAt: Iso8601;
  readonly lastSessionAt?: Iso8601;
  readonly nextSessionAt?: Iso8601;
  readonly playtimeSeconds: number;
  readonly questModule: string;
  readonly tags: readonly string[];
  readonly contentWarnings: readonly string[];
  readonly maxPlayers: number;
  readonly inviteOnly: boolean;
}

/** Lightweight summary used in lobbies / browse views. */
export interface CampaignSummary {
  readonly id: CampaignId;
  readonly name: string;
  readonly state: CampaignState;
  readonly gmHandle: string;
  readonly playerCount: number;
  readonly maxPlayers: number;
  readonly tags: readonly string[];
  readonly nextSessionAt?: Iso8601;
}
