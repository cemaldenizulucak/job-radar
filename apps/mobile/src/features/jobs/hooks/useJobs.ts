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
) {
  const [items, setItems] = useState<JobListItem[]>([]);
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

  const refetch = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setError(jobsCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const jobs = await listJobs({ matchedOnly });
      setItems(jobs);
    } catch (caught) {
      setError(toFeedError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [matchedOnly, userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    items,
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
