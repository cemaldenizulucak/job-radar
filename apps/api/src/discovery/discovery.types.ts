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
  jobsUpdated: number;
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
  runId: string;
  scanKind: 'first' | 'periodic' | 'user' | 'mixed';
  queriesPlanned: number;
  queriesAttempted: number;
  queriesCompleted: number;
  queriesBlocked: number;
  queriesFailed: number;
  queriesDeferred: number;
  queriesPartialBlocked: number;
  sourceChallengeObserved: boolean;
  detailsFetched: number;
  detailsFailed: number;
  detailsSelected: number;
  detailsAttempted: number;
  detailsSkipped: number;
  detailsBackoff: number;
  detailsQueued: number;
  detailsRequested: number;
  detailsDeferredDueToChallenge: number;
  descriptionsExtracted: number;
  providerModes: Readonly<Record<string, string>>;
  attemptCount: number;
  recoveredAfterRetry: boolean;
};

export const EMPTY_DISCOVERY_SUMMARY: DiscoveryRunSummary = {
  usersProcessed: 0,
  searchesProcessed: 0,
  jobsFetched: 0,
  jobsInserted: 0,
  jobsUpdated: 0,
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
  runId: '',
  scanKind: 'periodic',
  queriesPlanned: 0,
  queriesAttempted: 0,
  queriesCompleted: 0,
  queriesBlocked: 0,
  queriesFailed: 0,
  queriesDeferred: 0,
  queriesPartialBlocked: 0,
  sourceChallengeObserved: false,
  detailsFetched: 0,
  detailsFailed: 0,
  detailsSelected: 0,
  detailsAttempted: 0,
  detailsSkipped: 0,
  detailsBackoff: 0,
  detailsQueued: 0,
  detailsRequested: 0,
  detailsDeferredDueToChallenge: 0,
  descriptionsExtracted: 0,
  providerModes: {},
  attemptCount: 1,
  recoveredAfterRetry: false,
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

  if (
    summary.sourceFailures > 0 ||
    summary.sourcePartials > 0 ||
    summary.queriesDeferred > 0 ||
    summary.queriesPartialBlocked > 0 ||
    summary.sourceChallengeObserved
  ) {
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

export type ListingDiagnosisOutcome =
  | 'not_discovered'
  | 'detail_missing'
  | 'filtered'
  | 'matched_hidden'
  | 'matched';

export type ListingDiagnosis = {
  outcome: ListingDiagnosisOutcome;
  reason: string;
  inCatalog: boolean;
  matched: boolean;
  visibleInFeed: boolean;
  keyword: string | null;
  location: string | null;
  hasDescription: boolean;
};

export type ListingDetailRefreshResult = {
  jobId: string;
  requestSucceeded: boolean;
  detailFetched: boolean;
  descriptionExtracted: boolean;
  descriptionStored: boolean;
  errorCategory: string | null;
  httpStatus: number | null;
  matchesCreated: number;
  decisions: readonly {
    savedSearchId: string;
    matched: boolean;
    keyword: string | null;
    location: string | null;
  }[];
};

export type DetailQueueBackfillReport = {
  dryRun: boolean;
  eligibleCount: number;
  queuedCount: number;
  samples: readonly {
    jobId: string;
    title: string;
    sourceId: string;
    location: string | null;
  }[];
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
