import { create } from 'zustand';

import type { JobSourceId } from '../types/job.types';

export type JobsResultsView = 'matched' | 'all';

type JobsFilterState = {
  sourceId: JobSourceId | 'all';
  savedSearchId: string | 'all';
  resultsView: JobsResultsView;
  searchCatalogEpoch: number;
  feedRefreshEpoch: number;
  setSourceId: (sourceId: JobSourceId | 'all') => void;
  setSavedSearchId: (savedSearchId: string | 'all') => void;
  setResultsView: (resultsView: JobsResultsView) => void;
  clearSavedSearchIfSelected: (deletedId: string) => void;
  applyDiscoveryNotificationTarget: (savedSearchId: string | null) => void;
  bumpSearchCatalog: () => void;
  bumpFeedRefresh: () => void;
};

export const useJobsFilterStore = create<JobsFilterState>((set) => ({
  sourceId: 'all',
  savedSearchId: 'all',
  resultsView: 'matched',
  searchCatalogEpoch: 0,
  feedRefreshEpoch: 0,
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
    })),
  bumpSearchCatalog: () =>
    set((state) => ({ searchCatalogEpoch: state.searchCatalogEpoch + 1 })),
  bumpFeedRefresh: () =>
    set((state) => ({ feedRefreshEpoch: state.feedRefreshEpoch + 1 })),
}));
