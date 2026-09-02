import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import {
  DEFAULT_DISCOVERY_CRON_NAME,
  SchedulerConfigService,
} from './scheduler-config.service.js';
import { SchedulerService } from './scheduler.service.js';

@Injectable()
export class DiscoveryScheduleHost implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryScheduleHost.name);

  constructor(
    private readonly schedulerConfig: SchedulerConfigService,
    private readonly schedulerService: SchedulerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const enabled = this.schedulerConfig.isEnabled();
    const timezone = this.schedulerConfig.getTimezone();
    const intervalHours = this.schedulerConfig.getIntervalHours();

    this.logger.log({
      message: `Scheduler enabled: ${enabled}`,
      enabled,
      intervalHours,
      timezone,
    });

    if (!enabled) {
      return;
    }

    const cronTime = this.schedulerConfig.getCron();
    const job = CronJob.from({
      cronTime,
      timeZone: timezone,
      start: false,
      waitForCompletion: true,
      onTick: () => {
        void this.schedulerService.runScheduled();
      },
    });

    this.schedulerRegistry.addCronJob(DEFAULT_DISCOVERY_CRON_NAME, job);
    job.start();
    this.logger.log({
      message: 'Registered discovery schedule',
      cron: cronTime,
      intervalHours,
      timezone,
    });
  }
}
