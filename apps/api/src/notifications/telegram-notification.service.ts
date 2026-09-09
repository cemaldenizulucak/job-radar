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

export const TELEGRAM_HTTP_POST = 'TELEGRAM_HTTP_POST';

export type TelegramHttpPost = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;
export const TELEGRAM_CLAIM_STALE_MS = 10 * 60 * 1000;
// One TELEGRAM_CHAT_ID for the whole API: every user search notifies the same
// chat. Deduping by job_id is enough — the same listing matching several
// searches (or several users) must produce one Telegram message. Per-user
// inbox rows stay on `notifications`.
const TELEGRAM_LEDGER_TABLE = 'telegram_job_notifications';
const TELEGRAM_LEDGER_SELECT =
  'id, job_id, status, payload, claimed_at, sent_at';

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
  readonly #chatId: string | null;
  private readonly httpPost: TelegramHttpPost;

  constructor(
    configService: ConfigService,
    private readonly supabase: SupabaseService,
    @Optional()
    @Inject(TELEGRAM_HTTP_POST)
    httpPost?: TelegramHttpPost,
  ) {
    this.#token = readOptionalEnv(configService, 'TELEGRAM_BOT_TOKEN');
    this.#chatId = readOptionalEnv(configService, 'TELEGRAM_CHAT_ID');
    this.httpPost = httpPost ?? defaultHttpPost;
  }

  onModuleInit(): void {
    if (this.isEnabled()) {
      this.logger.log('Telegram notifications enabled');
      return;
    }

    this.logger.warn(
      'Telegram notifications disabled because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set',
    );
  }

  isEnabled(): boolean {
    return this.#token !== null && this.#chatId !== null;
  }

  async notifyNewMatches(input: TelegramNotifyInput): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const items = groupJobsForTelegram(input);
      for (const item of items) {
        await this.insertPending(item);
      }

      const claimed = await this.claimReadyItems();
      if (claimed.length === 0) {
        return;
      }

      const messages = splitTelegramMessages(claimed);
      for (const message of messages) {
        const sent = await this.sendPlainText(message.text);
        if (sent) {
          await this.markSent(message.jobIds);
        } else {
          await this.revertToPending(message.jobIds);
        }
      }
    } catch (error) {
      this.logger.warn({
        message: 'Telegram notification failed; discovery continues',
        error: safeErrorMessage(error, this.#token, this.#chatId),
      });
    }
  }

  toJSON(): { name: string; enabled: boolean } {
    return { name: 'TelegramNotificationService', enabled: this.isEnabled() };
  }

  [inspect.custom](): string {
    return `TelegramNotificationService enabled=${this.isEnabled()}`;
  }

  private async insertPending(item: TelegramJobItem): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from(TELEGRAM_LEDGER_TABLE)
      .insert({
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

  private async markSent(jobIds: readonly string[]): Promise<void> {
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
      .in('job_id', [...jobIds])
      .eq('status', 'sending');

    if (error) {
      this.logSupabaseError(error, 'Failed to mark Telegram notification sent');
    }
  }

  private async revertToPending(jobIds: readonly string[]): Promise<void> {
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
      .in('job_id', [...jobIds])
      .eq('status', 'sending');

    if (error) {
      this.logSupabaseError(error, 'Failed to release Telegram notification claim');
    }
  }

  private async sendPlainText(text: string): Promise<boolean> {
    const token = this.#token;
    const chatId = this.#chatId;
    if (!token || !chatId) {
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
        this.#chatId,
      ),
      code: error.code,
    });
  }
}

function readOptionalEnv(
  configService: ConfigService,
  name: 'TELEGRAM_BOT_TOKEN' | 'TELEGRAM_CHAT_ID',
): string | null {
  const value = configService.get<string>(name);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultHttpPost(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function telegramSendMessageUrl(token: string): string {
  return `https://api.telegram.org/bot${token}/sendMessage`;
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
  const jobId = readString(value, 'job_id');
  const status = parseLedgerStatus(value.status);
  const payload = mapPayload(value.payload);
  if (!id || !jobId || !status || !payload) {
    return null;
  }

  return {
    id,
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
  const title = readString(value, 'title');
  const companyName = readString(value, 'companyName') ?? '';
  const sourceId = value.sourceId;
  const matchStatus = value.matchStatus;
  if (
    !jobId ||
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
