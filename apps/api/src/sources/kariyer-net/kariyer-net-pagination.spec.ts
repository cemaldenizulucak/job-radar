import {
  kariyerNetPageSignature,
  shouldStopKariyerNetPagination,
} from './kariyer-net-pagination.js';

const now = new Date('2026-09-02T10:00:00.000Z');
void now;

describe('shouldStopKariyerNetPagination', () => {
  it('stops when the page has no jobs', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 2,
        maxPages: 10,
        jobsOnPage: [],
      }),
    ).toBe('no_results');
  });

  it('does not stop just because one listing looks old', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 2,
        maxPages: 10,
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
    ).toBeNull();
  });

  it('does not stop on missing publishedAt', () => {
    expect(
      shouldStopKariyerNetPagination({
        page: 1,
        maxPages: 10,
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

  it('stops when the same page identities repeat', () => {
    const jobs = [
      {
        externalJobId: '1',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
        title: 'Frontend Developer',
        companyName: 'Same',
      },
    ];
    const previous = kariyerNetPageSignature(jobs);

    expect(
      shouldStopKariyerNetPagination({
        page: 2,
        maxPages: 10,
        jobsOnPage: jobs,
        previousPageSignature: previous,
      }),
    ).toBe('pagination_loop');
  });
});
