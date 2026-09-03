import { ZodError } from 'zod';

import { ApiClientError, apiGet, apiPatch } from '@/lib/api-client';

import type { NotificationItem } from '../types/notification.types';
import {
  notificationItemSchema,
  notificationListResponseSchema,
} from '../validation/notification.schema';

export class NotificationsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationsServiceError';
  }
}

function toServiceError(error: unknown): NotificationsServiceError {
  if (error instanceof NotificationsServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new NotificationsServiceError(error.message);
  }

  if (error instanceof ZodError) {
    return new NotificationsServiceError(
      'Bildirimler beklenmeyen bir yanıt verdi.',
    );
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new NotificationsServiceError(error.message);
  }

  return new NotificationsServiceError('Bildirimler yüklenemedi. Lütfen tekrar deneyin.');
}

export async function listNotifications(): Promise<NotificationItem[]> {
  try {
    const payload = notificationListResponseSchema.parse(
      await apiGet('/v1/notifications'),
    );
    return payload.items;
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  try {
    return notificationItemSchema.parse(
      await apiPatch(`/v1/notifications/${encodeURIComponent(id)}/read`),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}
