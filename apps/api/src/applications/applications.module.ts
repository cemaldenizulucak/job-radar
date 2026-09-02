import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  imports: [SupabaseModule, JobsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
