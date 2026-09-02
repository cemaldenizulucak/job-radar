import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { DuplicateGroupsService } from './duplicate-groups.service.js';
import { DuplicatesService } from './duplicates.service.js';

@Module({
  imports: [SupabaseModule],
  providers: [DuplicatesService, DuplicateGroupsService],
  exports: [DuplicatesService, DuplicateGroupsService],
})
export class DuplicatesModule {}
