import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { TelegramConnectionService } from './telegram-connection.service.js';
import { TelegramLinkService } from './telegram-link.service.js';
import { MemoryRateLimiter } from './telegram-rate-limit.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';
import { TelegramController } from './telegram.controller.js';

@Module({
  imports: [SupabaseModule],
  controllers: [TelegramController],
  providers: [
    MemoryRateLimiter,
    TelegramLinkService,
    TelegramWebhookService,
    TelegramConnectionService,
  ],
  exports: [TelegramConnectionService],
})
export class TelegramModule {}
