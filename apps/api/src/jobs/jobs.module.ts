import { Module } from '@nestjs/common';

import { MatchingModule } from '../matching/matching.module.js';
import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [SupabaseModule, MatchingModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
