import { inspect } from 'node:util';

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isRecord } from '../common/request.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { redactTelegramSecrets, safeErrorMessage } from '../notifications/telegram-secrets.js';
import {
  hashTelegramLinkCode,
  isTelegramLinkCodeFormat,
} from './telegram-code.js';
import { readOptionalTelegramEnv } from './telegram-env.js';
import {
  defaultTelegramHttpPost,
  TELEGRAM_HTTP_POST,
  TELEGRAM_REQUEST_TIMEOUT_MS,
  telegramSendMessageUrl,
  type TelegramHttpPost,
} from './telegram-http.js';
import {
  MemoryRateLimiter,
  TELEGRAM_WEBHOOK_LINK_LIMIT,
  TELEGRAM_WEBHOOK_LINK_WINDOW_MS,
} from './telegram-rate-limit.js';
import { mapLinkResult } from './telegram-rows.js';
import {
  parsePrivateTextUpdate,
  parseTelegramUpdateId,
} from './telegram-update.js';
import { telegramWebhookSecretsEqual } from './telegram-webhook-secret.js';

const UPDATES_TABLE = 'telegram_processed_updates';

const START_HELP_TEXT = [
  'JobRadar bildirim botu.',
  '',
  'Hesabını bağlamak için uygulamada bir bağlantı kodu oluştur ve buraya şu komutu gönder:',
  '/link JR-0000000000',
  '',
  'Bağlandıktan sonra kayıtlı aramalarına uyan yeni ilanlar bu sohbete gelir.',
].join('\n');

const LINKED_TEXT =
  'JobRadar hesabın Telegram’a bağlandı. Yeni ilanlar buraya gönderilecek.';
const INVALID_CODE_TEXT = 'Bağlantı kodu geçersiz veya süresi dolmuş.';
const LINK_USAGE_TEXT = 'Kullanım: /link JR-0000000000';
const CHAT_TAKEN_TEXT = 'Bu Telegram hesabı başka bir JobRadar hesabına bağlı.';
const RATE_LIMIT_TEXT = 'Çok fazla deneme yaptın. Bir süre sonra tekrar dene.';

@Injectable()
export class TelegramWebhookService {
  private readonly logger = new Logger(TelegramWebhookService.name);
  readonly #token: string | null;
  readonly #webhookSecret: string | null;
  readonly #rateLimiter: MemoryRateLimiter;
  private readonly httpPost: TelegramHttpPost;

  constructor(
    configService: ConfigService,
    private readonly supabase: SupabaseService,
    rateLimiter: MemoryRateLimiter,
    @Optional()
    @Inject(TELEGRAM_HTTP_POST)
    httpPost?: TelegramHttpPost,
  ) {
    this.#token = readOptionalTelegramEnv(configService, 'TELEGRAM_BOT_TOKEN');
    this.#webhookSecret = readOptionalTelegramEnv(
      configService,
      'TELEGRAM_WEBHOOK_SECRET',
    );
    this.httpPost = httpPost ?? defaultTelegramHttpPost;
    this.#rateLimiter = rateLimiter;
  }

  async handleWebhook(secret: string | undefined, body: unknown): Promise<{ ok: true }> {
    if (!telegramWebhookSecretsEqual(secret, this.#webhookSecret)) {
      throw new UnauthorizedException('Unauthorized.');
    }

    const updateId = parseTelegramUpdateId(body);
    if (updateId === null) {
      return { ok: true };
    }

    const claimed = await this.claimUpdate(updateId);
    if (!claimed) {
      return { ok: true };
    }

    const parsed = parsePrivateTextUpdate(body);
    if (parsed === 'ignored' || parsed === 'group') {
      return { ok: true };
    }

    try {
      await this.handlePrivateCommand(parsed);
    } catch (error) {
      this.logger.warn({
        message: 'Telegram webhook command failed',
        updateId,
        error: safeErrorMessage(error, this.#token),
      });
    }

    return { ok: true };
  }

  toJSON(): { name: string } {
    return { name: 'TelegramWebhookService' };
  }

  [inspect.custom](): string {
    return 'TelegramWebhookService';
  }

  private async handlePrivateCommand(
    update: Exclude<ReturnType<typeof parsePrivateTextUpdate>, 'ignored' | 'group'>,
  ): Promise<void> {
    const command = update.command;
    if (!command) {
      return;
    }
    if (command.kind !== 'link') {
      await this.reply(update.chatId, START_HELP_TEXT);
      return;
    }

    if (
      !this.#rateLimiter.consume(
        `webhook-link:${update.chatId}`,
        TELEGRAM_WEBHOOK_LINK_LIMIT,
        TELEGRAM_WEBHOOK_LINK_WINDOW_MS,
      )
    ) {
      await this.reply(update.chatId, RATE_LIMIT_TEXT);
      return;
    }

    if (!command.code || !command.formatValid) {
      await this.reply(
        update.chatId,
        command.code ? INVALID_CODE_TEXT : LINK_USAGE_TEXT,
      );
      return;
    }

    if (!isTelegramLinkCodeFormat(command.code)) {
      await this.reply(update.chatId, INVALID_CODE_TEXT);
      return;
    }

    const result = await this.consumeLinkCode({
      code: command.code,
      chatId: update.chatId,
      telegramUserId: update.telegramUserId,
      telegramUsername: update.telegramUsername,
    });

    if (result.ok) {
      await this.reply(update.chatId, LINKED_TEXT);
      return;
    }

    await this.reply(
      update.chatId,
      result.reason === 'chat_linked_to_other_user'
        ? CHAT_TAKEN_TEXT
        : INVALID_CODE_TEXT,
    );
  }

  private async consumeLinkCode(input: {
    code: string;
    chatId: string;
    telegramUserId: string | null;
    telegramUsername: string | null;
  }) {
    const { data, error } = await this.supabase.getClient().rpc('link_telegram_account', {
      p_code_hash: hashTelegramLinkCode(input.code),
      p_telegram_chat_id: input.chatId,
      p_telegram_user_id: input.telegramUserId ?? '',
      p_telegram_username: input.telegramUsername ?? '',
    });

    if (error) {
      this.logger.error({
        message: 'Telegram link RPC failed',
        error: redactTelegramSecrets(error.message, this.#token, input.chatId),
        code: error.code,
      });
      return { ok: false as const, reason: 'invalid_or_expired' as const };
    }

    return mapLinkResult(data);
  }

  private async claimUpdate(updateId: number): Promise<boolean> {
    const { error } = await this.supabase
      .getClient()
      .from(UPDATES_TABLE)
      .insert({ update_id: updateId });

    if (!error) {
      return true;
    }

    if (error.code === '23505') {
      return false;
    }

    this.logger.error({
      message: 'Failed to record Telegram update id',
      updateId,
      error: redactTelegramSecrets(error.message, this.#token),
      code: error.code,
    });
    return false;
  }

  private async reply(chatId: string, text: string): Promise<void> {
    const token = this.#token;
    if (!token) {
      return;
    }

    try {
      const response = await this.httpPost(telegramSendMessageUrl(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
      });

      const payload: unknown = await response.json().catch(() => null);
      const ok = response.ok && isRecord(payload) && payload.ok === true;
      if (ok) {
        return;
      }

      this.logger.warn({
        message: 'Telegram webhook reply failed',
        status: response.status,
        description:
          isRecord(payload) && typeof payload.description === 'string'
            ? redactTelegramSecrets(payload.description, token, chatId)
            : null,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Telegram webhook reply request failed',
        error: safeErrorMessage(error, token, chatId),
      });
    }
  }
}
