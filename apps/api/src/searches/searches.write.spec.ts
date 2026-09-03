import { parseSavedSearchWrite, toSavedSearchResponse } from './searches.write.js';
import type { SavedSearch } from './searches.types.js';

const search: SavedSearch = {
  id: 'search-1',
  userId: 'user-1',
  name: 'gıda',
  isActive: true,
  keywords: ['gıda mühendisi'],
  technologies: [],
  locations: [],
  countryCode: null,
  countryName: null,
  subdivisionCode: null,
  subdivisionName: null,
  workTypes: [],
  experienceLevels: [],
  sourceIds: ['linkedin'],
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

describe('toSavedSearchResponse location resolution', () => {
  it('does not write profile location into stored locations', () => {
    const response = toSavedSearchResponse(search, {
      country: 'Türkiye',
      city: 'İzmir',
    });

    expect(response.locations).toEqual([]);
    expect(response.effectiveLocation).toBeNull();
    expect(response.locationSource).toBe('none');
  });

  it('exposes structured country and subdivision on the response', () => {
    const response = toSavedSearchResponse({
      ...search,
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
      locations: ['İzmir', 'İzmir, Türkiye'],
    });

    expect(response.countryCode).toBe('TR');
    expect(response.subdivisionName).toBe('İzmir');
    expect(response.effectiveLocation).toBe('İzmir, Türkiye');
    expect(response.locationSource).toBe('search');
  });

  it('keeps an explicit search location separate from the profile default', () => {
    const response = toSavedSearchResponse(
      { ...search, locations: ['İstanbul'] },
      { country: 'Türkiye', city: 'İzmir' },
    );

    expect(response.locations).toEqual(['İstanbul']);
    expect(response.effectiveLocation).toBe('İstanbul');
    expect(response.locationSource).toBe('search');
  });
});

describe('parseSavedSearchWrite', () => {
  it('derives locations from structured country and subdivision', () => {
    expect(
      parseSavedSearchWrite({
        name: 'Frontend',
        keywords: ['frontend'],
        sources: ['linkedin'],
        countryCode: 'tr',
        countryName: 'Türkiye',
        subdivisionCode: '35',
        subdivisionName: 'İzmir',
      }),
    ).toMatchObject({
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
      locations: ['İzmir', 'İzmir, Türkiye'],
    });
  });

  it('keeps legacy locations when structured fields are omitted', () => {
    expect(
      parseSavedSearchWrite({
        name: 'Frontend',
        keywords: ['frontend'],
        sources: ['linkedin'],
        locations: ['istanbul'],
      }),
    ).toMatchObject({
      countryCode: null,
      countryName: null,
      subdivisionCode: null,
      subdivisionName: null,
      locations: ['istanbul'],
    });
  });
});
