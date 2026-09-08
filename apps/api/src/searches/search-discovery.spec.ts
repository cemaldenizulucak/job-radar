import type { SavedSearch } from './searches.types.js';
import {
  discoveryRelevantFieldsChanged,
  shouldTriggerSavedSearchDiscovery,
} from './search-discovery.js';

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'angular',
    isActive: true,
    keywords: ['angular'],
    technologies: [],
    locations: ['izmir'],
    countryCode: null,
    countryName: null,
    subdivisionCode: null,
    subdivisionName: null,
    workTypes: [],
    experienceLevels: [],
    sourceIds: ['linkedin', 'kariyer_net'],
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('shouldTriggerSavedSearchDiscovery', () => {
  it('triggers for a newly created active search', () => {
    expect(shouldTriggerSavedSearchDiscovery(null, search())).toBe(true);
  });

  it('does not trigger for a newly created inactive search', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(null, search({ isActive: false })),
    ).toBe(false);
  });

  it('triggers when an inactive search is activated', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search({ isActive: false }),
        search({ isActive: true }),
      ),
    ).toBe(true);
  });

  it('does not trigger when an active search is paused', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search({ isActive: true }),
        search({ isActive: false, keywords: ['react'] }),
      ),
    ).toBe(false);
  });

  it('triggers when keywords change on an active search', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ keywords: ['react'] }),
      ),
    ).toBe(true);
  });

  it('triggers when location changes on an active search', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ locations: ['istanbul'] }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({
          countryCode: 'TR',
          countryName: 'Türkiye',
          locations: ['Türkiye'],
        }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerSavedSearchDiscovery(
        search({
          countryCode: 'TR',
          countryName: 'Türkiye',
          subdivisionNames: ['İzmir'],
        }),
        search({
          countryCode: 'TR',
          countryName: 'Türkiye',
          subdivisionNames: ['İzmir', 'İstanbul'],
        }),
      ),
    ).toBe(true);
  });

  it('triggers when technologies, work types, experience, or sources change', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ technologies: ['react'] }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ workTypes: ['remote'] }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ experienceLevels: ['senior'] }),
      ),
    ).toBe(true);
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ sourceIds: ['linkedin'] }),
      ),
    ).toBe(true);
  });

  it('does not trigger when only the name changes', () => {
    expect(
      shouldTriggerSavedSearchDiscovery(
        search(),
        search({ name: 'Angular jobs in Izmir' }),
      ),
    ).toBe(false);
    expect(
      discoveryRelevantFieldsChanged(
        search(),
        search({ name: 'Angular jobs in Izmir' }),
      ),
    ).toBe(false);
  });
});
