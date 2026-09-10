import { MATCH_STATUS } from '../matching/match-status.js';
import {
  computeJobFeedCounters,
  countJobsByMatchStatus,
  jobLevelMatchStatus,
  type FeedMatchRow,
} from './job-feed-counters.js';

function match(
  jobId: string,
  savedSearchId: string,
  status: FeedMatchRow['matchStatus'] = MATCH_STATUS.verified,
): FeedMatchRow {
  return { jobId, savedSearchId, matchStatus: status };
}

function sources(
  entries: readonly { id: string; source: 'linkedin' | 'kariyer_net' }[],
): Map<string, 'linkedin' | 'kariyer_net'> {
  return new Map(entries.map((entry) => [entry.id, entry.source]));
}

describe('jobLevelMatchStatus', () => {
  it('treats mixed verified and unverified rows as verified', () => {
    expect(
      jobLevelMatchStatus([
        match('job-1', 'search-1', MATCH_STATUS.verified),
        match('job-1', 'search-2', MATCH_STATUS.unverifiedSourceCandidate),
      ]),
    ).toBe(MATCH_STATUS.verified);
  });
});

describe('countJobsByMatchStatus', () => {
  it('counts a job once when it matches multiple saved searches', () => {
    expect(
      countJobsByMatchStatus([
        match('job-1', 'search-1'),
        match('job-1', 'search-2'),
        match('job-2', 'search-1', MATCH_STATUS.unverifiedSourceCandidate),
      ]),
    ).toEqual({ verified: 1, unverified: 1 });
  });
});

describe('computeJobFeedCounters', () => {
  const verifiedJobs = Array.from({ length: 22 }, (_, index) => ({
    id: `verified-${index}`,
    source: (index < 4 ? 'linkedin' : 'kariyer_net') as const,
  }));
  const unverifiedJobs = Array.from({ length: 43 }, (_, index) => ({
    id: `unverified-${index}`,
    source: (index < 10 ? 'linkedin' : 'kariyer_net') as const,
  }));
  const fixtureJobs = [...verifiedJobs, ...unverifiedJobs];
  const fixtureSources = sources(fixtureJobs);
  const fixtureMatches: FeedMatchRow[] = [
    ...verifiedJobs.map((job) => match(job.id, 'search-gida')),
    ...unverifiedJobs.map((job) =>
      match(job.id, 'search-gida', MATCH_STATUS.unverifiedSourceCandidate),
    ),
  ];

  it('uses unique job totals for result types regardless of other filters', () => {
    const verified = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {
        matchStatus: MATCH_STATUS.verified,
        sourceId: 'linkedin',
        savedSearchId: 'search-gida',
      },
    });
    const unverified = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {
        matchStatus: MATCH_STATUS.unverifiedSourceCandidate,
        savedSearchId: 'search-gida',
      },
    });
    const allResults = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {},
    });

    expect(verified.verifiedMatchCount).toBe(22);
    expect(verified.unverifiedMatchCount).toBe(43);
    expect(verified.allMatchCount).toBe(65);
    expect(unverified.verifiedMatchCount).toBe(22);
    expect(unverified.unverifiedMatchCount).toBe(43);
    expect(allResults.allMatchCount).toBe(65);
    expect(allResults.totalCount).toBe(65);
  });

  it('scopes saved-search All to the selected result type, not the unfiltered union', () => {
    const verified = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: { matchStatus: MATCH_STATUS.verified },
    });
    const unverified = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: { matchStatus: MATCH_STATUS.unverifiedSourceCandidate },
    });
    const allResults = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {},
    });

    expect(verified.savedSearchAllCount).toBe(22);
    expect(verified.savedSearchCounts).toEqual([{ id: 'search-gida', count: 22 }]);
    expect(unverified.savedSearchAllCount).toBe(43);
    expect(unverified.savedSearchCounts).toEqual([
      { id: 'search-gida', count: 43 },
    ]);
    expect(allResults.savedSearchAllCount).toBe(65);
    expect(allResults.savedSearchCounts).toEqual([
      { id: 'search-gida', count: 65 },
    ]);
  });

  it('computes source counts inside the selected result type and saved search', () => {
    const verified = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {
        matchStatus: MATCH_STATUS.verified,
        savedSearchId: 'search-gida',
        sourceId: 'linkedin',
      },
    });

    expect(verified.sourceCounts).toEqual({
      all: 22,
      linkedin: 4,
      kariyer_net: 18,
    });
    expect(verified.totalCount).toBe(4);
  });

  it('computes saved-search counts inside the selected result type and source', () => {
    const verifiedLinkedIn = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: {
        matchStatus: MATCH_STATUS.verified,
        sourceId: 'linkedin',
      },
    });

    expect(verifiedLinkedIn.savedSearchAllCount).toBe(4);
    expect(verifiedLinkedIn.savedSearchCounts).toEqual([
      { id: 'search-gida', count: 4 },
    ]);
    expect(verifiedLinkedIn.sourceCounts.all).toBe(22);
  });

  it('uses the unique union for All rather than summing search counts', () => {
    const matches = [
      match('job-shared', 'search-a'),
      match('job-shared', 'search-b'),
      match('job-a', 'search-a'),
      match('job-b', 'search-b'),
    ];
    const jobSources = sources([
      { id: 'job-shared', source: 'linkedin' },
      { id: 'job-a', source: 'kariyer_net' },
      { id: 'job-b', source: 'linkedin' },
    ]);

    const counters = computeJobFeedCounters({
      matches,
      jobSources,
      query: { matchStatus: MATCH_STATUS.verified },
    });

    expect(counters.verifiedMatchCount).toBe(3);
    expect(counters.savedSearchAllCount).toBe(3);
    expect(counters.savedSearchCounts).toEqual([
      { id: 'search-a', count: 2 },
      { id: 'search-b', count: 2 },
    ]);
    expect(
      counters.savedSearchCounts.reduce((sum, item) => sum + item.count, 0),
    ).toBeGreaterThan(counters.savedSearchAllCount);
  });

  it('does not let pagination-sized subsets change full-dataset counters', () => {
    const counters = computeJobFeedCounters({
      matches: fixtureMatches,
      jobSources: fixtureSources,
      query: { matchStatus: MATCH_STATUS.verified },
    });

    expect(counters.totalCount).toBe(22);
    expect(counters.sourceCounts.all).toBe(22);
    expect(counters.savedSearchAllCount).toBe(22);
  });

  it('keeps users isolated when only that user matches are supplied', () => {
    const counters = computeJobFeedCounters({
      matches: [match('job-own', 'search-own')],
      jobSources: sources([{ id: 'job-own', source: 'linkedin' }]),
      query: { matchStatus: MATCH_STATUS.verified },
    });

    expect(counters.verifiedMatchCount).toBe(1);
    expect(counters.savedSearchCounts.map((item) => item.id)).toEqual([
      'search-own',
    ]);
  });
});
