import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesService } from './favorites.service.js';

@Module({
  imports: [SupabaseModule, JobsModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
