import { inspect } from 'node:util';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { redactTelegramSecrets } from '../notifications/telegram-secrets.js';
import { readOptionalTelegramEnv } from './telegram-env.js';
import { mapChatLookup } from './telegram-rows.js';

const CONNECTIONS_TABLE = 'user_telegram_connections';
const CONNECTION_SELECT = 'user_id, telegram_chat_id';

export type TelegramChatLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: readonly string[],
      ) => PromiseLike<{
        data: unknown;
        error: { message: string; code?: string } | null;
      }>;
    };
  };
};

export async function resolveTelegramChatIds(
  client: TelegramChatLookupClient,
  userIds: readonly string[],
  legacy: { userId: string | null; chatId: string | null },
  onError?: (error: { message: string; code?: string }) => void,
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  const resolved = new Map<string, string>();

  if (unique.length === 0) {
    return resolved;
  }

  const { data, error } = await client
    .from(CONNECTIONS_TABLE)
    .select(CONNECTION_SELECT)
    .in('user_id', unique);

  if (error) {
    onError?.(error);
  } else if (Array.isArray(data)) {
    for (const row of data) {
      const mapped = mapChatLookup(row);
      if (mapped) {
        resolved.set(mapped.userId, mapped.chatId);
      }
    }
  }

  for (const userId of unique) {
    if (resolved.has(userId)) {
      continue;
    }
    if (legacy.userId && legacy.chatId && userId === legacy.userId) {
      resolved.set(userId, legacy.chatId);
    }
  }

  return resolved;
}

@Injectable()
export class TelegramConnectionService {
  private readonly logger = new Logger(TelegramConnectionService.name);
  readonly #legacyUserId: string | null;
  readonly #legacyChatId: string | null;

  constructor(
    configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.#legacyUserId = readOptionalTelegramEnv(
      configService,
      'TELEGRAM_LEGACY_USER_ID',
    );
    this.#legacyChatId = readOptionalTelegramEnv(configService, 'TELEGRAM_CHAT_ID');
  }

  async resolveChatIds(
    userIds: readonly string[],
  ): Promise<Map<string, string>> {
    return resolveTelegramChatIds(
      this.supabase.getClient() as unknown as TelegramChatLookupClient,
      userIds,
      { userId: this.#legacyUserId, chatId: this.#legacyChatId },
      (error) => {
        this.logger.error({
          message: 'Failed to load Telegram connections',
          error: redactTelegramSecrets(error.message, null, this.#legacyChatId),
          code: error.code,
        });
      },
    );
  }

  toJSON(): { name: string } {
    return { name: 'TelegramConnectionService' };
  }

  [inspect.custom](): string {
    return 'TelegramConnectionService';
  }

}
