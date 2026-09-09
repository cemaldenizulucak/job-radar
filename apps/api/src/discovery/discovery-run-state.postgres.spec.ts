import { PostgresDiscoveryRunStateStore } from './discovery-run-state.postgres.js';

type RpcCall = { name: string; args: Record<string, unknown> };

function createStore(
  options: {
    rpc?: (name: string, args: Record<string, unknown>) => { data: unknown; error: null } | { data: null; error: { message: string } };
    updatePayloads?: Record<string, unknown>[];
  } = {},
) {
  const rpcCalls: RpcCall[] = [];
  const updatePayloads = options.updatePayloads ?? [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return options.rpc
        ? options.rpc(name, args)
        : { data: [], error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { attempts: 0, next_attempt_at: '2026-09-09T12:00:00.000Z' },
              error: null,
            }),
          }),
          maybeSingle: async () => ({
            data: { attempts: 0, next_attempt_at: '2026-09-09T12:00:00.000Z' },
            error: null,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return {
          eq: async () => ({ error: null }),
        };
      },
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  };

  const store = new PostgresDiscoveryRunStateStore({
    getClient: () => client,
  } as never);

  return { store, rpcCalls, updatePayloads };
}

describe('PostgresDiscoveryRunStateStore', () => {
  it('claims due rows through the service-role RPC', async () => {
    const { store, rpcCalls } = createStore({
      rpc: () => ({
        data: [
          {
            job_id: 'job-1',
            source_id: 'kariyer_net',
            source_job_id: 'ext-1',
            source_url: 'https://www.kariyer.net/is-ilani/ext-1',
            priority: 0,
            reason: 'profession_variant',
            query_term_kind: 'profession_variant',
            query_term: 'Gıda Mühendisliği',
            query_location: 'Manisa',
            attempts: 0,
            next_attempt_at: '2026-09-09T12:00:00.000Z',
            status: 'in_progress',
            last_error_category: null,
            lease_expires_at: '2026-09-09T12:02:00.000Z',
          },
        ],
        error: null,
      }),
    });

    const claimed = await store.listDueDetails(
      'kariyer_net',
      '2026-09-09T12:00:00.000Z',
      8,
    );

    expect(rpcCalls[0]?.name).toBe('claim_job_detail_fetch');
    expect(rpcCalls[0]?.args).toMatchObject({
      p_source_id: 'kariyer_net',
      p_limit: 8,
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.status).toBe('in_progress');
    expect(claimed[0]?.leaseExpiresAt).toBe('2026-09-09T12:02:00.000Z');
  });

  it('writes cursors through the compare-and-swap RPC and clamps negatives', async () => {
    const { store, rpcCalls } = createStore();
    await store.writeQueryCursor(
      '11111111-1111-1111-1111-111111111111',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: -2 },
      0,
    );
    expect(rpcCalls[0]?.name).toBe('upsert_discovery_query_cursor');
    expect(rpcCalls[0]?.args.p_next_index).toBe(0);
    expect(rpcCalls[0]?.args.p_observed_next_index).toBe(0);
  });

  it('updates attempts, next_attempt_at, status, and lease together on failure', async () => {
    const updatePayloads: Record<string, unknown>[] = [];
    const { store } = createStore({ updatePayloads });
    await store.failDetail('job-1', 'empty', '2026-09-09T12:00:00.000Z');
    expect(updatePayloads[0]).toMatchObject({
      attempts: 1,
      last_error_category: 'empty',
      status: 'pending',
      lease_expires_at: null,
    });
    expect(updatePayloads[0]?.next_attempt_at).toEqual(expect.any(String));
    expect(updatePayloads[0]?.updated_at).toBe('2026-09-09T12:00:00.000Z');
  });
});
