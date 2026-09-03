import {
  buildDiscoveryNotificationDrafts,
  newJobsTitle,
  selectVisibleNewMatches,
  sourceCountMessage,
} from './discovery-notification.js';
import { NEW_JOBS_DIGEST_TYPE } from './notifications.types.js';

describe('discovery notification copy', () => {
  it('builds the digest title and source breakdown', () => {
    expect(newJobsTitle(3)).toBe('3 yeni ilan bulundu');
    expect(newJobsTitle(1)).toBe('1 yeni ilan bulundu');
    expect(newJobsTitle(12)).toBe('12 yeni ilan bulundu');
    expect(
      sourceCountMessage([
        { id: 'a', sourceId: 'linkedin' },
        { id: 'b', sourceId: 'linkedin' },
        { id: 'c', sourceId: 'kariyer_net' },
      ]),
    ).toBe('2 LinkedIn, 1 Kariyer.net');
  });
});

describe('selectVisibleNewMatches', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('counts 12 new visible matches when the provider returned 90 jobs', () => {
    const jobs = Array.from({ length: 90 }, (_, index) => ({
      id: `job-${index}`,
      sourceId: index < 45 ? ('linkedin' as const) : ('kariyer_net' as const),
      isActive: true,
      publishedAt: null,
    }));
    const matches = jobs.slice(0, 12).map((job) => ({
      jobId: job.id,
      savedSearchId: 'search-1',
    }));

    const visible = selectVisibleNewMatches(matches, jobs, 30, now);

    expect(visible.matches).toHaveLength(12);
    expect(visible.jobs).toHaveLength(12);
  });

  it('does not count inactive or max-age-hidden jobs', () => {
    const visible = selectVisibleNewMatches(
      [
        { jobId: 'active', savedSearchId: 'search-1' },
        { jobId: 'inactive', savedSearchId: 'search-1' },
        { jobId: 'old', savedSearchId: 'search-1' },
        { jobId: 'missing', savedSearchId: 'search-1' },
      ],
      [
        {
          id: 'active',
          sourceId: 'linkedin',
          isActive: true,
          publishedAt: null,
        },
        {
          id: 'inactive',
          sourceId: 'linkedin',
          isActive: false,
          publishedAt: null,
        },
        {
          id: 'old',
          sourceId: 'kariyer_net',
          isActive: true,
          publishedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      30,
      now,
    );

    expect(visible.jobs.map((job) => job.id)).toEqual(['active']);
    expect(visible.matches).toHaveLength(1);
  });

  it('aggregates only visible jobs across LinkedIn and Kariyer.net', () => {
    const visible = selectVisibleNewMatches(
      [
        { jobId: 'li-1', savedSearchId: 'search-1' },
        { jobId: 'kn-1', savedSearchId: 'search-1' },
        { jobId: 'kn-hidden', savedSearchId: 'search-1' },
      ],
      [
        { id: 'li-1', sourceId: 'linkedin', isActive: true, publishedAt: null },
        { id: 'kn-1', sourceId: 'kariyer_net', isActive: true, publishedAt: null },
        {
          id: 'kn-hidden',
          sourceId: 'kariyer_net',
          isActive: false,
          publishedAt: null,
        },
      ],
      30,
      now,
    );

    expect(visible.jobs).toEqual([
      { id: 'li-1', sourceId: 'linkedin' },
      { id: 'kn-1', sourceId: 'kariyer_net' },
    ]);
  });
});

describe('buildDiscoveryNotificationDrafts', () => {
  it('groups newly matched jobs by user and emits one digest per user', () => {
    const drafts = buildDiscoveryNotificationDrafts({
      runId: 'run-1',
      jobs: [
        { id: 'job-li', sourceId: 'linkedin' },
        { id: 'job-li-2', sourceId: 'linkedin' },
        { id: 'job-kn', sourceId: 'kariyer_net' },
      ],
      searchOwners: new Map([
        ['search-a', 'user-1'],
        ['search-b', 'user-2'],
      ]),
      matches: [
        { jobId: 'job-li', savedSearchId: 'search-a' },
        { jobId: 'job-li-2', savedSearchId: 'search-a' },
        { jobId: 'job-kn', savedSearchId: 'search-a' },
        { jobId: 'job-li', savedSearchId: 'search-b' },
      ],
    });

    expect(drafts).toEqual([
      {
        userId: 'user-1',
        title: '3 yeni ilan bulundu',
        message: '2 LinkedIn, 1 Kariyer.net',
        type: NEW_JOBS_DIGEST_TYPE,
        discoveryRunId: 'run-1',
        savedSearchId: 'search-a',
        newJobCount: 3,
      },
      {
        userId: 'user-2',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: NEW_JOBS_DIGEST_TYPE,
        discoveryRunId: 'run-1',
        savedSearchId: 'search-b',
        newJobCount: 1,
      },
    ]);
  });

  it('does not create a second digest when the same job matches two searches for one user', () => {
    const drafts = buildDiscoveryNotificationDrafts({
      runId: 'run-1',
      jobs: [{ id: 'job-li', sourceId: 'linkedin' }],
      searchOwners: new Map([
        ['search-a', 'user-1'],
        ['search-b', 'user-1'],
      ]),
      matches: [
        { jobId: 'job-li', savedSearchId: 'search-a' },
        { jobId: 'job-li', savedSearchId: 'search-b' },
      ],
    });

    expect(drafts).toEqual([
      {
        userId: 'user-1',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: NEW_JOBS_DIGEST_TYPE,
        discoveryRunId: 'run-1',
        savedSearchId: null,
        newJobCount: 1,
      },
    ]);
  });

  it('does not create a notification when there are no new matches', () => {
    const drafts = buildDiscoveryNotificationDrafts({
      runId: 'run-1',
      jobs: [{ id: 'job-li', sourceId: 'linkedin' }],
      searchOwners: new Map([['search-a', 'user-1']]),
      matches: [],
    });

    expect(drafts).toEqual([]);
  });

  it('uses 12 in the title when 90 provider jobs produced 12 new matches', () => {
    const jobs = Array.from({ length: 12 }, (_, index) => ({
      id: `job-${index}`,
      sourceId: 'kariyer_net' as const,
    }));

    const drafts = buildDiscoveryNotificationDrafts({
      runId: 'run-90',
      jobs,
      searchOwners: new Map([['search-a', 'user-1']]),
      matches: jobs.map((job) => ({
        jobId: job.id,
        savedSearchId: 'search-a',
      })),
    });

    expect(drafts).toEqual([
      {
        userId: 'user-1',
        title: '12 yeni ilan bulundu',
        message: '12 Kariyer.net',
        type: NEW_JOBS_DIGEST_TYPE,
        discoveryRunId: 'run-90',
        savedSearchId: 'search-a',
        newJobCount: 12,
      },
    ]);
  });
});
