import { countQueryOutcomes, queryCountsAddUp } from './query-accounting.js';

describe('query accounting', () => {
  it('counts attempted as the sum of completed, blocked, failed, and deferred', () => {
    const counts = countQueryOutcomes([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
    ]);

    expect(counts).toEqual({
      attempted: 16,
      completed: 9,
      blocked: 7,
      failed: 0,
      deferred: 0,
    });
    expect(queryCountsAddUp(counts)).toBe(true);
  });
});
