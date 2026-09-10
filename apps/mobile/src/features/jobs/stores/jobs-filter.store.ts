import { create } from 'zustand';

import type { JobSourceId } from '../types/job.types';

export type JobsResultsView = 'matched' | 'possible' | 'all';

type JobsFilterState = {
  sourceId: JobSourceId | 'all';
  savedSearchId: string | 'all';
  resultsView: JobsResultsView;
  searchCatalogEpoch: number;
  feedRefreshEpoch: number;
  pendingDiscoverySearchId: string | null;
  setSourceId: (sourceId: JobSourceId | 'all') => void;
  setSavedSearchId: (savedSearchId: string | 'all') => void;
  setResultsView: (resultsView: JobsResultsView) => void;
  clearSavedSearchIfSelected: (deletedId: string) => void;
  applyDiscoveryNotificationTarget: (savedSearchId: string | null) => void;
  bumpSearchCatalog: () => void;
  bumpFeedRefresh: () => void;
  beginPendingDiscovery: (searchId: string) => void;
  clearPendingDiscovery: () => void;
};

export const useJobsFilterStore = create<JobsFilterState>((set) => ({
  sourceId: 'all',
  savedSearchId: 'all',
  resultsView: 'matched',
  searchCatalogEpoch: 0,
  feedRefreshEpoch: 0,
  pendingDiscoverySearchId: null,
  setSourceId: (sourceId) => set({ sourceId }),
  setSavedSearchId: (savedSearchId) => set({ savedSearchId }),
  setResultsView: (resultsView) => set({ resultsView }),
  applyDiscoveryNotificationTarget: (savedSearchId) =>
    set((state) => ({
      resultsView: 'matched' as const,
      savedSearchId: savedSearchId ?? 'all',
      feedRefreshEpoch: state.feedRefreshEpoch + 1,
    })),
  clearSavedSearchIfSelected: (deletedId) =>
    set((state) => ({
      savedSearchId:
        state.savedSearchId === deletedId ? 'all' : state.savedSearchId,
      pendingDiscoverySearchId:
        state.pendingDiscoverySearchId === deletedId
          ? null
          : state.pendingDiscoverySearchId,
    })),
  bumpSearchCatalog: () =>
    set((state) => ({ searchCatalogEpoch: state.searchCatalogEpoch + 1 })),
  bumpFeedRefresh: () =>
    set((state) => ({ feedRefreshEpoch: state.feedRefreshEpoch + 1 })),
  beginPendingDiscovery: (searchId) =>
    set({ pendingDiscoverySearchId: searchId }),
  clearPendingDiscovery: () => set({ pendingDiscoverySearchId: null }),
}));
