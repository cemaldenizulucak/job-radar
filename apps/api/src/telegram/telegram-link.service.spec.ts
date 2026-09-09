import { inspect } from 'node:util';

import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { TELEGRAM_LINK_CODE_LIMIT } from './telegram-rate-limit.js';
import { hashTelegramLinkCode, isTelegramLinkCodeFormat } from './telegram-code.js';
import { TelegramLinkService } from './telegram-link.service.js';
import { FakeTelegramStore } from './telegram-store.fake.js';
import { MemoryRateLimiter } from './telegram-rate-limit.js';

const USER_A = 'user-a';
const USER_B = 'user-b';

function createService(store = new FakeTelegramStore()) {
  const service = new TelegramLinkService(
    {
      get: (key: string) =>
        key === 'TELEGRAM_BOT_USERNAME' ? 'JobRadarBot' : undefined,
    } as ConfigService,
    { getClient: () => store } as unknown as SupabaseService,
    new MemoryRateLimiter(),
  );
  return { service, store };
}

describe('TelegramLinkService', () => {
  it('issues a one-time code, invalidates the previous active code, and never stores the raw value', async () => {
    const { service, store } = createService();

    const first = await service.createLinkCode(USER_A);
    const second = await service.createLinkCode(USER_A);

    expect(isTelegramLinkCodeFormat(first.code)).toBe(true);
    expect(isTelegramLinkCodeFormat(second.code)).toBe(true);
    expect(first.code).not.toBe(second.code);
    expect(store.rawCodes).toBeUndefined();
    expect(
      [...store.linkCodes.values()].every(
        (row) => row.code_hash !== first.code && row.code_hash !== second.code,
      ),
    ).toBe(true);
    expect(
      [...store.linkCodes.values()].filter((row) => row.consumed_at === null),
    ).toHaveLength(1);
    expect(
      [...store.linkCodes.values()].some(
        (row) => row.code_hash === hashTelegramLinkCode(second.code),
      ),
    ).toBe(true);
  });

  it('returns masked status without a chat id', async () => {
    const store = new FakeTelegramStore();
    store.addConnection({
      userId: USER_A,
      chatId: '9988776655',
      username: 'ada_lovelace',
      telegramUserId: '1001',
    });
    const { service } = createService(store);

    const status = await service.getStatus(USER_A);

    expect(status.connected).toBe(true);
    expect(status.displayName).toBe('@ad***e');
    expect(status.botUsername).toBe('JobRadarBot');
    expect(JSON.stringify(status)).not.toContain('9988776655');
  });

  it('disconnects only the authenticated user', async () => {
    const store = new FakeTelegramStore();
    store.addConnection({ userId: USER_A, chatId: '111' });
    store.addConnection({ userId: USER_B, chatId: '222' });
    const { service } = createService(store);

    await service.disconnect(USER_A);

    expect(store.connections.has(USER_A)).toBe(false);
    expect(store.connections.has(USER_B)).toBe(true);
  });

  it('rate limits link-code creation', async () => {
    const { service } = createService();

    for (let index = 0; index < TELEGRAM_LINK_CODE_LIMIT; index += 1) {
      await service.createLinkCode(USER_A);
    }

    await expect(service.createLinkCode(USER_A)).rejects.toBeInstanceOf(HttpException);
  });

  it('does not serialize secrets', () => {
    const { service } = createService();
    expect(JSON.stringify(service)).toBe('{"name":"TelegramLinkService"}');
    expect(inspect(service)).toBe('TelegramLinkService');
  });
});
