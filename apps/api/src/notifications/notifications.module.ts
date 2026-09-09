import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { PushTokensModule } from '../push-tokens/push-tokens.module.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { TelegramNotificationService } from './telegram-notification.service.js';

@Module({
  imports: [SupabaseModule, PushTokensModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TelegramNotificationService,
    DevEndpointsGuard,
  ],
  exports: [NotificationsService, TelegramNotificationService],
})
export class NotificationsModule {}
