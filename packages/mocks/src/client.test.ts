// Trivial happy-path test for MockClient. Exercises one route per HTTP verb
// to confirm the route-table → loader pipeline works end-to-end.

import type { LoginResponse, Me, Shard } from '@br/types';
import { describe, expect, it } from 'vitest';
import { MockClient } from './client';

describe('MockClient', () => {
  const client = new MockClient({ latencyMs: 0 });

  it('GET /v1/auth/me returns the Me fixture', async () => {
    const me = await client.get<Me>('/v1/auth/me');
    expect(me.handle).toBe('thestranger');
    expect(me.emailVerified).toBe(true);
    expect(me.avatarIds.length).toBeGreaterThan(0);
  });

  it('POST /v1/auth/login returns a session and Me payload', async () => {
    const res = await client.post<LoginResponse>('/v1/auth/login', {
      email: 'stranger@britannia.example',
      password: 'mock',
    });
    expect(res.session.protocolVersion).toBe(1);
    expect(res.me.handle).toBe('thestranger');
  });

  it('GET /v1/shards lists at least one Order shard', async () => {
    const res = await client.get<{ shards: readonly Shard[] }>('/v1/shards');
    expect(res.shards.length).toBeGreaterThan(0);
    expect(res.shards.some((s) => s.kind === 'order')).toBe(true);
  });

  it('throws MockClientError for an unknown route', async () => {
    await expect(client.get('/v1/no-such-route')).rejects.toMatchObject({
      name: 'MockClientError',
      status: 404,
    });
  });

  it('failure mode short-circuits with MockFailure', async () => {
    client.setFailureMode('server');
    await expect(client.get('/v1/auth/me')).rejects.toMatchObject({
      name: 'MockFailure',
      status: 500,
    });
    client.setFailureMode(null);
  });
});
