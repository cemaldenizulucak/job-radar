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
      workTypes: ['remote'],
      experienceLevels: ['mid'],
      sourceIds: ['linkedin'],
      createdAt: '',
      updatedAt: '',
    });
  });

  it('drops invalid rows instead of throwing', () => {
    expect(mapSavedSearchRow({ name: 'Missing ids' })).toBeNull();
    expect(mapSavedSearchRows([validRow, null, 'bad'])).toEqual([
      expect.objectContaining({ id: 'search-1' }),
    ]);
  });
});
