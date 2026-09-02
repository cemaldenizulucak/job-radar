import { Module, forwardRef } from '@nestjs/common';

import { DiscoveryModule } from '../discovery/discovery.module.js';
import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { SearchesController } from './searches.controller.js';
import { SearchesService } from './searches.service.js';

@Module({
  imports: [SupabaseModule, forwardRef(() => DiscoveryModule)],
  controllers: [SearchesController],
  providers: [SearchesService],
  exports: [SearchesService],
})
export class SearchesModule {}
