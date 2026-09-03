import { useCallback, useEffect, useState } from 'react';

import { uiCopy, uiError } from '@/constants/ui';

import {
  listNotifications,
  markNotificationRead,
} from '../services/notifications.service';
import type { NotificationItem } from '../types/notification.types';

function toErrorMessage(error: unknown): string {
  return uiError(error, uiCopy.genericError);
}

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<NotificationItem[]>([]);
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
      const notifications = await listNotifications();
      setItems(notifications);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) {
        throw new Error(uiCopy.signedInRequired);
      }

      const updated = await markNotificationRead(id);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [userId],
  );

  const unreadCount = items.filter((item) => !item.isRead).length;

  return {
    items,
    unreadCount,
    isLoading,
    error,
    refetch,
    markRead,
  };
}
