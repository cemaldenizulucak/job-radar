import { DEFAULT_DISCOVERY_INTERVAL_HOURS } from '../discovery/discovery-window.js';
import {
  isDiscoverySchedulerEnabled,
  parseBooleanFlag,
  SchedulerConfigService,
  toIntervalCron,
} from './scheduler-config.service.js';
import { DEFAULT_SCHEDULER_TIMEZONE } from './scheduler.types.js';

describe('scheduler configuration', () => {
  it('defaults to an hourly Europe/Istanbul cron', () => {
    const config = new SchedulerConfigService({
      get: () => undefined,
    } as never);

    expect(DEFAULT_DISCOVERY_INTERVAL_HOURS).toBe(1);
    expect(config.getIntervalHours()).toBe(1);
    expect(config.getCron()).toBe('0 * * * *');
    expect(config.getTimezone()).toBe('Europe/Istanbul');
  });

  it('builds an every-N-hours cron in Europe/Istanbul', () => {
    expect(toIntervalCron(2)).toBe('0 */2 * * *');
    expect(toIntervalCron(1)).toBe('0 * * * *');
    expect(toIntervalCron(0)).toBe('0 * * * *');
    expect(DEFAULT_SCHEDULER_TIMEZONE).toBe('Europe/Istanbul');
  });

  it('disables the scheduler unless DISCOVERY_SCHEDULER_ENABLED is explicitly true', () => {
    expect(parseBooleanFlag(undefined, false)).toBe(false);
    expect(parseBooleanFlag('', false)).toBe(false);
    expect(parseBooleanFlag('false', false)).toBe(false);
    expect(parseBooleanFlag('true', false)).toBe(true);
    expect(isDiscoverySchedulerEnabled(undefined, undefined)).toBe(false);
    expect(isDiscoverySchedulerEnabled('', 'true')).toBe(true);
    expect(isDiscoverySchedulerEnabled('false', 'true')).toBe(false);
    expect(isDiscoverySchedulerEnabled('true', 'false')).toBe(true);
  });
});
