import { inspect } from 'node:util';

import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { redactTelegramSecrets } from '../notifications/telegram-secrets.js';
import {
  generateTelegramLinkCode,
  hashTelegramLinkCode,
  TELEGRAM_LINK_CODE_TTL_MS,
} from './telegram-code.js';
import {
  normalizeBotUsername,
  readOptionalTelegramEnv,
} from './telegram-env.js';
import { maskedTelegramDisplay } from './telegram-mask.js';
import {
  MemoryRateLimiter,
  TELEGRAM_LINK_CODE_LIMIT,
  TELEGRAM_LINK_CODE_WINDOW_MS,
} from './telegram-rate-limit.js';
import { mapConnectionRow } from './telegram-rows.js';
import type {
  TelegramLinkCodeResponse,
  TelegramStatusResponse,
} from './telegram.types.js';

const CONNECTIONS_TABLE = 'user_telegram_connections';
const LINK_CODES_TABLE = 'telegram_link_codes';
const CONNECTION_SELECT =
  'id, user_id, telegram_chat_id, telegram_user_id, telegram_username, connected_at';

type SafeSupabaseError = {
  message: string;
  code?: string;
};

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);
  readonly #botUsername: string | null;
  readonly #rateLimiter: MemoryRateLimiter;

  constructor(
    configService: ConfigService,
    private readonly supabase: SupabaseService,
    rateLimiter: MemoryRateLimiter,
  ) {
    this.#botUsername = normalizeBotUsername(
      readOptionalTelegramEnv(configService, 'TELEGRAM_BOT_USERNAME'),
    );
    this.#rateLimiter = rateLimiter;
  }

  async createLinkCode(userId: string): Promise<TelegramLinkCodeResponse> {
    if (
      !this.#rateLimiter.consume(
        `link-code:${userId}`,
        TELEGRAM_LINK_CODE_LIMIT,
        TELEGRAM_LINK_CODE_WINDOW_MS,
      )
    ) {
      throw new HttpException(
        'Too many link code requests.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateTelegramLinkCode();
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS).toISOString();

    try {
      await this.invalidateActiveCodes(userId);
      await this.insertCode(userId, hashTelegramLinkCode(code), expiresAt);
    } catch (error) {
      this.logSafeError('Failed to create Telegram link code', error);
      throw new InternalServerErrorException('Failed to create Telegram link code.');
    }

    return {
      code,
      expiresAt,
      botUsername: this.#botUsername,
    };
  }

  async getStatus(userId: string): Promise<TelegramStatusResponse> {
    const connection = await this.findConnection(userId);
    return {
      connected: connection !== null,
      displayName: connection
        ? maskedTelegramDisplay({
            username: connection.telegramUsername,
            telegramUserId: connection.telegramUserId,
          })
        : null,
      connectedAt: connection?.connectedAt ?? null,
      botUsername: this.#botUsername,
    };
  }

  async disconnect(userId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(CONNECTIONS_TABLE)
      .delete()
      .eq('user_id', userId);

    if (error) {
      this.logSafeError('Failed to disconnect Telegram', error);
      throw new InternalServerErrorException('Failed to disconnect Telegram.');
    }

    await this.invalidateActiveCodes(userId);
  }

  toJSON(): { name: string } {
    return { name: 'TelegramLinkService' };
  }

  [inspect.custom](): string {
    return 'TelegramLinkService';
  }

  private async findConnection(userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from(CONNECTIONS_TABLE)
      .select(CONNECTION_SELECT)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logSafeError('Failed to load Telegram connection', error);
      return null;
    }

    return mapConnectionRow(data);
  }

  private async invalidateActiveCodes(userId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(LINK_CODES_TABLE)
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('consumed_at', null);

    if (error) {
      throw error;
    }
  }

  private async insertCode(
    userId: string,
    codeHash: string,
    expiresAt: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(LINK_CODES_TABLE)
      .insert({
        user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (!error) {
      return;
    }

    if (error.code === '23505') {
      await this.invalidateActiveCodes(userId);
      const retry = await this.supabase
        .getClient()
        .from(LINK_CODES_TABLE)
        .insert({
          user_id: userId,
          code_hash: codeHash,
          expires_at: expiresAt,
        });
      if (!retry.error) {
        return;
      }
      throw retry.error;
    }

    throw error;
  }

  private logSafeError(message: string, error: unknown): void {
    const raw =
      isSafeSupabaseError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'unknown';
    this.logger.error({
      message,
      error: redactTelegramSecrets(raw),
      code: isSafeSupabaseError(error) ? error.code : undefined,
    });
  }
}

function isSafeSupabaseError(error: unknown): error is SafeSupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as SafeSupabaseError).message === 'string'
  );
}
