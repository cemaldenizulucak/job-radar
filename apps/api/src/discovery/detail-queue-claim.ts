import type { DetailQueueItem } from './discovery-run-state.js';

export const DEFAULT_DETAIL_CLAIM_LEASE_MS = 120_000;

export function isDetailQueueClaimable(
  item: Pick<DetailQueueItem, 'status' | 'nextAttemptAt' | 'leaseExpiresAt'>,
  nowIso: string,
): boolean {
  if (item.status === 'failed') {
    return false;
  }

  if (item.status === 'pending') {
    return item.nextAttemptAt <= nowIso;
  }

  return Boolean(item.leaseExpiresAt && item.leaseExpiresAt <= nowIso);
}

export function compareDetailQueueOrder(
  left: Pick<DetailQueueItem, 'priority' | 'nextAttemptAt' | 'jobId'>,
  right: Pick<DetailQueueItem, 'priority' | 'nextAttemptAt' | 'jobId'>,
): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  if (left.nextAttemptAt !== right.nextAttemptAt) {
    return left.nextAttemptAt.localeCompare(right.nextAttemptAt);
  }
  return left.jobId.localeCompare(right.jobId);
}

export function selectClaimableDetailJobs(
  items: readonly DetailQueueItem[],
  input: { sourceId: DetailQueueItem['sourceId']; nowIso: string; limit: number },
): DetailQueueItem[] {
  return items
    .filter(
      (item) =>
        item.sourceId === input.sourceId && isDetailQueueClaimable(item, input.nowIso),
    )
    .sort(compareDetailQueueOrder)
    .slice(0, Math.max(0, input.limit));
}

export function leaseExpiresAtFrom(nowIso: string, leaseMs = DEFAULT_DETAIL_CLAIM_LEASE_MS): string {
  return new Date(Date.parse(nowIso) + leaseMs).toISOString();
}

export function clampNonNegativeIndex(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function shouldWriteQueryCursor(input: {
  existing: { fingerprint: string; nextIndex: number } | undefined;
  next: { fingerprint: string; nextIndex: number };
  observedNextIndex: number;
}): boolean {
  if (!input.existing) {
    return true;
  }
  if (input.existing.fingerprint !== input.next.fingerprint) {
    return true;
  }
  return input.existing.nextIndex === input.observedNextIndex;
}
