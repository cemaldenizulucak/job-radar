import { queryUnitKey, type SourceQueryUnit } from './source-query-plan.js';

export type SourceQueryConsumer = {
  searchId: string;
  userId: string;
};

export type UniqueSourceQuery = {
  key: string;
  unit: SourceQueryUnit;
  consumers: SourceQueryConsumer[];
};

export type QuerySchedule = {
  selected: UniqueSourceQuery[];
  deferred: UniqueSourceQuery[];
  nextRoundRobinOffset: number;
};

/**
 * Same normalized keyword+location is one source HTTP call, even when
 * several users/searches asked for it.
 */
export function collectUniqueSourceQueries(
  items: readonly {
    userId: string;
    searchId: string;
    unit: SourceQueryUnit;
  }[],
): UniqueSourceQuery[] {
  const byKey = new Map<string, UniqueSourceQuery>();

  for (const item of items) {
    const key = queryUnitKey(item.unit);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        key,
        unit: item.unit,
        consumers: [{ searchId: item.searchId, userId: item.userId }],
      });
      continue;
    }

    if (
      !existing.consumers.some(
        (consumer) =>
          consumer.searchId === item.searchId && consumer.userId === item.userId,
      )
    ) {
      existing.consumers.push({ searchId: item.searchId, userId: item.userId });
    }
  }

  return [...byKey.values()];
}

/**
 * Fair hourly selection: rotate which user is served first, pick at most
 * `budget` unique queries, and leave the rest deferred for later hours.
 */
export function scheduleQueriesRoundRobin(input: {
  queries: readonly UniqueSourceQuery[];
  budget: number;
  roundRobinOffset: number;
}): QuerySchedule {
  const queries = [...input.queries];
  const budget = Math.max(0, input.budget);
  if (queries.length === 0 || budget === 0) {
    return {
      selected: [],
      deferred: queries,
      nextRoundRobinOffset: input.roundRobinOffset,
    };
  }

  const userIds = uniqueUserIds(queries);
  const start =
    userIds.length === 0
      ? 0
      : ((input.roundRobinOffset % userIds.length) + userIds.length) %
        userIds.length;
  const queues = perUserQueues(queries, userIds);
  const selected: UniqueSourceQuery[] = [];
  const selectedKeys = new Set<string>();
  let emptyRounds = 0;
  let cursor = 0;

  while (selected.length < budget && emptyRounds < userIds.length) {
    const userId = userIds[(start + cursor) % userIds.length];
    cursor += 1;
    if (!userId) {
      emptyRounds += 1;
      continue;
    }

    const queue = queues.get(userId);
    if (!queue) {
      emptyRounds += 1;
      continue;
    }

    while (queue.length > 0 && selectedKeys.has(queue[0]?.key ?? '')) {
      queue.shift();
    }

    const nextKey = queue.shift()?.key;
    if (!nextKey) {
      emptyRounds += 1;
      continue;
    }

    const query = queries.find((item) => item.key === nextKey);
    if (!query || selectedKeys.has(nextKey)) {
      emptyRounds += 1;
      continue;
    }

    emptyRounds = 0;
    selectedKeys.add(nextKey);
    selected.push(query);
    for (const otherQueue of queues.values()) {
      for (let index = otherQueue.length - 1; index >= 0; index -= 1) {
        if (otherQueue[index]?.key === nextKey) {
          otherQueue.splice(index, 1);
        }
      }
    }
  }

  const deferred = queries.filter((query) => !selectedKeys.has(query.key));
  return {
    selected,
    deferred,
    nextRoundRobinOffset: start + 1,
  };
}

function uniqueUserIds(queries: readonly UniqueSourceQuery[]): string[] {
  const seen = new Set<string>();
  const userIds: string[] = [];
  for (const query of queries) {
    for (const consumer of query.consumers) {
      if (!seen.has(consumer.userId)) {
        seen.add(consumer.userId);
        userIds.push(consumer.userId);
      }
    }
  }
  return userIds.sort((left, right) => left.localeCompare(right));
}

function perUserQueues(
  queries: readonly UniqueSourceQuery[],
  userIds: readonly string[],
): Map<string, UniqueSourceQuery[]> {
  const queues = new Map<string, UniqueSourceQuery[]>();
  for (const userId of userIds) {
    queues.set(
      userId,
      queries.filter((query) =>
        query.consumers.some((consumer) => consumer.userId === userId),
      ),
    );
  }
  return queues;
}
