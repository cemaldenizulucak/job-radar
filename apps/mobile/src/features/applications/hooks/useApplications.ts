import { useCallback, useEffect, useState } from 'react';

import { uiCopy, uiError } from '@/constants/ui';

import { listApplications } from '../services/applications.service';
import type { ApplicationItem } from '../services/applications.service';

function toErrorMessage(error: unknown): string {
  return uiError(error, uiCopy.genericError);
}

export function useApplications(userId: string | undefined) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
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
