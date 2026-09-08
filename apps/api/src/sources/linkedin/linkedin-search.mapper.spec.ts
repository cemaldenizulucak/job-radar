import type { SourceSearchQuery } from '../job-source.adapter.js';
import { LINKEDIN_CAPABILITIES } from './linkedin.types.js';
import { mapLinkedInSearch } from './linkedin-search.mapper.js';

const query: SourceSearchQuery = {
  keywords: ['frontend', ' Frontend '],
  technologies: ['React', 'frontend'],
  locations: ['Istanbul', ''],
  workModels: ['hybrid', 'unknown', 'remote'],
  experienceLevels: ['mid', ' mid '],
  savedSearchId: 'search-should-not-map',
};

describe('mapLinkedInSearch', () => {
  it('sends keyword and location filters and omits workplace type', () => {
    const mapped = mapLinkedInSearch(query, LINKEDIN_CAPABILITIES);

    expect(mapped).toEqual({
      keywords: ['frontend'],
      locations: ['Istanbul'],
      workTypes: [],
      experienceLevels: [],
    });
    expect(mapped).not.toHaveProperty('savedSearchId');
  });

  it('forwards the discovery max-age window', () => {
    const mapped = mapLinkedInSearch(
      { ...query, maxAgeDays: 30 },
      LINKEDIN_CAPABILITIES,
    );

    expect(mapped.maxAgeDays).toBe(30);
  });

  it('does not fake keyword or location support', () => {
    const mapped = mapLinkedInSearch(query, {
      supportsKeywordSearch: false,
      supportsLocation: false,
      supportsRemoteFilter: false,
      supportsExperienceLevel: false,
    });

    expect(mapped).toEqual({
      keywords: [],
      locations: [],
      workTypes: [],
      experienceLevels: [],
    });
  });
});
