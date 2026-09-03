import { toSavedSearchResponse } from './searches.write.js';
import type { SavedSearch } from './searches.types.js';

const search: SavedSearch = {
  id: 'search-1',
  userId: 'user-1',
  name: 'gıda',
  isActive: true,
  keywords: ['gıda mühendisi'],
  technologies: [],
  locations: [],
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
    expect(response.effectiveLocation).toBe('İzmir, Türkiye');
    expect(response.locationSource).toBe('profile');
  });

  it('keeps an explicit search location separate from the profile default', () => {
    const response = toSavedSearchResponse(
      { ...search, locations: ['İstanbul'] },
      { country: 'Türkiye', city: 'İzmir' },
    );

    expect(response.locations).toEqual(['İstanbul']);
    expect(response.effectiveLocation).toBe('İstanbul, Türkiye');
    expect(response.locationSource).toBe('search');
  });
});
