// Thin wrapper around @br/mocks fixtures for synchronous SSG usage.
// We don't run the MockClient/MSW pipeline at build time — we just read the
// raw JSON via the fixtures barrel, which is identical content.

import { fixtures } from '@br/mocks';
import type { Shard, ShardStatusSnapshot } from '@br/types';

export function loadShards(): readonly Shard[] {
  return fixtures.loadShards().shards;
}

export function loadShardStatus(): readonly ShardStatusSnapshot[] {
  return fixtures.loadShardStatus().snapshots;
}

export function shardStatusFor(
  id: string,
  snapshots: readonly ShardStatusSnapshot[],
): ShardStatusSnapshot | undefined {
  return snapshots.find((s) => s.id === id);
}
