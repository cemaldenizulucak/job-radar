import { describe, expect, it } from 'vitest';

import { diffJobSearchMatches } from './match-reevaluation.js';

describe('diffJobSearchMatches', () => {
  it('keeps shared rows and reports inserts and deletes', () => {
    const diff = diffJobSearchMatches(
      [
        { jobId: 'job-keep', savedSearchId: 'search-1' },
        { jobId: 'job-stale', savedSearchId: 'search-1' },
      ],
      [
        { jobId: 'job-keep', savedSearchId: 'search-1' },
        { jobId: 'job-new', savedSearchId: 'search-1' },
      ],
    );

    expect(diff.keep).toEqual([
      { jobId: 'job-keep', savedSearchId: 'search-1' },
    ]);
    expect(diff.insert).toEqual([
      { jobId: 'job-new', savedSearchId: 'search-1' },
    ]);
    expect(diff.remove).toEqual([
      { jobId: 'job-stale', savedSearchId: 'search-1' },
    ]);
  });
});
