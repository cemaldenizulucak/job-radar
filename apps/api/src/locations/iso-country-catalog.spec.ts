import { FALLBACK_COUNTRIES } from './iso-country-catalog.js';

describe('ISO country fallback catalog', () => {
  it('has more than 200 ISO-3166 alpha-2 countries with unique codes', () => {
    expect(FALLBACK_COUNTRIES.length).toBeGreaterThan(200);

    const codes = FALLBACK_COUNTRIES.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses Turkish display names for TR, DE, and US', () => {
    expect(FALLBACK_COUNTRIES).toEqual(
      expect.arrayContaining([
        { code: 'TR', name: 'Türkiye' },
        { code: 'DE', name: 'Almanya' },
        { code: 'US', name: 'Amerika Birleşik Devletleri' },
      ]),
    );
  });
});
