import {
  adapterLocationsForFetch,
  deriveSavedSearchLocations,
  formatLocationLabel,
  hasExplicitSearchLocationFilter,
  jobLocationMatchResult,
  resolveEffectiveSearchLocation,
  resolveSavedSearchLocation,
} from './search-location.js';

describe('resolveEffectiveSearchLocation', () => {
  it('uses profile city and country when the search location is empty', () => {
    const resolved = resolveEffectiveSearchLocation([], {
      country: 'Turkey',
      city: 'Izmir',
    });

    expect(resolved).toMatchObject({
      label: 'Izmir, Turkey',
      locations: ['Izmir, Turkey'],
      source: 'profile_city',
      city: 'Izmir',
      country: 'Turkey',
    });
  });

  it('falls back to country when the profile has no city', () => {
    const resolved = resolveEffectiveSearchLocation([], {
      country: 'Turkey',
      city: null,
    });

    expect(resolved).toMatchObject({
      label: 'Turkey',
      locations: ['Turkey'],
      source: 'profile_country',
      city: null,
      country: 'Turkey',
    });
  });

  it('appends profile country to an explicit city', () => {
    const resolved = resolveEffectiveSearchLocation(['Istanbul'], {
      country: 'Turkey',
      city: 'Izmir',
    });

    expect(resolved).toMatchObject({
      label: 'Istanbul, Turkey',
      locations: ['Istanbul, Turkey'],
      source: 'search',
      city: 'Istanbul',
      country: 'Turkey',
    });
  });

  it('keeps an explicit city, country pair unchanged', () => {
    const resolved = resolveEffectiveSearchLocation(['Berlin, Germany'], {
      country: 'Turkey',
      city: 'Izmir',
    });

    expect(resolved).toMatchObject({
      label: 'Berlin, Germany',
      locations: ['Berlin, Germany'],
      source: 'search',
      city: 'Berlin',
      country: 'Germany',
    });
  });

  it('applies no location filter when profile and search are empty', () => {
    expect(resolveEffectiveSearchLocation([], { country: null, city: null })).toEqual({
      locations: [],
      label: null,
      source: 'none',
      city: null,
      cities: [],
      country: null,
    });
  });
});

describe('resolveSavedSearchLocation', () => {
  it('uses structured country and subdivision without profile fallback', () => {
    expect(
      resolveSavedSearchLocation({
        locations: [],
        countryName: 'Türkiye',
        subdivisionName: 'İzmir',
      }),
    ).toMatchObject({
      source: 'search',
      city: 'İzmir',
      country: 'Türkiye',
      label: 'İzmir, Türkiye',
      locations: ['İzmir', 'İzmir, Türkiye'],
    });
  });

  it('keeps country-only searches open to every location in that country', () => {
    const resolved = resolveSavedSearchLocation(
      {
        locations: [],
        countryName: 'Türkiye',
        subdivisionName: null,
      },
      ['İstanbul', 'İzmir'],
    );

    expect(resolved).toMatchObject({
      source: 'search',
      city: null,
      country: 'Türkiye',
      label: 'Türkiye',
    });
    expect(jobLocationMatchResult('İzmir', resolved)).toBe('pass');
    expect(jobLocationMatchResult('Berlin', resolved)).toBe('fail');
  });

  it('treats blank and sentinel location fields as no filter', () => {
    expect(
      hasExplicitSearchLocationFilter({
        locations: ['', ' ', 'Tümü', 'all'],
        countryCode: 'ALL',
        countryName: 'Tümü',
        subdivisionCode: '',
        subdivisionName: '',
      }),
    ).toBe(false);
    expect(
      resolveSavedSearchLocation({
        locations: ['Tümü', ''],
        countryCode: 'TR',
        countryName: '',
        subdivisionName: null,
      }).source,
    ).toBe('none');
    expect(
      jobLocationMatchResult(
        'Berlin',
        resolveSavedSearchLocation({
          locations: [],
          countryCode: null,
          countryName: null,
          subdivisionName: null,
        }),
      ),
    ).toBe('skipped');
  });

  it('falls back to legacy locations text when structured fields are empty', () => {
    expect(
      resolveSavedSearchLocation({
        locations: ['İstanbul'],
        countryName: null,
        subdivisionName: null,
      }),
    ).toMatchObject({
      source: 'search',
      city: 'İstanbul',
      locations: ['İstanbul'],
    });
  });
});

describe('deriveSavedSearchLocations', () => {
  it('derives adapter locations from structured fields', () => {
    expect(
      deriveSavedSearchLocations({
        countryName: 'Türkiye',
        subdivisionName: 'İzmir',
      }),
    ).toEqual(['İzmir', 'İzmir, Türkiye']);
    expect(
      deriveSavedSearchLocations({
        countryName: 'Türkiye',
        subdivisionName: null,
      }),
    ).toEqual(['Türkiye']);
    expect(deriveSavedSearchLocations({ locations: ['legacy'] })).toEqual([
      'legacy',
    ]);
  });
});

describe('formatLocationLabel', () => {
  it('formats Turkish city and country without assuming a default country', () => {
    expect(formatLocationLabel('İzmir', 'Türkiye')).toBe('İzmir, Türkiye');
    expect(formatLocationLabel(null, 'Germany')).toBe('Germany');
  });
});

describe('jobLocationMatchResult', () => {
  const izmir = resolveEffectiveSearchLocation([], {
    country: 'Türkiye',
    city: 'İzmir',
  });

  it('matches the selected city', () => {
    expect(jobLocationMatchResult('Konak / İzmir', izmir)).toBe('pass');
    expect(jobLocationMatchResult('İzmir', izmir)).toBe('pass');
    expect(jobLocationMatchResult('İzmir, Türkiye', izmir)).toBe('pass');
  });

  it('rejects a different city in the same country', () => {
    expect(jobLocationMatchResult('Kahramanmaraş', izmir)).toBe('fail');
    expect(jobLocationMatchResult('İstanbul(Asya)', izmir)).toBe('fail');
    expect(jobLocationMatchResult('İstanbul, Türkiye', izmir)).toBe('fail');
  });

  it('does not treat a country-only listing as the selected city', () => {
    expect(jobLocationMatchResult('Türkiye', izmir)).toBe('fail');
  });

  it('rejects a job with empty location when a city filter is set', () => {
    expect(jobLocationMatchResult(null, izmir)).toBe('fail');
    expect(jobLocationMatchResult('  ', izmir)).toBe('fail');
  });

  it('accepts a Turkey-workable remote job for the selected city', () => {
    expect(
      jobLocationMatchResult('İstanbul, Türkiye', izmir, {
        workModel: 'remote',
        countryCityAliases: ['İstanbul', 'Ankara'],
      }),
    ).toBe('pass');
    expect(
      jobLocationMatchResult('Istanbul, Turkey', izmir, { workModel: 'remote' }),
    ).toBe('pass');
    expect(
      jobLocationMatchResult('Remote', izmir, { workModel: 'remote' }),
    ).toBe('pass');
  });

  it('does not treat another city hybrid listing as remote', () => {
    expect(
      jobLocationMatchResult('İstanbul, Türkiye', izmir, {
        workModel: 'hybrid',
        countryCityAliases: ['İstanbul', 'Ankara'],
      }),
    ).toBe('fail');
  });

  it('does not assume empty or foreign remote listings match İzmir', () => {
    expect(
      jobLocationMatchResult(null, izmir, { workModel: 'remote' }),
    ).toBe('fail');
    expect(
      jobLocationMatchResult('Berlin, Germany', izmir, { workModel: 'remote' }),
    ).toBe('fail');
  });
});

describe('multi-city saved search location', () => {
  it('accepts İzmir or İstanbul and rejects Ankara', () => {
    const resolved = resolveSavedSearchLocation({
      locations: [],
      countryName: 'Türkiye',
      subdivisionNames: ['İzmir', 'İstanbul'],
    });

    expect(jobLocationMatchResult('İzmir', resolved)).toBe('pass');
    expect(jobLocationMatchResult('İstanbul(Asya)', resolved)).toBe('pass');
    expect(jobLocationMatchResult('Ankara', resolved)).toBe('fail');
  });

  it('skips the city filter when subdivision names are empty and keeps country', () => {
    const resolved = resolveSavedSearchLocation({
      locations: [],
      countryName: 'Türkiye',
      subdivisionNames: [],
    });

    expect(resolved.cities).toEqual([]);
    expect(jobLocationMatchResult('İzmir, Türkiye', resolved)).toBe('pass');
    expect(jobLocationMatchResult('Berlin', resolved)).toBe('fail');
  });

  it('sends the country, not the first city, to job-source adapters', () => {
    expect(
      adapterLocationsForFetch({
        locations: ['İzmir', 'İzmir, Türkiye', 'İstanbul', 'İstanbul, Türkiye'],
        countryName: 'Türkiye',
        subdivisionNames: ['İzmir', 'İstanbul'],
      }),
    ).toEqual(['Türkiye']);
  });
});
