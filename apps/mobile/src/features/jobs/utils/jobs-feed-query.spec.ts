import { describe, expect, it } from 'vitest';

import {
  hasActiveListingFilters,
  isCurrentFeedRequest,
  jobsFeedFilterKey,
  jobsFeedQueryFromFilters,
  matchStatusFromResultsView,
} from './jobs-feed-query';

describe('jobsFeedQueryFromFilters', () => {
  it('always requests matched jobs and maps the selected result type', () => {
    expect(
      jobsFeedQueryFromFilters({
        resultsView: 'matched',
        sourceId: 'all',
        savedSearchId: 'all',
      }),
    ).toEqual({ matchedOnly: true, matchStatus: 'verified' });

    expect(
      jobsFeedQueryFromFilters({
        resultsView: 'possible',
        sourceId: 'kariyer_net',
        savedSearchId: 'search-gida',
      }),
    ).toEqual({
      matchedOnly: true,
      matchStatus: 'unverified_source_candidate',
      sourceId: 'kariyer_net',
      savedSearchId: 'search-gida',
    });

    expect(
      jobsFeedQueryFromFilters({
        resultsView: 'all',
        sourceId: 'all',
        savedSearchId: 'all',
      }),
    ).toEqual({ matchedOnly: true });
  });
});

describe('isCurrentFeedRequest', () => {
  it('drops a stale response after a newer filter request starts', () => {
    expect(isCurrentFeedRequest(1, 2)).toBe(false);
    expect(isCurrentFeedRequest(2, 2)).toBe(true);
  });
});

describe('jobsFeedFilterKey', () => {
  it('changes when any listing filter changes', () => {
    expect(
      jobsFeedFilterKey({
        resultsView: 'matched',
        sourceId: 'all',
        savedSearchId: 'all',
      }),
    ).not.toBe(
      jobsFeedFilterKey({
        resultsView: 'possible',
        sourceId: 'all',
        savedSearchId: 'all',
      }),
    );
  });
});

describe('matchStatusFromResultsView', () => {
  it('does not treat unverified listings as verified evidence', () => {
    expect(matchStatusFromResultsView('matched')).toBe('verified');
    expect(matchStatusFromResultsView('possible')).toBe(
      'unverified_source_candidate',
    );
    expect(matchStatusFromResultsView('all')).toBeUndefined();
  });
});

describe('hasActiveListingFilters', () => {
  it('treats source and saved-search selections as clearable filters', () => {
    expect(
      hasActiveListingFilters({ sourceId: 'all', savedSearchId: 'all' }),
    ).toBe(false);
    expect(
      hasActiveListingFilters({ sourceId: 'linkedin', savedSearchId: 'all' }),
    ).toBe(true);
    expect(
      hasActiveListingFilters({ sourceId: 'all', savedSearchId: 'search-1' }),
    ).toBe(true);
  });
});
