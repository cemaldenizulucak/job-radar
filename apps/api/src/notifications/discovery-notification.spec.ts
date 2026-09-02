import { buildDiscoveryNotificationDrafts, newJobsTitle, sourceCountMessage } from './discovery-notification.js';
import { NEW_JOBS_DIGEST_TYPE } from './notifications.types.js';

describe('discovery notification copy', () => {
  it('builds the digest title and source breakdown', () => {
    expect(newJobsTitle(3)).toBe('3 new jobs found');
    expect(newJobsTitle(1)).toBe('1 new job found');
    expect(
      sourceCountMessage([
        { id: 'a', sourceId: 'linkedin' },
        { id: 'b', sourceId: 'linkedin' },
        { id: 'c', sourceId: 'kariyer_net' },
      ]),
    ).toBe('2 LinkedIn, 1 Kariyer.net');
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
        title: '3 new jobs found',
        message: '2 LinkedIn, 1 Kariyer.net',
        type: NEW_JOBS_DIGEST_TYPE,
      },
      {
        userId: 'user-2',
        title: '1 new job found',
        message: '1 LinkedIn',
        type: NEW_JOBS_DIGEST_TYPE,
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
        title: '1 new job found',
        message: '1 LinkedIn',
        type: NEW_JOBS_DIGEST_TYPE,
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
});
