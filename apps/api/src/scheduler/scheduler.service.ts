import { Injectable, Logger } from '@nestjs/common';

import { DiscoveryService } from '../discovery/discovery.service.js';
import { EMPTY_DISCOVERY_SUMMARY } from '../discovery/discovery.types.js';
import { SchedulerConfigService } from './scheduler-config.service.js';
import type { SchedulerRunResult, ScheduleTrigger } from './scheduler.types.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly schedulerConfig: SchedulerConfigService,
  ) {}

  getIntervalHours(): number {
    return this.schedulerConfig.getIntervalHours();
  }

  runManual(): Promise<SchedulerRunResult> {
    return this.execute('manual', { swallowErrors: false });
  }

  runScheduled(): Promise<SchedulerRunResult> {
    return this.execute('scheduled', { swallowErrors: true });
  }

  private async execute(
    trigger: ScheduleTrigger,
    options: { swallowErrors: boolean },
  ): Promise<SchedulerRunResult> {
    if (this.running) {
      this.logger.log({
        message: 'Skipping discovery; a run is already in progress',
        trigger,
      });
      return {
        trigger,
        status: 'skipped_overlap',
        summary: { ...EMPTY_DISCOVERY_SUMMARY },
      };
    }

    this.running = true;
    this.logger.log({
      message: 'Discovery run started',
      trigger,
    });

    try {
      const summary = await this.discoveryService.run();
      this.logger.log({
        message: 'Discovery run finished',
        trigger,
        searchesProcessed: summary.searchesProcessed,
        jobsFetched: summary.jobsFetched,
        jobsInserted: summary.jobsInserted,
        matchesCreated: summary.matchesCreated,
        duplicateGroupsCreated: summary.duplicateGroupsCreated,
        notificationsCreated: summary.notificationsCreated,
        kariyerNetPagesFetched: summary.kariyerNetPagesFetched,
        kariyerNetJobsCollected: summary.kariyerNetJobsCollected,
        stopReason: summary.stopReason,
      });
      return { trigger, status: 'completed', summary };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'unknown';
      this.logger.error({
        message: 'Discovery run failed',
        trigger,
        error: errorMessage,
      });

      if (!options.swallowErrors) {
        throw error;
      }

      return {
        trigger,
        status: 'failed',
        summary: { ...EMPTY_DISCOVERY_SUMMARY },
      };
    } finally {
      this.running = false;
    }
  }
}
