import type { SourceId } from '../common/domain.types.js';
import {
  MATCH_STATUS,
  type MatchStatus,
} from '../matching/match-status.js';

export type FeedMatchRow = {
  jobId: string;
  savedSearchId: string;
  matchStatus: MatchStatus;
};

export type JobFeedCounterQuery = {
  matchStatus?: MatchStatus;
  sourceId?: SourceId | 'all';
  savedSearchId?: string;
};

export type JobSourceCounts = {
  all: number;
  linkedin: number;
  kariyer_net: number;
};

export type JobFeedCounters = {
  verifiedMatchCount: number;
  unverifiedMatchCount: number;
  allMatchCount: number;
  sourceCounts: JobSourceCounts;
  savedSearchCounts: readonly { id: string; count: number }[];
  savedSearchAllCount: number;
  totalCount: number;
};

export const EMPTY_JOB_SOURCE_COUNTS: JobSourceCounts = {
  all: 0,
  linkedin: 0,
  kariyer_net: 0,
};

export const EMPTY_JOB_FEED_COUNTERS: JobFeedCounters = {
  verifiedMatchCount: 0,
  unverifiedMatchCount: 0,
  allMatchCount: 0,
  sourceCounts: EMPTY_JOB_SOURCE_COUNTS,
  savedSearchCounts: [],
  savedSearchAllCount: 0,
  totalCount: 0,
};

export function jobLevelMatchStatus(
  matches: readonly FeedMatchRow[],
): MatchStatus {
  const unverifiedOnly =
    matches.length > 0 &&
    matches.every(
      (match) => match.matchStatus === MATCH_STATUS.unverifiedSourceCandidate,
    );

  return unverifiedOnly
    ? MATCH_STATUS.unverifiedSourceCandidate
    : MATCH_STATUS.verified;
}

export function countJobsByMatchStatus(matches: readonly FeedMatchRow[]): {
  verified: number;
  unverified: number;
} {
  let verified = 0;
  let unverified = 0;

  for (const jobMatches of groupMatchesByJob(matches).values()) {
    if (jobLevelMatchStatus(jobMatches) === MATCH_STATUS.unverifiedSourceCandidate) {
      unverified += 1;
    } else {
      verified += 1;
    }
  }

  return { verified, unverified };
}

export function computeJobFeedCounters(input: {
  matches: readonly FeedMatchRow[];
  jobSources: ReadonlyMap<string, SourceId>;
  query: JobFeedCounterQuery;
}): JobFeedCounters {
  const matches = input.matches;
  const resultType = countJobsByMatchStatus(matches);
  const sourceScopeMatches = input.query.savedSearchId
    ? matches.filter(
        (match) => match.savedSearchId === input.query.savedSearchId,
      )
    : matches;
  const sourceScopeJobIds = jobIdsForResultType(
    sourceScopeMatches,
    input.query.matchStatus,
  );
  const savedSearchIds = uniqueSavedSearchIds(matches);
  const savedSearchCounts = savedSearchIds.map((id) => {
    const searchMatches = matches.filter(
      (match) => match.savedSearchId === id,
    );
    return {
      id,
      count: filterJobIdsBySource(
        jobIdsForResultType(searchMatches, input.query.matchStatus),
        input.jobSources,
        input.query.sourceId,
      ).size,
    };
  });
  const savedSearchAllCount = filterJobIdsBySource(
    jobIdsForResultType(matches, input.query.matchStatus),
    input.jobSources,
    input.query.sourceId,
  ).size;
  const listMatches = input.query.savedSearchId
    ? matches.filter(
        (match) => match.savedSearchId === input.query.savedSearchId,
      )
    : matches;
  const totalCount = filterJobIdsBySource(
    jobIdsForResultType(listMatches, input.query.matchStatus),
    input.jobSources,
    input.query.sourceId,
  ).size;

  return {
    verifiedMatchCount: resultType.verified,
    unverifiedMatchCount: resultType.unverified,
    allMatchCount: resultType.verified + resultType.unverified,
    sourceCounts: countJobsBySource(sourceScopeJobIds, input.jobSources),
    savedSearchCounts,
    savedSearchAllCount,
    totalCount,
  };
}

function groupMatchesByJob(
  matches: readonly FeedMatchRow[],
): Map<string, FeedMatchRow[]> {
  const byJob = new Map<string, FeedMatchRow[]>();

  for (const match of matches) {
    const list = byJob.get(match.jobId) ?? [];
    list.push(match);
    byJob.set(match.jobId, list);
  }

  return byJob;
}

function jobIdsForResultType(
  matches: readonly FeedMatchRow[],
  matchStatus: MatchStatus | undefined,
): Set<string> {
  const ids = new Set<string>();

  for (const [jobId, jobMatches] of groupMatchesByJob(matches)) {
    if (!matchStatus || jobLevelMatchStatus(jobMatches) === matchStatus) {
      ids.add(jobId);
    }
  }

  return ids;
}

function filterJobIdsBySource(
  jobIds: ReadonlySet<string>,
  jobSources: ReadonlyMap<string, SourceId>,
  sourceId: SourceId | 'all' | undefined,
): Set<string> {
  if (!sourceId || sourceId === 'all') {
    return new Set(jobIds);
  }

  const next = new Set<string>();
  for (const jobId of jobIds) {
    if (jobSources.get(jobId) === sourceId) {
      next.add(jobId);
    }
  }
  return next;
}

function countJobsBySource(
  jobIds: ReadonlySet<string>,
  jobSources: ReadonlyMap<string, SourceId>,
): JobSourceCounts {
  let linkedin = 0;
  let kariyerNet = 0;

  for (const jobId of jobIds) {
    const source = jobSources.get(jobId);
    if (source === 'linkedin') {
      linkedin += 1;
    } else if (source === 'kariyer_net') {
      kariyerNet += 1;
    }
  }

  return {
    all: jobIds.size,
    linkedin,
    kariyer_net: kariyerNet,
  };
}

function uniqueSavedSearchIds(matches: readonly FeedMatchRow[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    if (seen.has(match.savedSearchId)) {
      continue;
    }
    seen.add(match.savedSearchId);
    ids.push(match.savedSearchId);
  }

  return ids;
}
