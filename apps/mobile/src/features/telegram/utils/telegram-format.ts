import { telegramCopy } from '../copy';

export function formatCodeExpiry(expiresAt: string, now = new Date()): string {
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(remainingMs) || remainingMs <= 0) {
    return telegramCopy.codeExpired;
  }

  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return telegramCopy.expiresIn(minutes);
}

export function telegramBotUrl(botUsername: string | null): string | null {
  const trimmed = botUsername?.trim().replace(/^@/, '') ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  return `https://t.me/${trimmed}`;
}
