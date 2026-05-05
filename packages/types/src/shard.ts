// Mirrors future protobuf message ShardService; hand-written for now.
//
// Reference: Doc #6 §2 (Order vs Chaos shards) and Doc #42 (GM mode is a
// per-campaign instance, exposed in shard listing for surfacing.)

import type { Iso8601, RegionId, ShardId } from './common';

export type ShardKind = 'order' | 'chaos' | 'gm';

export type ShardStatus = 'online' | 'maintenance' | 'degraded' | 'offline' | 'queue';

export interface Shard {
  readonly id: ShardId;
  readonly name: string;
  readonly kind: ShardKind;
  readonly region: 'na-east' | 'na-west' | 'eu-west' | 'eu-central' | 'apac' | 'sa';
  readonly status: ShardStatus;
  readonly population: number;
  readonly capacity: number;
  readonly tickRateHz: number;
  readonly serverVersion: string;
  readonly createdAt: Iso8601;
  readonly motd: string;
  readonly regions: readonly RegionId[];
  readonly description: string;
}

/** Lightweight shard summary used in lists. */
export interface ShardSummary {
  readonly id: ShardId;
  readonly name: string;
  readonly kind: ShardKind;
  readonly status: ShardStatus;
  readonly population: number;
  readonly capacity: number;
  readonly latencyHintMs: number;
}

/** Per-shard live status snapshot (used by /shards/status). */
export interface ShardStatusSnapshot {
  readonly id: ShardId;
  readonly status: ShardStatus;
  readonly population: number;
  readonly queueLength: number;
  readonly tickP99Ms: number;
  readonly uptimeSeconds: number;
  readonly lastChecked: Iso8601;
  readonly health: 'green' | 'amber' | 'red';
}
