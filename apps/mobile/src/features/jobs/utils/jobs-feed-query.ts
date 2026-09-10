import type { JobsResultsView } from '../stores/jobs-filter.store';
import type { JobSourceId } from '../types/job.types';

export type JobsFeedFilters = {
  sourceId: JobSourceId | 'all';
  savedSearchId: string | 'all';
  resultsView: JobsResultsView;
};

export type JobsFeedQuery = {
  matchedOnly: true;
  sourceId?: JobSourceId;
  savedSearchId?: string;
  matchStatus?: 'verified' | 'unverified_source_candidate';
};

export function matchStatusFromResultsView(
  resultsView: JobsResultsView,
): 'verified' | 'unverified_source_candidate' | undefined {
  if (resultsView === 'matched') {
    return 'verified';
  }

  if (resultsView === 'possible') {
    return 'unverified_source_candidate';
  }

  return undefined;
}

export function jobsFeedQueryFromFilters(
  filters: JobsFeedFilters,
): JobsFeedQuery {
  const query: JobsFeedQuery = { matchedOnly: true };
  const matchStatus = matchStatusFromResultsView(filters.resultsView);
  if (matchStatus) {
    query.matchStatus = matchStatus;
  }
  if (filters.sourceId !== 'all') {
    query.sourceId = filters.sourceId;
  }
  if (filters.savedSearchId !== 'all') {
    query.savedSearchId = filters.savedSearchId;
  }
  return query;
}

export function jobsFeedFilterKey(filters: JobsFeedFilters): string {
  return [
    filters.resultsView,
    filters.sourceId,
    filters.savedSearchId,
  ].join(':');
}

export function isCurrentFeedRequest(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}

export function hasActiveListingFilters(filters: {
  sourceId: JobSourceId | 'all';
  savedSearchId: string | 'all';
}): boolean {
  return filters.sourceId !== 'all' || filters.savedSearchId !== 'all';
}
