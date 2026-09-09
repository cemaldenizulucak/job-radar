export type QueryUnitOutcome = 'completed' | 'blocked' | 'failed' | 'deferred';

export type QueryUnitCounts = {
  attempted: number;
  completed: number;
  blocked: number;
  failed: number;
  deferred: number;
};

export const EMPTY_QUERY_COUNTS: QueryUnitCounts = {
  attempted: 0,
  completed: 0,
  blocked: 0,
  failed: 0,
  deferred: 0,
};

export function countQueryOutcomes(
  outcomes: readonly QueryUnitOutcome[],
): QueryUnitCounts {
  const counts = { ...EMPTY_QUERY_COUNTS, attempted: outcomes.length };
  for (const outcome of outcomes) {
    counts[outcome] += 1;
  }
  return counts;
}

export function queryCountsAddUp(counts: QueryUnitCounts): boolean {
  return (
    counts.attempted ===
    counts.completed + counts.blocked + counts.failed + counts.deferred
  );
}

export function addQueryCounts(
  left: QueryUnitCounts,
  right: QueryUnitCounts,
): QueryUnitCounts {
  return {
    attempted: left.attempted + right.attempted,
    completed: left.completed + right.completed,
    blocked: left.blocked + right.blocked,
    failed: left.failed + right.failed,
    deferred: left.deferred + right.deferred,
  };
}
