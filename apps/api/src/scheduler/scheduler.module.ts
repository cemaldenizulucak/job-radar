import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { DiscoveryModule } from '../discovery/discovery.module.js';
import { DiscoveryScheduleHost } from './discovery-schedule.host.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { SchedulerConfigService } from './scheduler-config.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { SchedulerService } from './scheduler.service.js';

@Module({
  imports: [ScheduleModule.forRoot(), DiscoveryModule],
  controllers: [SchedulerController],
  providers: [
    SchedulerConfigService,
    SchedulerService,
    DiscoveryScheduleHost,
    DevEndpointsGuard,
  ],
  exports: [SchedulerService, SchedulerConfigService],
})
export class SchedulerModule {}
