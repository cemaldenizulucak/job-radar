import { isRecord } from '../common/request.js';
import type { TelegramConnectionRow, TelegramLinkResult } from './telegram.types.js';

export function readNonEmptyString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function mapChatLookup(
  value: unknown,
): { userId: string; chatId: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = readNonEmptyString(value, 'user_id');
  const chatId = readNonEmptyString(value, 'telegram_chat_id');
  if (!userId || !chatId) {
    return null;
  }

  return { userId, chatId };
}

export function mapConnectionRow(value: unknown): TelegramConnectionRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readNonEmptyString(value, 'id');
  const userId = readNonEmptyString(value, 'user_id');
  const telegramChatId = readNonEmptyString(value, 'telegram_chat_id');
  const connectedAt = readNonEmptyString(value, 'connected_at');
  if (!id || !userId || !telegramChatId || !connectedAt) {
    return null;
  }

  return {
    id,
    userId,
    telegramChatId,
    telegramUserId: readNonEmptyString(value, 'telegram_user_id'),
    telegramUsername: readNonEmptyString(value, 'telegram_username'),
    connectedAt,
  };
}

export function mapLinkResult(value: unknown): TelegramLinkResult {
  if (!isRecord(value) || value.ok !== true) {
    const reason =
      isRecord(value) && value.reason === 'chat_linked_to_other_user'
        ? 'chat_linked_to_other_user'
        : 'invalid_or_expired';
    return { ok: false, reason };
  }

  const userId = readNonEmptyString(value, 'user_id');
  if (!userId) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  return { ok: true, userId };
}
