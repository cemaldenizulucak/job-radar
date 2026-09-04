import { mapSavedSearchRow, mapSavedSearchRows } from './searches.mapper.js';

const validRow = {
  id: 'search-1',
  user_id: 'user-1',
  name: 'Frontend',
  is_active: true,
  keywords: ['frontend'],
  technologies: ['react'],
  locations: ['Istanbul'],
  work_types: ['remote', 'office'],
  experience_levels: ['mid'],
  sources: ['linkedin', 'unknown_board'],
};

describe('mapSavedSearchRow', () => {
  it('maps saved_searches columns onto the search domain type', () => {
    expect(mapSavedSearchRow(validRow)).toEqual({
      id: 'search-1',
      userId: 'user-1',
      name: 'Frontend',
      isActive: true,
      keywords: ['frontend'],
      technologies: ['react'],
      locations: ['Istanbul'],
      countryCode: null,
      countryName: null,
      subdivisionCode: null,
      subdivisionName: null,
      workTypes: ['remote'],
      experienceLevels: ['mid'],
      sourceIds: ['linkedin'],
      createdAt: '',
      updatedAt: '',
    });
  });

  it('maps structured location columns when present', () => {
    expect(
      mapSavedSearchRow({
        ...validRow,
        country_code: 'TR',
        country_name: 'Türkiye',
        subdivision_code: '35',
        subdivision_name: 'İzmir',
      }),
    ).toEqual(
      expect.objectContaining({
        countryCode: 'TR',
        countryName: 'Türkiye',
        subdivisionCode: '35',
        subdivisionName: 'İzmir',
      }),
    );
  });

  it('drops sentinel location values from mapped rows', () => {
    expect(
      mapSavedSearchRow({
        ...validRow,
        locations: ['', 'Tümü', 'İzmir'],
        country_code: 'ALL',
        country_name: 'Tümü',
        subdivision_name: 'all',
      }),
    ).toEqual(
      expect.objectContaining({
        locations: ['İzmir'],
        countryCode: null,
        countryName: null,
        subdivisionName: null,
      }),
    );
  });

  it('drops invalid rows instead of throwing', () => {
    expect(mapSavedSearchRow({ name: 'Missing ids' })).toBeNull();
    expect(mapSavedSearchRows([validRow, null, 'bad'])).toEqual([
      expect.objectContaining({ id: 'search-1' }),
    ]);
  });
});
