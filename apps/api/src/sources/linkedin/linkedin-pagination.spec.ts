import { isLinkedInPaginationLoop, shouldStopLinkedInPagination } from './linkedin-pagination.js';

const now = new Date('2026-09-02T10:00:00.000Z');

describe('shouldStopLinkedInPagination', () => {
  it('stops when the page has no jobs', () => {
    expect(
      shouldStopLinkedInPagination({
        page: 2,
        maxPages: 3,
        jobsOnPage: [],
        now,
      }),
    ).toBe('no_results');
  });

  it('stops when the oldest reliably parsed job is older than 30 days', () => {
    expect(
      shouldStopLinkedInPagination({
        page: 2,
        maxPages: 3,
        maxAgeDays: 30,
        now,
        jobsOnPage: [
          {
            externalJobId: '1',
            publishedAt: '2026-08-20T10:00:00.000Z',
          },
          {
            externalJobId: '2',
            publishedAt: '2026-07-01T10:00:00.000Z',
          },
        ],
      }),
    ).toBe('max_age');
  });

  it('does not stop on age when publishedAt is missing', () => {
    expect(
      shouldStopLinkedInPagination({
        page: 1,
        maxPages: 3,
        maxAgeDays: 30,
        now,
        jobsOnPage: [{ externalJobId: '1' }],
      }),
    ).toBeNull();
  });

  it('stops at the max page limit', () => {
    expect(
      shouldStopLinkedInPagination({
        page: 3,
        maxPages: 3,
        now,
        jobsOnPage: [
          {
            externalJobId: '1',
            publishedAt: '2026-09-01T10:00:00.000Z',
          },
        ],
      }),
    ).toBe('max_pages');
  });
});

describe('isLinkedInPaginationLoop', () => {
  const page2 =
    'https://www.linkedin.com/jobs/search/?keywords=frontend&start=25&sortBy=DD';

  it('detects start=25 resolving to start=0', () => {
    expect(
      isLinkedInPaginationLoop(
        page2,
        'https://www.linkedin.com/jobs/search/?keywords=frontend&start=0&sortBy=DD',
      ),
    ).toBe(true);
  });

  it('detects a missing start on the final URL as start=0', () => {
    expect(
      isLinkedInPaginationLoop(
        page2,
        'https://www.linkedin.com/jobs/search/?keywords=frontend&sortBy=DD',
      ),
    ).toBe(true);
  });

  it('does not flag page 1 or a later page that kept its start', () => {
    expect(
      isLinkedInPaginationLoop(
        'https://www.linkedin.com/jobs/search/?keywords=frontend&sortBy=DD',
        'https://www.linkedin.com/jobs/search/?keywords=frontend&sortBy=DD',
      ),
    ).toBe(false);
    expect(
      isLinkedInPaginationLoop(
        page2,
        'https://www.linkedin.com/jobs/search/?keywords=frontend&start=25&sortBy=DD',
      ),
    ).toBe(false);
  });
});
