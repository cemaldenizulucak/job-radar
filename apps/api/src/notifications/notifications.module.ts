import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { PushTokensModule } from '../push-tokens/push-tokens.module.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [SupabaseModule, PushTokensModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DevEndpointsGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
