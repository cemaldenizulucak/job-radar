import {
  isDiscoverySchedulerEnabled,
  parseBooleanFlag,
  toIntervalCron,
} from './scheduler-config.service.js';
import { DEFAULT_SCHEDULER_TIMEZONE } from './scheduler.types.js';

describe('scheduler configuration', () => {
  it('builds an every-N-hours cron in Europe/Istanbul', () => {
    expect(toIntervalCron(2)).toBe('0 */2 * * *');
    expect(toIntervalCron(1)).toBe('0 */1 * * *');
    expect(toIntervalCron(0)).toBe('0 */1 * * *');
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
