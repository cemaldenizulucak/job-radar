import { buildKariyerNetSearchUrl, toLocationSlug } from './kariyer-net-search-url.js';

describe('buildKariyerNetSearchUrl', () => {
  it('puts keywords on kw and omits work type and experience', () => {
    const parsed = new URL(
      buildKariyerNetSearchUrl({
        keywords: ['frontend', 'react'],
        locations: [],
        workTypes: ['hybrid'],
        experienceLevels: ['mid'],
      }),
    );

    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.kariyer.net/is-ilanlari',
    );
    expect(parsed.searchParams.get('kw')).toBe('frontend react');
    expect(parsed.searchParams.has('wt')).toBe(false);
  });

  it('uses a city slug path for a single location', () => {
    const parsed = new URL(
      buildKariyerNetSearchUrl({
        keywords: ['frontend'],
        locations: ['İstanbul'],
        workTypes: [],
        experienceLevels: [],
      }),
    );

    expect(parsed.pathname).toBe('/is-ilanlari/istanbul');
    expect(parsed.searchParams.get('kw')).toBe('frontend');
    expect(toLocationSlug('İstanbul')).toBe('istanbul');
  });

  it('uses only the first location token when extra words are present', () => {
    const url = buildKariyerNetSearchUrl({
      keywords: [],
      locations: ['Istanbul Avrupa'],
      workTypes: [],
      experienceLevels: [],
    });

    expect(url).toBe('https://www.kariyer.net/is-ilanlari/istanbul');
  });

  it('adds cp for pages after the first', () => {
    const parsed = new URL(
      buildKariyerNetSearchUrl(
        {
          keywords: ['frontend'],
          locations: ['istanbul'],
          workTypes: [],
          experienceLevels: [],
        },
        'https://www.kariyer.net',
        3,
      ),
    );

    expect(parsed.searchParams.get('cp')).toBe('3');
  });
});
