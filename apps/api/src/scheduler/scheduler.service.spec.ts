import { DiscoveryService } from '../discovery/discovery.service.js';
import {
  EMPTY_DISCOVERY_SUMMARY,
  type DiscoveryRunSummary,
} from '../discovery/discovery.types.js';
import { SchedulerConfigService } from './scheduler-config.service.js';
import { SchedulerService } from './scheduler.service.js';

const emptySummary: DiscoveryRunSummary = { ...EMPTY_DISCOVERY_SUMMARY };

function createScheduler(run: DiscoveryService['run']): SchedulerService {
  return new SchedulerService(
    { run } as DiscoveryService,
    {
      getIntervalHours: () => 1,
    } as unknown as SchedulerConfigService,
  );
}

describe('SchedulerService', () => {
  it('exposes the configured discovery interval', () => {
    const scheduler = createScheduler(async () => emptySummary);

    expect(scheduler.getIntervalHours()).toBe(1);
  });

  it('triggers DiscoveryService and returns the summary', async () => {
    const summary: DiscoveryRunSummary = {
      ...EMPTY_DISCOVERY_SUMMARY,
      searchesProcessed: 1,
      jobsFetched: 6,
      jobsInserted: 2,
      matchesCreated: 2,
      duplicateGroupsCreated: 1,
      notificationsCreated: 0,
      kariyerNetPagesFetched: 1,
      kariyerNetJobsCollected: 4,
      stopReason: 'blocked_after_success',
      sourceAttempts: 2,
      sourceFailures: 0,
    };
    const scheduler = createScheduler(async () => summary);

    await expect(scheduler.runManual()).resolves.toEqual({
      trigger: 'manual',
      status: 'completed',
      summary,
    });
  });

  it('skips overlapping discovery runs', async () => {
    let release: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scheduler = createScheduler(async () => {
      await started;
      return emptySummary;
    });

    const first = scheduler.runManual();
    const overlapping = await scheduler.runScheduled();

    expect(overlapping).toEqual({
      trigger: 'scheduled',
      status: 'skipped_overlap',
      summary: emptySummary,
    });

    release();
    await expect(first).resolves.toMatchObject({ status: 'completed' });
  });

  it('allows another run after the previous one finishes', async () => {
    let calls = 0;
    const scheduler = createScheduler(async () => {
      calls += 1;
      return emptySummary;
    });

    await scheduler.runManual();
    await scheduler.runManual();

    expect(calls).toBe(2);
  });

  it('swallows scheduled failures so cron does not crash the process', async () => {
    const scheduler = createScheduler(async () => {
      throw new Error('adapter unavailable');
    });

    await expect(scheduler.runScheduled()).resolves.toEqual({
      trigger: 'scheduled',
      status: 'failed',
      summary: emptySummary,
    });
  });

  it('rethrows manual discovery failures', async () => {
    const scheduler = createScheduler(async () => {
      throw new Error('adapter unavailable');
    });

    await expect(scheduler.runManual()).rejects.toThrow('adapter unavailable');
  });
});
