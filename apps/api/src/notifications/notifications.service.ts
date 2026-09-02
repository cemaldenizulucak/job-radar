import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { PushNotificationsService } from '../push-tokens/push-notifications.service.js';
import { buildDiscoveryNotificationDrafts } from './discovery-notification.js';
import type {
  CreateDiscoveryNotificationsInput,
  NotificationRecord,
} from './notifications.types.js';

const NOTIFICATION_SELECT =
  'id, user_id, title, message, type, is_read, created_at';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notifiedRunUsers = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    @Optional() private readonly pushNotifications?: PushNotificationsService,
  ) {}

  async listForUser(userId: string): Promise<NotificationRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load notifications.');
    }

    return mapNotificationRows(data);
  }

  // TODO(dev-only): remove createTestNotification with POST /v1/notifications/test.
  async createTestNotification(userId: string): Promise<NotificationRecord> {
    const notification = await this.insertDigest({
      userId,
      title: '3 new jobs found',
      message: '2 LinkedIn, 1 Kariyer.net',
      type: 'JOB_DISCOVERY',
    });

    if (!notification) {
      throw new InternalServerErrorException('Failed to create test notification.');
    }

    return notification;
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select(NOTIFICATION_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update notification.');
    }

    const notification = mapNotificationRow(data);
    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return notification;
  }

  async createForNewMatches(
    input: CreateDiscoveryNotificationsInput,
  ): Promise<number> {
    if (input.jobs.length === 0 || input.matches.length === 0) {
      return 0;
    }

    const drafts = buildDiscoveryNotificationDrafts(input);
    let created = 0;

    for (const draft of drafts) {
      const key = `${input.runId}:${draft.userId}`;
      if (this.notifiedRunUsers.has(key)) {
        this.logger.log({
          message: 'Skipping duplicate discovery notification',
          runId: input.runId,
          userId: draft.userId,
        });
        continue;
      }

      const inserted = await this.insertDigest(draft);
      if (!inserted) {
        continue;
      }

      this.notifiedRunUsers.add(key);
      created += 1;
    }

    return created;
  }

  private async insertDigest(draft: {
    userId: string;
    title: string;
    message: string;
    type: string;
  }): Promise<NotificationRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .insert({
        user_id: draft.userId,
        title: draft.title,
        message: draft.message,
        type: draft.type,
        is_read: false,
      })
      .select(NOTIFICATION_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      this.logger.warn({
        message: 'Failed to create discovery notification; continuing',
        userId: draft.userId,
      });
      return null;
    }

    const notification = mapNotificationRow(data);
    if (!notification) {
      this.logger.warn({
        message: 'Notification insert returned an unreadable row',
        userId: draft.userId,
      });
      return null;
    }

    this.logger.log({
      message: 'Created discovery notification',
      userId: draft.userId,
      title: draft.title,
    });

    await this.sendDiscoveryPushSafely({
      userId: draft.userId,
      title: draft.title,
      body: draft.message,
    });

    return notification;
  }

  private async sendDiscoveryPushSafely(input: {
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    if (!this.pushNotifications) {
      return;
    }

    try {
      await this.pushNotifications.sendDiscoveryPush(input);
    } catch (error) {
      this.logger.warn({
        message: 'Push notification send failed; inbox row was still created',
        userId: input.userId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private logSupabaseError(error: SafeSupabaseError): void {
    this.logger.error({
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

function mapNotificationRows(value: unknown): NotificationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const notifications: NotificationRecord[] = [];
  for (const row of value) {
    const mapped = mapNotificationRow(row);
    if (mapped) {
      notifications.push(mapped);
    }
  }

  return notifications;
}

function mapNotificationRow(value: unknown): NotificationRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const title = readString(value, 'title');
  const message = readString(value, 'message') ?? '';
  const type = readString(value, 'type');
  const createdAt = readString(value, 'created_at');
  const isRead = value.is_read;

  if (!id || !userId || !title || !type || !createdAt || typeof isRead !== 'boolean') {
    return null;
  }

  return {
    id,
    userId,
    title,
    message,
    type,
    isRead,
    createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
