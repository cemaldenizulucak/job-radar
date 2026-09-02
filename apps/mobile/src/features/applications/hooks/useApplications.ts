import { useCallback, useEffect, useState } from 'react';

import { listApplications } from '../services/applications.service';
import type { ApplicationItem } from '../services/applications.service';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong. Try again.';
}

export function useApplications(userId: string | undefined) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
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
      setItems(await listApplications());
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
