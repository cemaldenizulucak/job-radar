import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
