import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type {
  RegisterPushTokenInput,
  UnregisterPushTokenInput,
  UserPushToken,
} from './push-tokens.types.js';

const PUSH_TOKEN_SELECT =
  'id, user_id, expo_push_token, platform, is_active';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async register(input: RegisterPushTokenInput): Promise<UserPushToken> {
    const { data, error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .upsert(
        {
          user_id: input.userId,
          expo_push_token: input.expoPushToken,
          platform: input.platform ?? null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' },
      )
      .select(PUSH_TOKEN_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to register push token.');
    }

    const token = mapPushTokenRow(data);
    if (!token) {
      throw new InternalServerErrorException('Failed to register push token.');
    }

    return token;
  }

  async unregister(input: UnregisterPushTokenInput): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', input.userId)
      .eq('expo_push_token', input.expoPushToken);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to unregister push token.');
    }
  }

  async listActiveForUser(userId: string): Promise<UserPushToken[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .select(PUSH_TOKEN_SELECT)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load push tokens.');
    }

    return mapPushTokenRows(data);
  }

  async deactivate(expoPushToken: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('user_push_tokens')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('expo_push_token', expoPushToken)
      .eq('is_active', true);

    if (error) {
      this.logSupabaseError(error);
      this.logger.warn({
        message: 'Failed to deactivate an invalid push token',
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

function mapPushTokenRows(value: unknown): UserPushToken[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tokens: UserPushToken[] = [];
  for (const row of value) {
    const mapped = mapPushTokenRow(row);
    if (mapped) {
      tokens.push(mapped);
    }
  }

  return tokens;
}

function mapPushTokenRow(value: unknown): UserPushToken | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const expoPushToken = readString(value, 'expo_push_token');
  const platformValue = value.platform;
  const isActive = value.is_active;

  if (!id || !userId || !expoPushToken || typeof isActive !== 'boolean') {
    return null;
  }

  return {
    id,
    userId,
    expoPushToken,
    platform: typeof platformValue === 'string' ? platformValue : null,
    isActive,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
