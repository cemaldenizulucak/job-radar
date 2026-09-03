import {
  normalizeCountries,
  normalizeSubdivisions,
} from './location-normalize.js';

describe('normalizeCountries', () => {
  it('uses native names and ISO codes', () => {
    expect(
      normalizeCountries([
        { iso2: 'tr', name: 'Turkey', native: 'Türkiye' },
        { iso2: 'DE', name: 'Germany', native: 'Deutschland' },
        { iso2: '', name: 'Invalid' },
      ]),
    ).toEqual([
      { code: 'DE', name: 'Deutschland' },
      { code: 'TR', name: 'Türkiye' },
    ]);
  });

  it('reads restcountries-style native names', () => {
    expect(
      normalizeCountries([
        {
          cca2: 'TR',
          name: {
            common: 'Turkey',
            official: 'Republic of Turkey',
            nativeName: {
              tur: { official: 'Türkiye Cumhuriyeti', common: 'Türkiye' },
            },
          },
        },
      ]),
    ).toEqual([{ code: 'TR', name: 'Türkiye' }]);
  });
});

describe('normalizeSubdivisions', () => {
  it('keeps only the requested country and prefers native names', () => {
    expect(
      normalizeSubdivisions(
        [
          {
            country_code: 'TR',
            iso2: '34',
            name: 'Istanbul',
            native: 'İstanbul',
          },
          {
            country_code: 'TR',
            iso2: '35',
            name: 'Izmir',
            native: 'İzmir',
          },
          {
            country_code: 'DE',
            iso2: 'BE',
            name: 'Berlin',
            native: 'Berlin',
          },
        ],
        'tr',
      ),
    ).toEqual([
      { code: '34', name: 'İstanbul' },
      { code: '35', name: 'İzmir' },
    ]);
  });
});
