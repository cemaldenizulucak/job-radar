import { useCallback, useEffect, useState } from 'react';

import { listFavorites } from '../services/favorites.service';
import type { FavoriteItem } from '../services/favorites.service';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong. Try again.';
}

export function useFavorites(userId: string | undefined) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
