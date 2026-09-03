import { useCallback, useEffect, useState } from 'react';

import { uiCopy, uiError } from '@/constants/ui';

import { listFavorites } from '../services/favorites.service';
import type { FavoriteItem } from '../services/favorites.service';

function toErrorMessage(error: unknown): string {
  return uiError(error, uiCopy.genericError);
}

export function useFavorites(userId: string | undefined) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setError(uiCopy.signedInRequired);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setItems(await listFavorites());
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
