export type ImmediateDiscoveryStatus =
  | 'pending'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped';

export type ImmediateDiscoveryResult = {
  status: ImmediateDiscoveryStatus;
  jobsFetched: number;
  matchesCreated: number;
  lastDiscoveryAt: string | null;
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
  sourcePartials: number;
  catalogJobsChecked: number;
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
  sourcePartials: 0,
  catalogJobsChecked: 0,
  rawProviderJobs: 0,
  normalizedJobs: 0,
  notifiedJobCount: 0,
};

export const PENDING_DISCOVERY_RESULT: ImmediateDiscoveryResult = {
  status: 'pending',
  jobsFetched: 0,
  matchesCreated: 0,
  lastDiscoveryAt: null,
};

export const SKIPPED_DISCOVERY_RESULT: ImmediateDiscoveryResult = {
  status: 'skipped',
  jobsFetched: 0,
  matchesCreated: 0,
  lastDiscoveryAt: null,
};

export function toImmediateDiscoveryResult(
  summary: DiscoveryRunSummary,
  lastDiscoveryAt: string | null = null,
): ImmediateDiscoveryResult {
  return {
    status: immediateDiscoveryStatus(summary),
    jobsFetched: summary.jobsFetched,
    matchesCreated: summary.matchesCreated,
    lastDiscoveryAt,
  };
}

export function immediateDiscoveryStatus(
  summary: DiscoveryRunSummary,
): Exclude<ImmediateDiscoveryStatus, 'skipped'> {
  if (summary.sourceAttempts === 0) {
    return 'completed';
  }

  if (
    summary.sourceFailures >= summary.sourceAttempts &&
    summary.sourcePartials === 0
  ) {
    return 'failed';
  }

  if (summary.sourceFailures > 0 || summary.sourcePartials > 0) {
    return 'partial';
  }

  return 'completed';
}

export const FAILED_DISCOVERY_RESULT: ImmediateDiscoveryResult = {
  status: 'failed',
  jobsFetched: 0,
  matchesCreated: 0,
  lastDiscoveryAt: null,
};

export type MatchReevaluationPair = {
  jobId: string;
  savedSearchId: string;
  title?: string;
  searchName?: string;
};

export type MatchReevaluationReport = {
  dryRun: boolean;
  searchesEvaluated: number;
  jobsEvaluated: number;
  existingMatches: number;
  desiredMatches: number;
  keepCount: number;
  insertCount: number;
  deleteCount: number;
  listingsUnchanged: true;
  applicationsUnchanged: true;
  sampleKept: readonly MatchReevaluationPair[];
  sampleInserts: readonly MatchReevaluationPair[];
  sampleDeletes: readonly MatchReevaluationPair[];
};
