// Mirrors future protobuf message TelemetryEvent; hand-written for now.
//
// Reference: Doc #28 §2 Event Taxonomy. Strings are intentional here — the
// derivation service emits this enum into Protobuf as a string-typed field
// for forward-compat.

import type { Iso8601, RegionId, ShardId, Uuid } from './common';

export type TelemetryEventKind =
  | 'session_start'
  | 'session_end'
  | 'avatar_create'
  | 'avatar_delete'
  | 'quest_start'
  | 'quest_complete'
  | 'quest_fail'
  | 'virtue_threshold_crossed'
  | 'purchase'
  | 'sale'
  | 'trade_complete'
  | 'recipe_success'
  | 'recipe_failure'
  | 'guild_join'
  | 'trade_initiated'
  | 'dialogue_opened'
  | 'creation_published'
  | 'creation_played'
  | 'creation_rated'
  | 'virtue_severe_drop'
  | 'report_filed'
  | 'guard_engaged'
  | 'event_participated'
  | 'live_arc_stage_advanced'
  | 'client_perf_sample'
  | 'server_perf_sample'
  | 'network_disconnect'
  | 'mcp_invocation'
  // Frontend-originated:
  | 'page_view'
  | 'ui_action'
  | 'ui_error';

export interface TelemetryEvent {
  readonly eventId: Uuid;
  readonly eventType: TelemetryEventKind;
  readonly timestamp: Iso8601;
  readonly shardId?: ShardId;
  readonly regionId?: RegionId;
  /** SHA-256(player_id || shard_salt). Computed at the gateway, not the client. */
  readonly actorAnonId: string;
  readonly sessionAnonId?: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly piiRedacted: boolean;
  readonly schemaVersion: number;
  /** Optional active-experiment arms map (Doc #28 §9). */
  readonly experiments?: Readonly<Record<string, string>>;
}

export interface TelemetryAck {
  readonly accepted: number;
  readonly rejected: number;
  readonly receivedAt: Iso8601;
  readonly rejectedReasons: readonly { readonly eventId: Uuid; readonly reason: string }[];
}
