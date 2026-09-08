import { create } from 'zustand';

import { pendingFavoriteJobIds } from '../utils/favorite-toggle';

type FavoritesStatusState = {
  byJobId: Record<string, boolean>;
  error: string | null;
  hydrate: (entries: readonly { jobId: string; isFavorite: boolean }[]) => void;
  setFavorite: (jobId: string, isFavorite: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
};

export const useFavoritesStatusStore = create<FavoritesStatusState>((set) => ({
  byJobId: {},
  error: null,
  hydrate: (entries) =>
    set((state) => {
      const pending = pendingFavoriteJobIds();
      const next = { ...state.byJobId };
      for (const entry of entries) {
        if (!pending.has(entry.jobId)) {
          next[entry.jobId] = entry.isFavorite;
        }
      }
      return { byJobId: next };
    }),
  setFavorite: (jobId, isFavorite) =>
    set((state) => ({
      byJobId: { ...state.byJobId, [jobId]: isFavorite },
      error: null,
    })),
  setError: (error) => set({ error }),
  clear: () => set({ byJobId: {}, error: null }),
}));
