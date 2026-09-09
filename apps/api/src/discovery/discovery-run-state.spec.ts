import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MemoryDiscoveryRunStateStore,
  nextDetailAttemptAt,
  shouldRetireDetailJob,
} from './discovery-run-state.js';
import { DEFAULT_MAX_DETAIL_ATTEMPTS } from './detail-candidates.js';
import { clampNonNegativeIndex, shouldWriteQueryCursor } from './detail-queue-claim.js';

const sample = {
  jobId: 'job-1',
  sourceId: 'kariyer_net' as const,
  sourceJobId: 'ext-1',
  sourceUrl: 'https://www.kariyer.net/is-ilani/ext-1',
  priority: 2,
  reason: 'catalog_empty' as const,
  queryTermKind: 'profession_variant' as const,
  queryTerm: 'Gıda Mühendisliği',
  queryLocation: 'Manisa',
};

describe('MemoryDiscoveryRunStateStore', () => {
  it('upserts a single queue row and can raise priority', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample]);
    await store.enqueueDetails([{ ...sample, priority: 0, reason: 'profession_variant' }]);
    expect(store.queue.size).toBe(1);
    expect(store.queue.get('job-1')?.priority).toBe(0);
    expect(store.queue.get('job-1')?.reason).toBe('profession_variant');
  });

  it('applies backoff and retires after the maximum attempts', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample]);
    const now = Date.parse('2026-09-09T12:00:00.000Z');

    await store.failDetail('job-1', 'empty', new Date(now).toISOString());
    expect(store.queue.get('job-1')?.attempts).toBe(1);
    expect(store.queue.get('job-1')?.status).toBe('pending');
    expect(store.queue.get('job-1')?.leaseExpiresAt).toBeNull();
    expect(store.queue.get('job-1')?.nextAttemptAt).toBe(
      nextDetailAttemptAt(1, now),
    );

    await store.failDetail('job-1', 'empty', store.queue.get('job-1')?.nextAttemptAt ?? '');
    await store.failDetail('job-1', 'empty', store.queue.get('job-1')?.nextAttemptAt ?? '');
    expect(store.queue.get('job-1')?.attempts).toBe(DEFAULT_MAX_DETAIL_ATTEMPTS);
    expect(shouldRetireDetailJob(store.queue.get('job-1')?.attempts ?? 0)).toBe(true);
    expect(store.queue.get('job-1')?.status).toBe('failed');
  });

  it('drops query cursors when a saved search is deleted', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.writeQueryCursor(
      'search-1',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: 4 },
      0,
    );
    await store.writeQueryCursor(
      'search-2',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: 1 },
      0,
    );

    await store.deleteCursorsForSearch('search-1');

    expect(store.cursors.has('search-1:kariyer_net')).toBe(false);
    expect(store.cursors.get('search-2:kariyer_net')?.nextIndex).toBe(1);
  });

  it('reclaims an in-progress job after the lease expires', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample]);
    const now = '2099-01-01T00:00:00.000Z';
    const first = await store.listDueDetails(
      'kariyer_net',
      now,
      1,
    );
    expect(first).toHaveLength(1);
    expect(first[0]?.status).toBe('in_progress');

    const stillLeased = await store.listDueDetails(
      'kariyer_net',
      '2099-01-01T00:01:00.000Z',
      1,
    );
    expect(stillLeased).toEqual([]);

    const afterCrash = await store.listDueDetails(
      'kariyer_net',
      '2099-01-01T00:03:00.000Z',
      1,
    );
    expect(afterCrash.map((item) => item.jobId)).toEqual(['job-1']);
  });

  it('does not let a second worker claim a leased job', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample]);
    const now = '2099-01-01T00:00:00.000Z';
    const first = await store.listDueDetails('kariyer_net', now, 1);
    const second = await store.listDueDetails('kariyer_net', now, 1);
    expect(first.map((item) => item.jobId)).toEqual(['job-1']);
    expect(second).toEqual([]);
  });

  it('does not return the same jobId from two concurrent claims', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample]);
    const now = '2099-01-01T00:00:00.000Z';
    const [left, right] = await Promise.all([
      store.listDueDetails('kariyer_net', now, 1),
      store.listDueDetails('kariyer_net', now, 1),
    ]);
    const ids = [...left, ...right].map((item) => item.jobId);
    expect(ids).toEqual(['job-1']);
  });

  it('clears the queue row on success and keeps backoff metadata together on failure', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.enqueueDetails([sample, { ...sample, jobId: 'job-2', sourceJobId: 'ext-2' }]);
    const now = '2099-01-01T00:00:00.000Z';
    const claimed = await store.listDueDetails('kariyer_net', now, 1);
    const claimedId = claimed[0]?.jobId ?? '';
    await store.completeDetail(claimedId);
    expect(store.queue.has(claimedId)).toBe(false);

    const leftover = await store.listDueDetails('kariyer_net', now, 1);
    await store.failDetail(leftover[0]?.jobId ?? '', 'empty', now);
    const failed = store.queue.get(leftover[0]?.jobId ?? '');
    expect(failed?.status).toBe('pending');
    expect(failed?.attempts).toBe(1);
    expect(failed?.nextAttemptAt).toBe(nextDetailAttemptAt(1, Date.parse(now)));
    expect(failed?.leaseExpiresAt).toBeNull();
  });

  it('does not store a negative query cursor index', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.writeQueryCursor(
      'search-1',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: -4 },
      0,
    );
    expect(store.cursors.get('search-1:kariyer_net')?.nextIndex).toBe(0);
    expect(clampNonNegativeIndex(-4)).toBe(0);
  });

  it('does not let a stale cursor write pull next_index backward', async () => {
    const store = new MemoryDiscoveryRunStateStore();
    await store.writeQueryCursor(
      'search-1',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: 9 },
      0,
    );
    await store.writeQueryCursor(
      'search-1',
      'kariyer_net',
      { fingerprint: 'fp', nextIndex: 5 },
      0,
    );
    expect(store.cursors.get('search-1:kariyer_net')?.nextIndex).toBe(9);
    expect(
      shouldWriteQueryCursor({
        existing: { fingerprint: 'fp', nextIndex: 9 },
        next: { fingerprint: 'fp', nextIndex: 5 },
        observedNextIndex: 0,
      }),
    ).toBe(false);
  });
});

describe('job detail fetch queue migration', () => {
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../../docs/JOB_DETAIL_FETCH_QUEUE.sql'),
    'utf8',
  );

  it('cascades cursor rows when a saved search is deleted', () => {
    expect(sql).toContain('references public.saved_searches (id)');
    expect(sql).toContain('on delete cascade');
  });

  it('claims due work with skip locked and a lease', () => {
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain('lease_expires_at');
    expect(sql).toContain('create or replace function public.claim_job_detail_fetch');
    expect(sql).toContain('revoke all on function public.claim_job_detail_fetch');
    expect(sql).toContain('to service_role');
  });

  it('keeps next_index and attempts non-negative', () => {
    expect(sql).toContain('check (next_index >= 0)');
    expect(sql).toContain('check (attempts >= 0)');
  });
});
