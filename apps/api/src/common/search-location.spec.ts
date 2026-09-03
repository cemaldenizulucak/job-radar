import {
  formatLocationLabel,
  jobLocationMatchResult,
  resolveEffectiveSearchLocation,
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
      country: null,
    });
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
  });

  it('allows a country-only job when city metadata is missing', () => {
    expect(jobLocationMatchResult('Türkiye', izmir)).toBe('pass');
  });

  it('does not treat a different city in the same country as a match', () => {
    expect(jobLocationMatchResult('İstanbul, Türkiye', izmir)).toBe('fail');
  });

  it('does not reject a job with unknown location text', () => {
    expect(jobLocationMatchResult(null, izmir)).toBe('unknown');
  });
});
