import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { TelegramLinkService } from './telegram-link.service.js';
import { MemoryRateLimiter } from './telegram-rate-limit.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';
import { TelegramConnectionService } from './telegram-connection.service.js';
import { FakeTelegramStore } from './telegram-store.fake.js';

describe('Telegram module boot', () => {
  it('constructs link and webhook services when telegram env is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MemoryRateLimiter,
        TelegramLinkService,
        TelegramWebhookService,
        TelegramConnectionService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => new FakeTelegramStore() },
        },
      ],
    }).compile();

    const link = moduleRef.get(TelegramLinkService);
    const webhook = moduleRef.get(TelegramWebhookService);

    expect(link).toBeInstanceOf(TelegramLinkService);
    expect(webhook).toBeInstanceOf(TelegramWebhookService);
  });
});
