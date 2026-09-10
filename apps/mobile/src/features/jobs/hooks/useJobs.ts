import { useCallback, useEffect, useRef, useState } from 'react';

import { jobsCopy, jobsUiError } from '../copy';
import { getJob, listJobs, markJobSeen } from '../services/jobs.service';
import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobDetail, JobListItem } from '../types/job.types';

function toFeedError(error: unknown): string {
  return jobsUiError(error, jobsCopy.feedError);
}

function toJobError(error: unknown): string {
  return jobsUiError(error, jobsCopy.jobNotFound);
}

export function useJobs(
  userId: string | undefined,
  matchedOnly = true,
  savedSearchId: string | 'all' = 'all',
) {
  const [items, setItems] = useState<JobListItem[]>([]);
  const [lastDiscoveryAt, setLastDiscoveryAt] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [savedSearchCounts, setSavedSearchCounts] = useState<
    readonly { id: string; count: number }[]
  >([]);
  const [verifiedMatchCount, setVerifiedMatchCount] = useState(0);
  const [unverifiedMatchCount, setUnverifiedMatchCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenUserIdRef = useRef(userId);

  useEffect(() => {
    if (seenUserIdRef.current === userId) {
      return;
    }

    useJobsSeenStore.getState().clear();
    seenUserIdRef.current = userId;
  }, [userId]);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    if (!userId) {
      setItems([]);
      setLastDiscoveryAt(null);
      setTotalCount(0);
      setSavedSearchCounts([]);
      setVerifiedMatchCount(0);
      setUnverifiedMatchCount(0);
      setError(jobsCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const feed = await listJobs({ matchedOnly, savedSearchId });
      setItems(feed.items);
      setLastDiscoveryAt(feed.lastDiscoveryAt);
      setTotalCount(feed.totalCount);
      setSavedSearchCounts(feed.savedSearchCounts);
      setVerifiedMatchCount(feed.verifiedMatchCount);
      setUnverifiedMatchCount(feed.unverifiedMatchCount);
    } catch (caught) {
      setError(toFeedError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [matchedOnly, savedSearchId, userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
    lastDiscoveryAt,
    totalCount,
    savedSearchCounts,
    verifiedMatchCount,
    unverifiedMatchCount,
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
