import { isRecord } from '../common/request.js';
import { isTelegramLinkCodeFormat, normalizeTelegramLinkCode } from './telegram-code.js';

export type TelegramPrivateTextCommand =
  | { kind: 'start' | 'help' }
  | { kind: 'link'; code: string | null; formatValid: boolean };

export type TelegramPrivateTextUpdate = {
  updateId: number;
  chatId: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  command: TelegramPrivateTextCommand | null;
};

export function parseTelegramUpdateId(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const updateId = value.update_id;
  if (typeof updateId === 'number' && Number.isInteger(updateId)) {
    return updateId;
  }
  if (typeof updateId === 'string' && /^-?\d+$/.test(updateId)) {
    return Number(updateId);
  }
  return null;
}

export function parsePrivateTextUpdate(
  value: unknown,
): TelegramPrivateTextUpdate | 'ignored' | 'group' {
  if (!isRecord(value)) {
    return 'ignored';
  }

  const updateId = parseTelegramUpdateId(value);
  const message = value.message;
  if (updateId === null || !isRecord(message)) {
    return 'ignored';
  }

  if (hasMedia(message)) {
    return 'ignored';
  }

  const chat = isRecord(message.chat) ? message.chat : null;
  const chatType = chat ? readString(chat, 'type') : null;
  const chatId = chat ? readChatId(chat.id) : null;
  if (!chat || !chatType || !chatId) {
    return 'ignored';
  }

  if (chatType !== 'private') {
    return 'group';
  }

  const text = readString(message, 'text');
  if (!text) {
    return 'ignored';
  }

  const from = isRecord(message.from) ? message.from : null;

  return {
    updateId,
    chatId,
    telegramUserId: from ? readChatId(from.id) : null,
    telegramUsername: from ? readString(from, 'username') : null,
    command: parseCommand(text),
  };
}

export function parseCommand(text: string): TelegramPrivateTextCommand | null {
  const trimmed = text.trim();
  const start = trimmed.match(/^\/start(?:@\w+)?(?:\s|$)/i);
  if (start) {
    return { kind: 'start' };
  }

  const help = trimmed.match(/^\/help(?:@\w+)?(?:\s|$)/i);
  if (help) {
    return { kind: 'help' };
  }

  const link = trimmed.match(/^\/link(?:@\w+)?(?:\s+(.+))?$/i);
  if (!link) {
    return null;
  }

  const rawCode = link[1]?.trim() ?? '';
  if (rawCode.length === 0) {
    return { kind: 'link', code: null, formatValid: false };
  }

  const normalized = normalizeTelegramLinkCode(rawCode);
  return {
    kind: 'link',
    code: normalized,
    formatValid: isTelegramLinkCodeFormat(normalized),
  };
}

function hasMedia(message: Record<string, unknown>): boolean {
  return (
    message.photo !== undefined ||
    message.document !== undefined ||
    message.video !== undefined ||
    message.audio !== undefined ||
    message.voice !== undefined ||
    message.sticker !== undefined ||
    message.animation !== undefined ||
    message.video_note !== undefined
  );
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readChatId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}
