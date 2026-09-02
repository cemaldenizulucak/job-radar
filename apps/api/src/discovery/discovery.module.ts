import { Module, forwardRef } from '@nestjs/common';

import { DuplicatesModule } from '../duplicates/duplicates.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SearchesModule } from '../searches/searches.module.js';
import { SourcesModule } from '../sources/sources.module.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryService } from './discovery.service.js';

@Module({
  imports: [
    forwardRef(() => SearchesModule),
    SourcesModule,
    MatchingModule,
    DuplicatesModule,
    JobsModule,
    NotificationsModule,
  ],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DevEndpointsGuard],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
