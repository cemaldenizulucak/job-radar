import { describe, expect, it } from 'vitest';

import type { SavedSearch, SavedSearchWriteInput } from '../types/search.types';
import { formValuesToWriteInput } from '../validation/search.schema';
import {
  createSubmitLock,
  DELETE_SAVED_SEARCH_MESSAGE,
  DELETE_SAVED_SEARCH_TITLE,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
  selectedSearchIdAfterDelete,
  shouldRefreshAfterSearchWrite,
} from './search-write';

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'Angular Istanbul',
    isActive: true,
    keywords: ['angular'],
    technologies: [],
    locations: ['istanbul'],
    countryCode: null,
    countryName: null,
    subdivisionCode: null,
    subdivisionName: null,
    workTypes: [],
    experienceLevels: [],
    sources: ['linkedin', 'kariyer_net'],
    effectiveLocation: 'istanbul',
    locationSource: 'search',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

function writeInput(
  overrides: Partial<SavedSearchWriteInput> = {},
): SavedSearchWriteInput {
  return {
    name: 'Angular Istanbul',
    isActive: true,
    keywords: ['angular'],
    technologies: [],
    locations: ['istanbul'],
    countryCode: null,
    countryName: null,
    subdivisionCode: null,
    subdivisionName: null,
    workTypes: [],
    experienceLevels: [],
    sources: ['linkedin', 'kariyer_net'],
    ...overrides,
  };
}

describe('search write helpers', () => {
  it('treats partial and failed discovery as a safe warning', () => {
    expect(isDiscoveryWarning('partial')).toBe(true);
    expect(isDiscoveryWarning('failed')).toBe(true);
    expect(isDiscoveryWarning('completed')).toBe(false);
    expect(isDiscoveryWarning('skipped')).toBe(false);
    expect(PARTIAL_DISCOVERY_MESSAGE).toContain('Arama kaydedildi.');
  });

  it('prevents duplicate form submission while a request is in flight', () => {
    const lock = createSubmitLock();

    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);

    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });

  it('explains that delete removes the search, not job listings', () => {
    expect(DELETE_SAVED_SEARCH_TITLE).toBe('Bu kayıtlı arama silinsin mi?');
    expect(DELETE_SAVED_SEARCH_MESSAGE).toContain(
      'İş ilanları silinmez',
    );
    expect(DELETE_SAVED_SEARCH_MESSAGE).toContain(
      'sekmesinde görünmez',
    );
  });

  it('switches Jobs back to All when the selected search is deleted', () => {
    expect(selectedSearchIdAfterDelete('search-1', 'search-1')).toBe('all');
    expect(selectedSearchIdAfterDelete('search-2', 'search-1')).toBe('search-2');
    expect(selectedSearchIdAfterDelete('all', 'search-1')).toBe('all');
  });
});

describe('formValuesToWriteInput', () => {
  it('derives locations from optional country and subdivision dropdowns', () => {
    expect(
      formValuesToWriteInput({
        name: 'Frontend',
        keywords: 'Frontend Developer',
        technologies: '',
        countryCode: 'TR',
        countryName: 'Türkiye',
        subdivisionCode: '35',
        subdivisionName: 'İzmir',
        experienceLevels: '',
        workTypes: [],
        sources: ['linkedin', 'kariyer_net'],
        isActive: true,
      }),
    ).toMatchObject({
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
      locations: ['İzmir', 'İzmir, Türkiye'],
      workTypes: [],
    });
  });

  it('never sends a work model filter', () => {
    expect(
      formValuesToWriteInput({
        name: 'Frontend',
        keywords: 'Frontend Developer',
        technologies: '',
        countryCode: '',
        countryName: '',
        subdivisionCode: '',
        subdivisionName: '',
        experienceLevels: '',
        workTypes: ['remote'],
        sources: ['linkedin', 'kariyer_net'],
        isActive: true,
      }).workTypes,
    ).toEqual([]);
  });
});

describe('shouldRefreshAfterSearchWrite', () => {
  it('refreshes when creating an active search', () => {
    expect(shouldRefreshAfterSearchWrite(null, writeInput())).toBe(true);
  });

  it('refreshes when location changes on an active search', () => {
    expect(
      shouldRefreshAfterSearchWrite(
        search(),
        writeInput({ locations: ['izmir'] }),
      ),
    ).toBe(true);
    expect(
      shouldRefreshAfterSearchWrite(
        search(),
        writeInput({
          countryCode: 'TR',
          countryName: 'Türkiye',
          locations: ['Türkiye'],
        }),
      ),
    ).toBe(true);
  });

  it('refreshes when keywords change on an active search', () => {
    expect(
      shouldRefreshAfterSearchWrite(
        search(),
        writeInput({ keywords: ['react'] }),
      ),
    ).toBe(true);
  });

  it('refreshes when an inactive search is turned on', () => {
    expect(
      shouldRefreshAfterSearchWrite(
        search({ isActive: false }),
        writeInput({ isActive: true }),
      ),
    ).toBe(true);
  });

  it('does not refresh when an active search is paused', () => {
    expect(
      shouldRefreshAfterSearchWrite(
        search({ isActive: true }),
        writeInput({ isActive: false, keywords: ['react'] }),
      ),
    ).toBe(false);
  });

  it('does not refresh when only the name changes', () => {
    expect(
      shouldRefreshAfterSearchWrite(
        search(),
        writeInput({ name: 'Frontend Istanbul' }),
      ),
    ).toBe(false);
  });
});
