import {
  addQueryCounts,
  countQueryOutcomes,
  queryAttemptedWithinBudget,
  queryCountsAddUp,
} from './query-accounting.js';

describe('query accounting', () => {
  it('counts attempted as provider calls, not deferred leftovers', () => {
    const counts = countQueryOutcomes([
      'completed',
      'completed',
      'blocked',
      'deferred',
      'deferred',
      'partial_blocked',
      'failed',
    ]);

    expect(counts).toEqual({
      planned: 7,
      attempted: 5,
      completed: 2,
      blocked: 1,
      failed: 1,
      deferred: 2,
      partialBlocked: 1,
    });
    expect(queryCountsAddUp(counts)).toBe(true);
  });

  it('keeps a partial challenge in its own class instead of completed+blocked', () => {
    const counts = countQueryOutcomes(['partial_blocked', 'deferred', 'deferred']);

    expect(counts.attempted).toBe(1);
    expect(counts.completed).toBe(0);
    expect(counts.blocked).toBe(0);
    expect(counts.partialBlocked).toBe(1);
    expect(counts.deferred).toBe(2);
    expect(counts.planned).toBe(3);
    expect(queryCountsAddUp(counts)).toBe(true);
  });

  it('enforces attempted <= configured hourly budget', () => {
    expect(queryAttemptedWithinBudget(1, 4)).toBe(true);
    expect(queryAttemptedWithinBudget(4, 4)).toBe(true);
    expect(queryAttemptedWithinBudget(5, 4)).toBe(false);
  });

  it('adds disjoint partitions independently', () => {
    const summed = addQueryCounts(
      countQueryOutcomes(['completed', 'deferred']),
      countQueryOutcomes(['partial_blocked']),
    );

    expect(summed).toEqual({
      planned: 3,
      attempted: 2,
      completed: 1,
      blocked: 0,
      failed: 0,
      deferred: 1,
      partialBlocked: 1,
    });
    expect(queryCountsAddUp(summed)).toBe(true);
  });
});
