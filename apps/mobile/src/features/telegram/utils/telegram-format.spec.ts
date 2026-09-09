import { describe, expect, it } from 'vitest';

import { telegramCopy } from '../copy';
import { formatCodeExpiry, telegramBotUrl } from './telegram-format';

describe('telegram format helpers', () => {
  it('formats remaining minutes and expired codes', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(formatCodeExpiry('2026-01-01T00:09:00.000Z', now)).toBe(
      telegramCopy.expiresIn(9),
    );
    expect(formatCodeExpiry('2025-12-31T23:59:00.000Z', now)).toBe(
      telegramCopy.codeExpired,
    );
  });

  it('builds a t.me url without letting the user type a username', () => {
    expect(telegramBotUrl('JobRadarBot')).toBe('https://t.me/JobRadarBot');
    expect(telegramBotUrl('@JobRadarBot')).toBe('https://t.me/JobRadarBot');
    expect(telegramBotUrl('')).toBeNull();
  });
});
