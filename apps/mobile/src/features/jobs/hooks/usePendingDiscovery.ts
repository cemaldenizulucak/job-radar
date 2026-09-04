import { useEffect } from 'react';

import { getSavedSearch } from '@/features/searches/services/saved-search.service';

import { useJobsFilterStore } from '../stores/jobs-filter.store';

export const DISCOVERY_POLL_INTERVAL_MS = 2_000;
export const DISCOVERY_POLL_TIMEOUT_MS = 90_000;

export function usePendingDiscovery(
  refetchJobs: (options?: { silent?: boolean }) => Promise<void>,
): boolean {
  const pendingDiscoverySearchId = useJobsFilterStore(
    (state) => state.pendingDiscoverySearchId,
  );
  const clearPendingDiscovery = useJobsFilterStore(
    (state) => state.clearPendingDiscovery,
  );

  useEffect(() => {
    if (!pendingDiscoverySearchId) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const search = await getSavedSearch(pendingDiscoverySearchId);
        if (cancelled) {
          return;
        }

        if (search.discovery && search.discovery.status !== 'pending') {
          clearPendingDiscovery();
          await refetchJobs({ silent: true });
          return;
        }

        await refetchJobs({ silent: true });
      } catch {
        if (!cancelled) {
          await refetchJobs({ silent: true });
        }
      }
    };

    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, DISCOVERY_POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        clearPendingDiscovery();
        void refetchJobs({ silent: true });
      }
    }, DISCOVERY_POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [clearPendingDiscovery, pendingDiscoverySearchId, refetchJobs]);

  return Boolean(pendingDiscoverySearchId);
}
