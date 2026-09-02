import { useCallback, useEffect, useRef, useState } from 'react';

import { userErrorMessage } from '@/lib/api-error';

import { getJob, listJobs, markJobSeen } from '../services/jobs.service';
import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobDetail, JobListItem } from '../types/job.types';

function toErrorMessage(error: unknown): string {
  return userErrorMessage(error, 'Something went wrong. Try again.');
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
      setError('You need to be signed in.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const jobs = await listJobs({ matchedOnly });
      setItems(jobs);
    } catch (caught) {
      setError(toErrorMessage(caught));
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
      setError('Job not found.');
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setJob(null);
      setError('You need to be signed in.');
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
      setError(toErrorMessage(caught));
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
