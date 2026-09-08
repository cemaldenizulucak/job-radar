import { buildLinkedInSearchUrl } from './linkedin-search-url.js';

describe('buildLinkedInSearchUrl', () => {
  it('puts keywords, first location, and the 30-day date filter on the public search URL', () => {
    const parsed = new URL(
      buildLinkedInSearchUrl({
        keywords: ['frontend', 'react'],
        locations: ['Istanbul', 'Ankara'],
        workTypes: [],
        experienceLevels: ['mid'],
        maxAgeDays: 30,
      }),
    );

    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.linkedin.com/jobs/search/',
    );
    expect(parsed.searchParams.get('keywords')).toBe('frontend react');
    expect(parsed.searchParams.get('location')).toBe('Istanbul');
    expect(parsed.searchParams.get('f_TPR')).toBe('r2592000');
    expect(parsed.searchParams.get('sortBy')).toBe('DD');
    expect(parsed.searchParams.has('f_E')).toBe(false);
    expect(parsed.searchParams.has('start')).toBe(false);
  });

  it('does not encode workplace type on the public search URL', () => {
    const remote = new URL(
      buildLinkedInSearchUrl({
        keywords: ['frontend'],
        locations: [],
        workTypes: ['remote'],
        experienceLevels: [],
      }),
    );
    const mixed = new URL(
      buildLinkedInSearchUrl({
        keywords: ['frontend'],
        locations: [],
        workTypes: ['remote', 'hybrid'],
        experienceLevels: [],
      }),
    );

    expect(remote.searchParams.has('f_WT')).toBe(false);
    expect(mixed.searchParams.has('f_WT')).toBe(false);
  });

  it('adds start for pages after the first', () => {
    const parsed = new URL(
      buildLinkedInSearchUrl(
        {
          keywords: ['frontend'],
          locations: ['Istanbul'],
          workTypes: [],
          experienceLevels: [],
        },
        'https://www.linkedin.com',
        3,
        25,
      ),
    );

    expect(parsed.searchParams.get('start')).toBe('50');
    expect(parsed.searchParams.get('sortBy')).toBe('DD');
  });
});
