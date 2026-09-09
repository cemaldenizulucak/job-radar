import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const TELEGRAM_LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const TELEGRAM_LINK_CODE_DIGITS = 10;
export const TELEGRAM_LINK_CODE_PATTERN = /^JR-\d{10}$/;

export function generateTelegramLinkCode(): string {
  const digits = Array.from({ length: TELEGRAM_LINK_CODE_DIGITS }, () =>
    String(randomInt(0, 10)),
  ).join('');
  return `JR-${digits}`;
}

export function normalizeTelegramLinkCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isTelegramLinkCodeFormat(raw: string): boolean {
  return TELEGRAM_LINK_CODE_PATTERN.test(normalizeTelegramLinkCode(raw));
}

export function hashTelegramLinkCode(raw: string): string {
  return createHash('sha256')
    .update(normalizeTelegramLinkCode(raw), 'utf8')
    .digest('hex');
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
