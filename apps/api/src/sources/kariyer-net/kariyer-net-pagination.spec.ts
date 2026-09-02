import { shouldStopKariyerNetPagination } from './kariyer-net-pagination.js';

const now = new Date('2026-09-02T10:00:00.000Z');

describe('shouldStopKariyerNetPagination', () => {
  it('stops when the page has no jobs', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 2,
        maxPages: 10,
        jobsOnPage: [],
        now,
      }),
    ).toBe('no_results');
  });

  it('stops when the oldest reliably parsed job is older than 30 days', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 2,
        maxPages: 10,
        maxAgeDays: 30,
        now,
        jobsOnPage: [
          {
            externalJobId: '1',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
            title: 'Frontend Developer',
            companyName: 'Recent',
            publishedAt: '2026-08-20T10:00:00.000Z',
          },
          {
            externalJobId: '2',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/2',
            title: 'Java Developer',
            companyName: 'Old',
            publishedAt: '2026-07-01T10:00:00.000Z',
          },
        ],
      }),
    ).toBe('max_age');
  });

  it('does not stop on age when publishedAt is missing', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 1,
        maxPages: 10,
        maxAgeDays: 30,
        now,
        jobsOnPage: [
          {
            externalJobId: '1',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
            title: 'Frontend Developer',
            companyName: 'Unknown date',
          },
        ],
      }),
    ).toBeNull();
  });

  it('stops at the max page limit', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 10,
        maxPages: 10,
        maxAgeDays: 30,
        now,
        jobsOnPage: [
          {
            externalJobId: '1',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
            title: 'Frontend Developer',
            companyName: 'Recent',
            publishedAt: '2026-09-01T10:00:00.000Z',
          },
        ],
      }),
    ).toBe('max_pages');
  });
});
