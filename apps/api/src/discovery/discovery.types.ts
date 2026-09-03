export type ImmediateDiscoveryStatus =
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped';

export type ImmediateDiscoveryResult = {
  status: ImmediateDiscoveryStatus;
  jobsFetched: number;
  matchesCreated: number;
};

export type DiscoveryRunSummary = {
  usersProcessed: number;
  searchesProcessed: number;
  jobsFetched: number;
  jobsInserted: number;
  matchesCreated: number;
  duplicateGroupsCreated: number;
  notificationsCreated: number;
  kariyerNetPagesFetched: number;
  kariyerNetJobsCollected: number;
  stopReason: string | null;
  sourceAttempts: number;
  sourceFailures: number;
  rawProviderJobs: number;
  normalizedJobs: number;
  notifiedJobCount: number;
};

export const EMPTY_DISCOVERY_SUMMARY: DiscoveryRunSummary = {
  usersProcessed: 0,
  searchesProcessed: 0,
  jobsFetched: 0,
  jobsInserted: 0,
  matchesCreated: 0,
  duplicateGroupsCreated: 0,
  notificationsCreated: 0,
  kariyerNetPagesFetched: 0,
  kariyerNetJobsCollected: 0,
  stopReason: null,
  sourceAttempts: 0,
  sourceFailures: 0,
  rawProviderJobs: 0,
  normalizedJobs: 0,
  notifiedJobCount: 0,
};

export const SKIPPED_DISCOVERY_RESULT: ImmediateDiscoveryResult = {
  status: 'skipped',
  jobsFetched: 0,
  matchesCreated: 0,
};

export function toImmediateDiscoveryResult(
  summary: DiscoveryRunSummary,
): ImmediateDiscoveryResult {
  return {
    status: immediateDiscoveryStatus(summary),
    jobsFetched: summary.jobsFetched,
    matchesCreated: summary.matchesCreated,
  };
}

export function immediateDiscoveryStatus(
  summary: DiscoveryRunSummary,
): Exclude<ImmediateDiscoveryStatus, 'skipped'> {
  if (summary.sourceAttempts === 0 || summary.sourceFailures === 0) {
    return 'completed';
  }

  if (summary.sourceFailures >= summary.sourceAttempts) {
    return 'failed';
  }

  return 'partial';
}

export const FAILED_DISCOVERY_RESULT: ImmediateDiscoveryResult = {
  status: 'failed',
  jobsFetched: 0,
  matchesCreated: 0,
};
