export type QueryUnitOutcome =
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'deferred'
  | 'partial_blocked';

/**
 * Query telemetry partition (run-level, after cross-user dedup):
 *
 *   queriesPlanned   = unique candidate queries
 *   queriesAttempted = queries actually sent to the provider
 *   queriesDeferred  = planned queries never sent (hourly budget, circuit, time budget)
 *
 *   queriesPlanned = queriesAttempted + queriesDeferred
 *
 * Attempted queries are partitioned into disjoint outcomes:
 *
 *   queriesAttempted =
 *     queriesCompleted + queriesBlocked + queriesFailed + queriesPartialBlocked
 *
 * - completed: finished with a full or defined successful result (no later-page challenge)
 * - blocked: failed immediately with a challenge / circuit-break (no usable listing page)
 * - failed: non-challenge provider error
 * - partial_blocked: at least one listing page succeeded, then a later page hit a challenge.
 *   Jobs from successful pages are kept. This is NOT also counted as completed or blocked.
 * - deferred: never sent to the provider
 */
export type QueryUnitCounts = {
  planned: number;
  attempted: number;
  completed: number;
  blocked: number;
  failed: number;
  deferred: number;
  partialBlocked: number;
};

export const EMPTY_QUERY_COUNTS: QueryUnitCounts = {
  planned: 0,
  attempted: 0,
  completed: 0,
  blocked: 0,
  failed: 0,
  deferred: 0,
  partialBlocked: 0,
};

export function countQueryOutcomes(
  outcomes: readonly QueryUnitOutcome[],
): QueryUnitCounts {
  const counts = { ...EMPTY_QUERY_COUNTS };
  for (const outcome of outcomes) {
    if (outcome === 'partial_blocked') {
      counts.partialBlocked += 1;
    } else {
      counts[outcome] += 1;
    }
  }
  counts.attempted =
    counts.completed + counts.blocked + counts.failed + counts.partialBlocked;
  counts.planned = counts.attempted + counts.deferred;
  return counts;
}

export function queryCountsAddUp(counts: QueryUnitCounts): boolean {
  return (
    counts.planned === counts.attempted + counts.deferred &&
    counts.attempted ===
      counts.completed +
        counts.blocked +
        counts.failed +
        counts.partialBlocked
  );
}

export function queryAttemptedWithinBudget(
  attempted: number,
  budget: number,
): boolean {
  return attempted <= budget;
}

export function addQueryCounts(
  left: QueryUnitCounts,
  right: QueryUnitCounts,
): QueryUnitCounts {
  return {
    planned: left.planned + right.planned,
    attempted: left.attempted + right.attempted,
    completed: left.completed + right.completed,
    blocked: left.blocked + right.blocked,
    failed: left.failed + right.failed,
    deferred: left.deferred + right.deferred,
    partialBlocked: left.partialBlocked + right.partialBlocked,
  };
}

export function toQueryTelemetry(counts: QueryUnitCounts): {
  queriesPlanned: number;
  queriesAttempted: number;
  queriesCompleted: number;
  queriesBlocked: number;
  queriesFailed: number;
  queriesDeferred: number;
  queriesPartialBlocked: number;
} {
  return {
    queriesPlanned: counts.planned,
    queriesAttempted: counts.attempted,
    queriesCompleted: counts.completed,
    queriesBlocked: counts.blocked,
    queriesFailed: counts.failed,
    queriesDeferred: counts.deferred,
    queriesPartialBlocked: counts.partialBlocked,
  };
}
