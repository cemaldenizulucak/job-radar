import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type { ProfileRecord } from './profiles.types.js';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getByUserId(userId: string): Promise<ProfileRecord> {
    const empty: ProfileRecord = {
      userId,
      fullName: null,
      email: null,
      notificationsEnabled: null,
      timezone: null,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      this.logger.warn({
        message: 'profiles row unavailable; returning auth fallback',
        userId,
      });
      return empty;
    }

    if (!isRecord(data)) {
      return empty;
    }

    return {
      userId,
      fullName:
        readString(data, 'full_name') ??
        readString(data, 'display_name') ??
        null,
      email: readString(data, 'email'),
      notificationsEnabled:
        typeof data.notifications_enabled === 'boolean'
          ? data.notifications_enabled
          : null,
      timezone: readString(data, 'timezone'),
    };
  }

  async updateNotificationsEnabled(
    userId: string,
    notificationsEnabled: boolean,
  ): Promise<ProfileRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .upsert(
        {
          id: userId,
          notifications_enabled: notificationsEnabled,
          updated_at: now,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update profile.');
    }

    if (!isRecord(data)) {
      return {
        userId,
        fullName: null,
        email: null,
        notificationsEnabled,
        timezone: null,
      };
    }

    return {
      userId,
      fullName:
        readString(data, 'full_name') ??
        readString(data, 'display_name') ??
        null,
      email: readString(data, 'email'),
      notificationsEnabled:
        typeof data.notifications_enabled === 'boolean'
          ? data.notifications_enabled
          : notificationsEnabled,
      timezone: readString(data, 'timezone'),
    };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
