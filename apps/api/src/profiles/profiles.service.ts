import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import type { ProfileLocation } from '../common/search-location.js';
import { trimLocation } from '../common/search-location.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type { ProfileRecord, ProfileUpdateInput } from './profiles.types.js';

const PROFILE_PATCH_ENDPOINT = 'PATCH /v1/profiles';

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
    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logSupabaseError('GET /v1/profiles', error);
      this.logger.warn({
        message: 'profiles row unavailable; returning auth fallback',
        userId,
      });
      return emptyProfile(userId);
    }

    if (!isRecord(data)) {
      return emptyProfile(userId);
    }

    return mapProfile(userId, data);
  }

  async getLocationsByUserIds(
    userIds: readonly string[],
  ): Promise<Map<string, ProfileLocation>> {
    const locations = new Map<string, ProfileLocation>();
    const uniqueIds = [...new Set(userIds.filter((id) => id.length > 0))];

    for (const userId of uniqueIds) {
      locations.set(userId, { country: null, city: null });
    }

    if (uniqueIds.length === 0) {
      return locations;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .select('id, country, city')
      .in('id', uniqueIds);

    if (error) {
      this.logSupabaseError('GET /v1/profiles (locations)', error);
      this.logger.warn({
        message: 'profile locations unavailable; discovery will skip profile defaults',
      });
      return locations;
    }

    if (!Array.isArray(data)) {
      return locations;
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const userId = readString(row, 'id');
      if (!userId) {
        continue;
      }

      locations.set(userId, {
        country: readString(row, 'country'),
        city: readString(row, 'city'),
      });
    }

    return locations;
  }

  async update(
    userId: string,
    patch: ProfileUpdateInput,
  ): Promise<ProfileRecord> {
    const payload = toProfileWriteRow(userId, patch);
    const existing = await this.findRow(userId);

    if (existing) {
      const result = await this.supabase
        .getClient()
        .from('profiles')
        .update(omitId(payload))
        .eq('id', userId)
        .select('*')
        .maybeSingle();
      return this.readWriteResult(result, userId, patch);
    }

    const result = await this.supabase
      .getClient()
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    return this.readWriteResult(result, userId, patch);
  }

  private async findRow(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(PROFILE_PATCH_ENDPOINT, error);
      throw new InternalServerErrorException('Failed to update profile.');
    }

    return isRecord(data) ? data : null;
  }

  private readWriteResult(
    result: { data: unknown; error: SafeSupabaseError | null },
    userId: string,
    patch: ProfileUpdateInput,
  ): ProfileRecord {
    const { data, error } = result;

    if (error) {
      this.logSupabaseError(PROFILE_PATCH_ENDPOINT, error);
      throw new InternalServerErrorException('Failed to update profile.');
    }

    if (!isRecord(data)) {
      this.logger.error({
        endpoint: PROFILE_PATCH_ENDPOINT,
        message: 'Profile write returned no row',
      });
      throw new InternalServerErrorException('Failed to update profile.');
    }

    return mapProfile(userId, data, patch);
  }

  private logSupabaseError(endpoint: string, error: SafeSupabaseError): void {
    this.logger.error({
      endpoint,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
}

function toProfileWriteRow(
  userId: string,
  patch: ProfileUpdateInput,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: userId,
    updated_at: now,
  };

  if (typeof patch.notificationsEnabled === 'boolean') {
    payload.notifications_enabled = patch.notificationsEnabled;
  }

  if (patch.country !== undefined) {
    payload.country = patch.country;
  }

  if (patch.city !== undefined) {
    payload.city = patch.city;
  }

  return payload;
}

function omitId(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next.id;
  return next;
}

function emptyProfile(userId: string): ProfileRecord {
  return {
    userId,
    fullName: null,
    email: null,
    notificationsEnabled: null,
    timezone: null,
    country: null,
    city: null,
  };
}

function mapProfile(
  userId: string,
  data: Record<string, unknown>,
  fallback: ProfileUpdateInput = {},
): ProfileRecord {
  return {
    userId,
    fullName:
      readString(data, 'full_name') ?? readString(data, 'display_name') ?? null,
    email: readString(data, 'email'),
    notificationsEnabled:
      typeof data.notifications_enabled === 'boolean'
        ? data.notifications_enabled
        : (fallback.notificationsEnabled ?? null),
    timezone: readString(data, 'timezone'),
    country: readString(data, 'country') ?? fallback.country ?? null,
    city: readString(data, 'city') ?? fallback.city ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') {
    return null;
  }

  return trimLocation(value);
}
