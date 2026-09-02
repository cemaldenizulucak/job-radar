import { beforeEach, describe, expect, it } from 'vitest';

import { useJobsSeenStore } from './jobs-seen.store';

describe('useJobsSeenStore', () => {
  beforeEach(() => {
    useJobsSeenStore.setState({ seenById: {} });
  });

  it('marks a job seen so unread styling can clear without a reload', () => {
    useJobsSeenStore.getState().markSeen('job-1');
    expect(useJobsSeenStore.getState().seenById['job-1']).toBe(true);

    useJobsSeenStore.getState().unmarkSeen('job-1');
    expect(useJobsSeenStore.getState().seenById['job-1']).toBeUndefined();
  });
});
