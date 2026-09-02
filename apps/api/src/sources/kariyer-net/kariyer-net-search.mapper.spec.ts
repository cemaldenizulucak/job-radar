import type { SourceSearchQuery } from '../job-source.adapter.js';
import { KARIYER_NET_CAPABILITIES } from './kariyer-net.types.js';
import { mapKariyerNetSearch } from './kariyer-net-search.mapper.js';

const query: SourceSearchQuery = {
  keywords: ['frontend', ' Frontend '],
  technologies: ['React', 'frontend'],
  locations: ['Istanbul', ''],
  workModels: ['hybrid', 'unknown', 'remote'],
  experienceLevels: ['mid', ' mid '],
  savedSearchId: 'search-should-not-map',
};

describe('mapKariyerNetSearch', () => {
  it('sends keyword and location filters and omits unsupported capabilities', () => {
    const mapped = mapKariyerNetSearch(query, KARIYER_NET_CAPABILITIES);

    expect(mapped).toEqual({
      keywords: ['frontend', 'React'],
      locations: ['Istanbul'],
      workTypes: [],
      experienceLevels: [],
    });
    expect(mapped).not.toHaveProperty('savedSearchId');
  });

  it('includes work type and experience only when the source supports them', () => {
    const mapped = mapKariyerNetSearch(query, {
      supportsKeywordSearch: true,
      supportsLocation: true,
      supportsRemoteFilter: true,
      supportsExperienceLevel: true,
    });

    expect(mapped.workTypes).toEqual(['hybrid', 'remote']);
    expect(mapped.experienceLevels).toEqual(['mid']);
  });

  it('forwards the discovery max-age window', () => {
    const mapped = mapKariyerNetSearch(
      { ...query, maxAgeDays: 30 },
      KARIYER_NET_CAPABILITIES,
    );

    expect(mapped.maxAgeDays).toBe(30);
  });

  it('does not fake keyword or location support', () => {
    const mapped = mapKariyerNetSearch(query, {
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
