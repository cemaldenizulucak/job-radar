import type { DiscoveryRunSummary } from '../discovery/discovery.types.js';

export type ScheduleTrigger = 'scheduled' | 'manual';

export type SchedulerRunStatus = 'completed' | 'skipped_overlap' | 'failed';

export type SchedulerRunResult = {
  trigger: ScheduleTrigger;
  status: SchedulerRunStatus;
  summary: DiscoveryRunSummary;
};

export const DEFAULT_SCHEDULER_TIMEZONE = 'Europe/Istanbul';
