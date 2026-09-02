import type { SchedulerRegistry } from '@nestjs/schedule';
import type { CronJob } from 'cron';

import { DiscoveryScheduleHost } from './discovery-schedule.host.js';
import { SchedulerConfigService } from './scheduler-config.service.js';
import { SchedulerService } from './scheduler.service.js';
import { DEFAULT_SCHEDULER_TIMEZONE } from './scheduler.types.js';

function createHost(
  enabled: boolean,
  registry: Pick<SchedulerRegistry, 'addCronJob'>,
) {
  return new DiscoveryScheduleHost(
    {
      isEnabled: () => enabled,
      getTimezone: () => DEFAULT_SCHEDULER_TIMEZONE,
      getCron: () => '0 */2 * * *',
      getIntervalHours: () => 2,
    } as SchedulerConfigService,
    {
      runScheduled: async () => undefined,
    } as unknown as SchedulerService,
    registry as SchedulerRegistry,
  );
}

describe('DiscoveryScheduleHost', () => {
  it('does not register cron jobs when the scheduler is disabled', () => {
    const addCronJob = vi.fn();
    const host = createHost(false, { addCronJob });

    host.onModuleInit();

    expect(addCronJob).not.toHaveBeenCalled();
  });

  it('registers the interval cron when the scheduler is enabled', () => {
    const jobs: CronJob[] = [];
    const addCronJob = vi.fn((_name: string, job: CronJob) => {
      jobs.push(job);
    });
    const host = createHost(true, { addCronJob });

    host.onModuleInit();

    expect(addCronJob).toHaveBeenCalledOnce();
    for (const job of jobs) {
      job.stop();
    }
  });
});
