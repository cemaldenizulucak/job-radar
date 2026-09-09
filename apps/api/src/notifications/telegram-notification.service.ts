import { inspect } from 'node:util';

import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import {
  resolveTelegramChatIds,
  type TelegramChatLookupClient,
} from '../telegram/telegram-connection.service.js';
import {
  readOptionalTelegramEnv,
} from '../telegram/telegram-env.js';
import {
  defaultTelegramHttpPost,
  TELEGRAM_HTTP_POST,
  TELEGRAM_REQUEST_TIMEOUT_MS,
  telegramSendMessageUrl,
  type TelegramHttpPost,
} from '../telegram/telegram-http.js';
import {
  groupJobsForTelegram,
  isSafeHttpUrl,
  splitTelegramMessages,
} from './telegram-message.js';
import { redactTelegramSecrets, safeErrorMessage } from './telegram-secrets.js';
import type {
  TelegramJobItem,
  TelegramLedgerRow,
  TelegramLedgerStatus,
  TelegramNotifyInput,
} from './telegram-types.js';

export { TELEGRAM_HTTP_POST, type TelegramHttpPost };

export const TELEGRAM_CLAIM_STALE_MS = 10 * 60 * 1000;
const TELEGRAM_LEDGER_TABLE = 'telegram_job_notifications';
const TELEGRAM_LEDGER_SELECT =
  'id, user_id, job_id, status, payload, claimed_at, sent_at';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class TelegramNotificationService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotificationService.name);
  readonly #token: string | null;
  readonly #legacyChatId: string | null;
  readonly #legacyUserId: string | null;
  private readonly httpPost: TelegramHttpPost;

  constructor(
    configService: ConfigService,
    private readonly supabase: SupabaseService,
    @Optional()
    @Inject(TELEGRAM_HTTP_POST)
    httpPost?: TelegramHttpPost,
  ) {
    this.#token = readOptionalTelegramEnv(configService, 'TELEGRAM_BOT_TOKEN');
    this.#legacyChatId = readOptionalTelegramEnv(configService, 'TELEGRAM_CHAT_ID');
    this.#legacyUserId = readOptionalTelegramEnv(
      configService,
      'TELEGRAM_LEGACY_USER_ID',
    );
    this.httpPost = httpPost ?? defaultTelegramHttpPost;
  }

  onModuleInit(): void {
    if (this.isEnabled()) {
      this.logger.log('Telegram notifications enabled');
      if (this.#legacyChatId && !this.#legacyUserId) {
        this.logger.warn(
          'TELEGRAM_CHAT_ID is ignored because TELEGRAM_LEGACY_USER_ID is not set',
        );
      }
      return;
    }

    this.logger.warn(
      'Telegram notifications disabled because TELEGRAM_BOT_TOKEN is not set',
    );
  }

  isEnabled(): boolean {
    return this.#token !== null;
  }

  async notifyNewMatches(input: TelegramNotifyInput): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const items = groupJobsForTelegram(input);
      const chatIds = await this.resolveChatIds(items.map((item) => item.userId));

      for (const item of items) {
        if (!chatIds.has(item.userId)) {
          continue;
        }
        await this.insertPending(item);
      }

      const claimed = await this.claimReadyItems();
      if (claimed.length === 0) {
        return;
      }

      const byUser = groupClaimedByUser(claimed, chatIds);
      for (const [userId, userItems] of byUser) {
        const chatId = chatIds.get(userId);
        if (!chatId) {
          await this.revertToPending(userId, userItems.map((item) => item.jobId));
          continue;
        }

        const messages = splitTelegramMessages(userItems);
        for (const message of messages) {
          const sent = await this.sendPlainText(chatId, message.text);
          if (sent) {
            await this.markSent(userId, message.jobIds);
          } else {
            await this.revertToPending(userId, message.jobIds);
          }
        }
      }
    } catch (error) {
      this.logger.warn({
        message: 'Telegram notification failed; discovery continues',
        error: safeErrorMessage(error, this.#token, this.#legacyChatId),
      });
    }
  }

  toJSON(): { name: string; enabled: boolean } {
    return { name: 'TelegramNotificationService', enabled: this.isEnabled() };
  }

  [inspect.custom](): string {
    return `TelegramNotificationService enabled=${this.isEnabled()}`;
  }

  private async resolveChatIds(userIds: readonly string[]): Promise<Map<string, string>> {
    return resolveTelegramChatIds(
      this.supabase.getClient() as unknown as TelegramChatLookupClient,
      userIds,
      { userId: this.#legacyUserId, chatId: this.#legacyChatId },
      (error) => this.logSupabaseError(error, 'Failed to load Telegram connections'),
    );
  }

  private async insertPending(item: TelegramJobItem): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .insert({
        user_id: item.userId,
        job_id: item.jobId,
        status: 'pending',
        payload: item,
      })
      .select(TELEGRAM_LEDGER_SELECT)
      .maybeSingle();

    if (!error) {
      return;
    }

    if (isUniqueViolation(error)) {
      return;
    }

    this.logSupabaseError(error, 'Failed to record Telegram notification claim');
  }

  private async claimReadyItems(): Promise<TelegramJobItem[]> {
    const retryable = await this.listRetryable();
    const claimed: TelegramJobItem[] = [];

    for (const row of retryable) {
      const won = await this.claimRow(row);
      if (won) {
        claimed.push(row.payload);
      }
    }

    return claimed;
  }

  private async listRetryable(): Promise<TelegramLedgerRow[]> {
    const pending = await this.selectByStatus('pending');
    const sending = await this.selectByStatus('sending');
    const staleBefore = new Date(Date.now() - TELEGRAM_CLAIM_STALE_MS).toISOString();

    return [
      ...pending,
      ...sending.filter(
        (row) => !row.claimedAt || row.claimedAt <= staleBefore,
      ),
    ];
  }

  private async selectByStatus(
    status: TelegramLedgerStatus,
  ): Promise<TelegramLedgerRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .select(TELEGRAM_LEDGER_SELECT)
      .eq('status', status);

    if (error) {
      this.logSupabaseError(error, 'Failed to load Telegram notification ledger');
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((row) => mapLedgerRow(row))
      .filter((row): row is TelegramLedgerRow => row !== null);
  }

  private async claimRow(row: TelegramLedgerRow): Promise<boolean> {
    const claimedAt = new Date().toISOString();
    let query = this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .update({
        status: 'sending',
        claimed_at: claimedAt,
      })
      .eq('user_id', row.userId)
      .eq('job_id', row.jobId)
      .eq('status', row.status);

    if (row.status === 'sending' && row.claimedAt) {
      query = query.eq('claimed_at', row.claimedAt);
    }

    const { data, error } = await query
      .select(TELEGRAM_LEDGER_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error, 'Failed to claim Telegram notification');
      return false;
    }

    return mapLedgerRow(data) !== null;
  }

  private async markSent(userId: string, jobIds: readonly string[]): Promise<void> {
    if (jobIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('job_id', [...jobIds])
      .eq('status', 'sending');

    if (error) {
      this.logSupabaseError(error, 'Failed to mark Telegram notification sent');
    }
  }

  private async revertToPending(
    userId: string,
    jobIds: readonly string[],
  ): Promise<void> {
    if (jobIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .update({
        status: 'pending',
        claimed_at: null,
      })
      .eq('user_id', userId)
      .in('job_id', [...jobIds])
      .eq('status', 'sending');

    if (error) {
      this.logSupabaseError(error, 'Failed to release Telegram notification claim');
    }
  }

  private async sendPlainText(chatId: string, text: string): Promise<boolean> {
    const token = this.#token;
    if (!token) {
      return false;
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
      const ok = response.ok && isTelegramOk(payload);
      if (ok) {
        this.logger.log('Sent Telegram job notification');
        return true;
      }

      this.logger.warn({
        message: 'Telegram sendMessage failed',
        status: response.status,
        description: telegramDescription(payload, token, chatId),
      });
      return false;
    } catch (error) {
      this.logger.warn({
        message: 'Telegram sendMessage request failed',
        error: safeErrorMessage(error, token, chatId),
      });
      return false;
    }
  }

  private logSupabaseError(error: SafeSupabaseError, message: string): void {
    this.logger.error({
      message,
      error: redactTelegramSecrets(
        error.message,
        this.#token,
        this.#legacyChatId,
      ),
      code: error.code,
    });
  }
}

function groupClaimedByUser(
  items: readonly TelegramJobItem[],
  chatIds: ReadonlyMap<string, string>,
): Map<string, TelegramJobItem[]> {
  const grouped = new Map<string, TelegramJobItem[]>();
  for (const item of items) {
    if (!chatIds.has(item.userId)) {
      continue;
    }
    const list = grouped.get(item.userId) ?? [];
    list.push(item);
    grouped.set(item.userId, list);
  }
  return grouped;
}

function isUniqueViolation(error: SafeSupabaseError): boolean {
  return error.code === '23505';
}

function isTelegramOk(payload: unknown): boolean {
  return isRecord(payload) && payload.ok === true;
}

function telegramDescription(
  payload: unknown,
  token: string,
  chatId: string,
): string | null {
  if (!isRecord(payload) || typeof payload.description !== 'string') {
    return null;
  }

  return redactTelegramSecrets(payload.description, token, chatId);
}

function mapLedgerRow(value: unknown): TelegramLedgerRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const jobId = readString(value, 'job_id');
  const status = parseLedgerStatus(value.status);
  const payload = mapPayload(value.payload);
  if (!id || !userId || !jobId || !status || !payload) {
    return null;
  }

  return {
    id,
    userId,
    jobId,
    status,
    payload,
    claimedAt: readString(value, 'claimed_at'),
    sentAt: readString(value, 'sent_at'),
  };
}

function mapPayload(value: unknown): TelegramJobItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const jobId = readString(value, 'jobId');
  const userId = readString(value, 'userId');
  const title = readString(value, 'title');
  const companyName = readString(value, 'companyName') ?? '';
  const sourceId = value.sourceId;
  const matchStatus = value.matchStatus;
  if (
    !jobId ||
    !userId ||
    !title ||
    (sourceId !== 'linkedin' && sourceId !== 'kariyer_net') ||
    (matchStatus !== 'verified' &&
      matchStatus !== 'unverified_source_candidate')
  ) {
    return null;
  }

  const searchNames = Array.isArray(value.searchNames)
    ? value.searchNames.filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      )
    : [];

  return {
    jobId,
    userId,
    title,
    companyName,
    location: readString(value, 'location'),
    sourceId,
    matchStatus,
    searchNames,
    listingUrl: isSafeHttpUrl(readString(value, 'listingUrl')),
  };
}

function parseLedgerStatus(value: unknown): TelegramLedgerStatus | null {
  if (value === 'pending' || value === 'sending' || value === 'sent') {
    return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
