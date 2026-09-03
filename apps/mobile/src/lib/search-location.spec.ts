import { describe, expect, it } from 'vitest';

import {
  formatLocationLabel,
  hasProfileCountry,
  resolveEffectiveSearchLocation,
} from './search-location';

describe('resolveEffectiveSearchLocation', () => {
  it('uses profile city and country when the search location is empty', () => {
    expect(
      resolveEffectiveSearchLocation([], { country: 'Turkey', city: 'Izmir' }),
    ).toMatchObject({
      label: 'Izmir, Turkey',
      locations: ['Izmir, Turkey'],
      source: 'profile_city',
    });
  });

  it('falls back to country when the profile has no city', () => {
    expect(
      resolveEffectiveSearchLocation([], { country: 'Turkey', city: null }),
    ).toMatchObject({
      label: 'Turkey',
      locations: ['Turkey'],
      source: 'profile_country',
    });
  });

  it('appends profile country to an explicit city', () => {
    expect(
      resolveEffectiveSearchLocation(['Istanbul'], {
        country: 'Turkey',
        city: 'Izmir',
      }),
    ).toMatchObject({
      label: 'Istanbul, Turkey',
      source: 'search',
    });
  });

  it('keeps an explicit city, country pair unchanged', () => {
    expect(
      resolveEffectiveSearchLocation(['Berlin, Germany'], {
        country: 'Turkey',
        city: 'Izmir',
      }),
    ).toMatchObject({
      label: 'Berlin, Germany',
      source: 'search',
    });
  });

  it('applies no location filter when profile and search are empty', () => {
    expect(
      resolveEffectiveSearchLocation([], { country: null, city: null }),
    ).toMatchObject({
      locations: [],
      label: null,
      source: 'none',
    });
  });

  it('treats an existing user without country as missing profile location', () => {
    expect(hasProfileCountry({ country: null, city: 'Izmir' })).toBe(false);
    expect(hasProfileCountry({ country: 'Türkiye', city: null })).toBe(true);
  });
});

describe('formatLocationLabel', () => {
  it('does not assume Turkey', () => {
    expect(formatLocationLabel('İzmir', 'Türkiye')).toBe('İzmir, Türkiye');
    expect(formatLocationLabel(null, 'Germany')).toBe('Germany');
  });
});
