import { useCallback } from 'react';

import { jobsCopy } from '@/features/jobs/copy';

import { addFavorite, removeFavorite } from '../services/favorites.service';
import { useFavoritesStatusStore } from '../stores/favorites-status.store';
import {
  resolveFavoriteState,
  runFavoriteToggle,
} from '../utils/favorite-toggle';

export function useFavoriteToggle() {
  const overlay = useFavoritesStatusStore((state) => state.byJobId);
  const error = useFavoritesStatusStore((state) => state.error);
  const setFavorite = useFavoritesStatusStore((state) => state.setFavorite);
  const setError = useFavoritesStatusStore((state) => state.setError);

  const isFavorite = useCallback(
    (jobId: string, fallback = false) =>
      resolveFavoriteState(jobId, fallback, overlay),
    [overlay],
  );

  const toggleFavorite = useCallback(
    async (jobId: string, currentlyFavorite: boolean) => {
      const result = await runFavoriteToggle({
        jobId,
        currentlyFavorite,
        add: addFavorite,
        remove: removeFavorite,
        onOptimistic: (next) => setFavorite(jobId, next),
        onRollback: (previous) => setFavorite(jobId, previous),
      });

      if (result === 'error') {
        setError(jobsCopy.favoriteError);
      }

      return result;
    },
    [setError, setFavorite],
  );

  const clearError = useCallback(() => setError(null), [setError]);

  return {
    isFavorite,
    error,
    toggleFavorite,
    clearError,
  };
}
