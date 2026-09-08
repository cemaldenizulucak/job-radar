import { useCallback, useEffect, useState } from 'react';

import { uiCopy, uiError } from '@/constants/ui';

import { listFavorites } from '../services/favorites.service';
import type { FavoriteItem } from '../services/favorites.service';
import { useFavoritesStatusStore } from '../stores/favorites-status.store';

function toErrorMessage(error: unknown): string {
  return uiError(error, uiCopy.genericError);
}

export function useFavorites(userId: string | undefined) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      useFavoritesStatusStore.getState().clear();
      setItems([]);
      setError(uiCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await listFavorites();
      setItems(next);
      useFavoritesStatusStore.getState().hydrate(
        next.map((item) => ({ jobId: item.jobId, isFavorite: true })),
      );
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

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
