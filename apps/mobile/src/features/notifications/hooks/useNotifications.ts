import { useCallback, useEffect, useState } from 'react';

import {
  listNotifications,
  markNotificationRead,
} from '../services/notifications.service';
import type { NotificationItem } from '../types/notification.types';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong. Try again.';
}

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<NotificationItem[]>([]);
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
        throw new Error('You need to be signed in.');
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
