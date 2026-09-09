import type { SourceId } from '../common/domain.types.js';
import { DEFAULT_MAX_DETAIL_ATTEMPTS, DETAIL_RETRY_BACKOFF_MS } from './detail-candidates.js';
import {
  clampNonNegativeIndex,
  isDetailQueueClaimable,
  leaseExpiresAtFrom,
  selectClaimableDetailJobs,
  shouldWriteQueryCursor,
} from './detail-queue-claim.js';
import type { SearchSourceCursor } from './discovery-scan-cursor.js';

export type DetailQueueStatus = 'pending' | 'in_progress' | 'failed';

export type DetailQueueReason =
  | 'profession_variant'
  | 'user_query'
  | 'catalog_empty'
  | 'backfill';

export type DetailQueueItem = {
  jobId: string;
  sourceId: SourceId;
  sourceJobId: string;
  sourceUrl: string;
  priority: number;
  reason: DetailQueueReason;
  queryTermKind: 'user' | 'profession_variant' | null;
  queryTerm: string | null;
  queryLocation: string | null;
  attempts: number;
  nextAttemptAt: string;
  status: DetailQueueStatus;
  lastErrorCategory: string | null;
  leaseExpiresAt: string | null;
};

export type DetailQueueEnqueueInput = {
  jobId: string;
  sourceId: SourceId;
  sourceJobId: string;
  sourceUrl: string;
  priority: number;
  reason: DetailQueueReason;
  queryTermKind: 'user' | 'profession_variant' | null;
  queryTerm: string | null;
  queryLocation: string | null;
};

export abstract class DiscoveryRunStateStore {
  abstract readQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    fingerprint: string,
  ): Promise<SearchSourceCursor>;

  abstract writeQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    cursor: SearchSourceCursor,
    observedNextIndex: number,
  ): Promise<void>;

  abstract deleteCursorsForSearch(savedSearchId: string): Promise<void>;

  abstract enqueueDetails(
    items: readonly DetailQueueEnqueueInput[],
  ): Promise<{ queuedCount: number }>;

  abstract listDueDetails(
    sourceId: SourceId,
    nowIso: string,
    limit: number,
  ): Promise<DetailQueueItem[]>;

  abstract completeDetail(jobId: string): Promise<void>;

  abstract failDetail(
    jobId: string,
    errorCategory: string,
    nowIso: string,
  ): Promise<void>;

  abstract listQueueItems(): Promise<DetailQueueItem[]>;
}

export function nextDetailAttemptAt(
  attemptsAfterFailure: number,
  nowMs: number,
): string {
  const wait =
    DETAIL_RETRY_BACKOFF_MS[
      Math.min(Math.max(attemptsAfterFailure, 1), DETAIL_RETRY_BACKOFF_MS.length) - 1
    ] ?? DETAIL_RETRY_BACKOFF_MS[DETAIL_RETRY_BACKOFF_MS.length - 1];
  return new Date(nowMs + wait).toISOString();
}

export function shouldRetireDetailJob(attempts: number): boolean {
  return attempts >= DEFAULT_MAX_DETAIL_ATTEMPTS;
}

export class MemoryDiscoveryRunStateStore extends DiscoveryRunStateStore {
  readonly cursors = new Map<string, SearchSourceCursor>();
  readonly queue = new Map<string, DetailQueueItem>();
  private claiming: Promise<void> = Promise.resolve();

  async readQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    fingerprint: string,
  ): Promise<SearchSourceCursor> {
    const existing = this.cursors.get(`${savedSearchId}:${sourceId}`);
    if (!existing || existing.fingerprint !== fingerprint) {
      return { fingerprint, nextIndex: 0 };
    }
    return existing;
  }

  async writeQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    cursor: SearchSourceCursor,
    observedNextIndex: number,
  ): Promise<void> {
    const key = `${savedSearchId}:${sourceId}`;
    const next = {
      fingerprint: cursor.fingerprint,
      nextIndex: clampNonNegativeIndex(cursor.nextIndex),
    };
    if (
      !shouldWriteQueryCursor({
        existing: this.cursors.get(key),
        next,
        observedNextIndex: clampNonNegativeIndex(observedNextIndex),
      })
    ) {
      return;
    }
    this.cursors.set(key, next);
  }

  async deleteCursorsForSearch(savedSearchId: string): Promise<void> {
    const prefix = `${savedSearchId}:`;
    for (const key of [...this.cursors.keys()]) {
      if (key.startsWith(prefix)) {
        this.cursors.delete(key);
      }
    }
  }

  async enqueueDetails(
    items: readonly DetailQueueEnqueueInput[],
  ): Promise<{ queuedCount: number }> {
    let queuedCount = 0;
    const now = new Date().toISOString();
    for (const item of items) {
      const existing = this.queue.get(item.jobId);
      if (!existing) {
        this.queue.set(item.jobId, {
          ...item,
          attempts: 0,
          nextAttemptAt: now,
          status: 'pending',
          lastErrorCategory: null,
          leaseExpiresAt: null,
        });
        queuedCount += 1;
        continue;
      }

      if (item.priority < existing.priority) {
        this.queue.set(item.jobId, {
          ...existing,
          ...item,
          attempts: existing.attempts,
          nextAttemptAt: existing.nextAttemptAt,
          status: existing.status,
          lastErrorCategory: existing.lastErrorCategory,
          leaseExpiresAt: existing.leaseExpiresAt,
        });
      }
    }
    return { queuedCount };
  }

  async listDueDetails(
    sourceId: SourceId,
    nowIso: string,
    limit: number,
  ): Promise<DetailQueueItem[]> {
    let claimed: DetailQueueItem[] = [];
    const run = this.claiming.then(() => {
      claimed = this.claimDueDetailsSync(sourceId, nowIso, limit);
    });
    this.claiming = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
    return claimed;
  }

  async completeDetail(jobId: string): Promise<void> {
    this.queue.delete(jobId);
  }

  async failDetail(
    jobId: string,
    errorCategory: string,
    nowIso: string,
  ): Promise<void> {
    const existing = this.queue.get(jobId);
    if (!existing) {
      return;
    }

    const attempts = existing.attempts + 1;
    const retired = shouldRetireDetailJob(attempts);
    this.queue.set(jobId, {
      ...existing,
      attempts,
      lastErrorCategory: errorCategory,
      status: retired ? 'failed' : 'pending',
      nextAttemptAt: retired
        ? existing.nextAttemptAt
        : nextDetailAttemptAt(attempts, Date.parse(nowIso)),
      leaseExpiresAt: null,
    });
  }

  async listQueueItems(): Promise<DetailQueueItem[]> {
    return [...this.queue.values()];
  }

  private claimDueDetailsSync(
    sourceId: SourceId,
    nowIso: string,
    limit: number,
  ): DetailQueueItem[] {
    const selected = selectClaimableDetailJobs([...this.queue.values()], {
      sourceId,
      nowIso,
      limit,
    });
    const leaseExpiresAt = leaseExpiresAtFrom(nowIso);
    const claimed: DetailQueueItem[] = [];
    for (const item of selected) {
      const current = this.queue.get(item.jobId);
      if (!current || !isDetailQueueClaimable(current, nowIso)) {
        continue;
      }
      const next: DetailQueueItem = {
        ...current,
        status: 'in_progress',
        leaseExpiresAt,
      };
      this.queue.set(item.jobId, next);
      claimed.push(next);
    }
    return claimed;
  }
}
