import { Module, forwardRef } from '@nestjs/common';

import { DuplicatesModule } from '../duplicates/duplicates.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { SearchesModule } from '../searches/searches.module.js';
import { SourcesModule } from '../sources/sources.module.js';
import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryService } from './discovery.service.js';
import { DiscoveryRunStateStore } from './discovery-run-state.js';
import { PostgresDiscoveryRunStateStore } from './discovery-run-state.postgres.js';

@Module({
  imports: [
    forwardRef(() => SearchesModule),
    SourcesModule,
    MatchingModule,
    DuplicatesModule,
    JobsModule,
    LocationsModule,
    NotificationsModule,
    ProfilesModule,
    SupabaseModule,
  ],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    DevEndpointsGuard,
    {
      provide: DiscoveryRunStateStore,
      useClass: PostgresDiscoveryRunStateStore,
    },
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
