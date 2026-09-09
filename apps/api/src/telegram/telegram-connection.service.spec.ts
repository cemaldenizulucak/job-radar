import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { TelegramConnectionService } from './telegram-connection.service.js';
import { FakeTelegramStore } from './telegram-store.fake.js';

describe('TelegramConnectionService', () => {
  it('resolves connected users and only the mapped legacy user', async () => {
    const store = new FakeTelegramStore();
    store.addConnection({ userId: 'user-a', chatId: '111' });
    const service = new TelegramConnectionService(
      {
        get: (key: string) => {
          if (key === 'TELEGRAM_CHAT_ID') return '999';
          if (key === 'TELEGRAM_LEGACY_USER_ID') return 'legacy-user';
          return undefined;
        },
      } as ConfigService,
      { getClient: () => store } as unknown as SupabaseService,
    );

    const resolved = await service.resolveChatIds([
      'user-a',
      'legacy-user',
      'other-user',
    ]);

    expect(resolved.get('user-a')).toBe('111');
    expect(resolved.get('legacy-user')).toBe('999');
    expect(resolved.has('other-user')).toBe(false);
  });

  it('does not fall back when TELEGRAM_LEGACY_USER_ID is missing', async () => {
    const service = new TelegramConnectionService(
      {
        get: (key: string) => (key === 'TELEGRAM_CHAT_ID' ? '999' : undefined),
      } as ConfigService,
      { getClient: () => new FakeTelegramStore() } as unknown as SupabaseService,
    );

    const resolved = await service.resolveChatIds(['anyone']);
    expect(resolved.size).toBe(0);
  });
});
