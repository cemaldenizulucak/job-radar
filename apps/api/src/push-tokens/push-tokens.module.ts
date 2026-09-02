import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { ExpoPushClient } from './expo-push.client.js';
import { PushNotificationsService } from './push-notifications.service.js';
import { PushTokensController } from './push-tokens.controller.js';
import { PushTokensService } from './push-tokens.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [PushTokensController],
  providers: [PushTokensService, ExpoPushClient, PushNotificationsService],
  exports: [PushTokensService, PushNotificationsService],
})
export class PushTokensModule {}
