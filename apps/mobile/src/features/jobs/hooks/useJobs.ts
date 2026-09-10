import { useCallback, useEffect, useRef, useState } from 'react';

import { jobsCopy, jobsUiError } from '../copy';
import { getJob, listJobs, markJobSeen } from '../services/jobs.service';
import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobDetail, JobListItem } from '../types/job.types';
import {
  isCurrentFeedRequest,
  jobsFeedFilterKey,
  jobsFeedQueryFromFilters,
  type JobsFeedFilters,
} from '../utils/jobs-feed-query';

function toFeedError(error: unknown): string {
  return jobsUiError(error, jobsCopy.feedError);
}

function toJobError(error: unknown): string {
  return jobsUiError(error, jobsCopy.jobNotFound);
}

export type JobsFeedCounts = {
  totalCount: number;
  savedSearchCounts: readonly { id: string; count: number }[];
  savedSearchAllCount: number;
  sourceCounts: {
    all: number;
    linkedin: number;
    kariyer_net: number;
  };
  verifiedMatchCount: number;
  unverifiedMatchCount: number;
  allMatchCount: number;
};

const EMPTY_COUNTS: JobsFeedCounts = {
  totalCount: 0,
  savedSearchCounts: [],
  savedSearchAllCount: 0,
  sourceCounts: { all: 0, linkedin: 0, kariyer_net: 0 },
  verifiedMatchCount: 0,
  unverifiedMatchCount: 0,
  allMatchCount: 0,
};

export function useJobs(
  userId: string | undefined,
  resultsView: JobsFeedFilters['resultsView'] = 'all',
  sourceId: JobsFeedFilters['sourceId'] = 'all',
  savedSearchId: JobsFeedFilters['savedSearchId'] = 'all',
) {
  const [items, setItems] = useState<JobListItem[]>([]);
  const [lastDiscoveryAt, setLastDiscoveryAt] = useState<string | null>(null);
  const [counts, setCounts] = useState<JobsFeedCounts>(EMPTY_COUNTS);
  const [loadedFilterKey, setLoadedFilterKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenUserIdRef = useRef(userId);
  const requestIdRef = useRef(0);
  const filters: JobsFeedFilters = { resultsView, sourceId, savedSearchId };
  const filterKey = jobsFeedFilterKey(filters);
  const countsReady = loadedFilterKey === filterKey;

  useEffect(() => {
    if (seenUserIdRef.current === userId) {
      return;
    }

    useJobsSeenStore.getState().clear();
    seenUserIdRef.current = userId;
  }, [userId]);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const nextFilterKey = jobsFeedFilterKey(filters);

    if (!userId) {
      setItems([]);
      setLastDiscoveryAt(null);
      setCounts(EMPTY_COUNTS);
      setLoadedFilterKey(null);
      setError(jobsCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
      setLoadedFilterKey(null);
    }
    setError(null);

    try {
      const feed = await listJobs(jobsFeedQueryFromFilters(filters));
      if (!isCurrentFeedRequest(requestId, requestIdRef.current)) {
        return;
      }
      setItems(feed.items);
      setLastDiscoveryAt(feed.lastDiscoveryAt);
      setCounts({
        totalCount: feed.totalCount,
        savedSearchCounts: feed.savedSearchCounts,
        savedSearchAllCount: feed.savedSearchAllCount,
        sourceCounts: feed.sourceCounts,
        verifiedMatchCount: feed.verifiedMatchCount,
        unverifiedMatchCount: feed.unverifiedMatchCount,
        allMatchCount: feed.allMatchCount,
      });
      setLoadedFilterKey(nextFilterKey);
    } catch (caught) {
      if (!isCurrentFeedRequest(requestId, requestIdRef.current)) {
        return;
      }
      setError(toFeedError(caught));
    } finally {
      if (isCurrentFeedRequest(requestId, requestIdRef.current)) {
        setIsLoading(false);
      }
    }
  }, [filters.resultsView, filters.savedSearchId, filters.sourceId, userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    lastDiscoveryAt,
    totalCount: counts.totalCount,
    savedSearchCounts: counts.savedSearchCounts,
    savedSearchAllCount: counts.savedSearchAllCount,
    sourceCounts: counts.sourceCounts,
    verifiedMatchCount: counts.verifiedMatchCount,
    unverifiedMatchCount: counts.unverifiedMatchCount,
    allMatchCount: counts.allMatchCount,
    countsReady,
    isLoading,
    error,
    refetch,
  };
}

export function useJob(id: string | undefined, userId: string | undefined) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setJob(null);
      setError(jobsCopy.jobNotFound);
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setJob(null);
      setError(jobsCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await getJob(id);
      setJob(next);

      const seenStore = useJobsSeenStore.getState();
      if (!next.isSeen) {
        seenStore.markSeen(id);
      }

      try {
        const seen = await markJobSeen(id);
        seenStore.markSeen(id);
        setJob(seen);
      } catch {
        if (!next.isSeen) {
          seenStore.unmarkSeen(id);
        }
      }
    } catch (caught) {
      setJob(null);
      setError(toJobError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [id, userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    job,
    isLoading,
    error,
    refetch,
    setJob,
  };
}
