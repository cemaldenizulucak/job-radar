import { describe, expect, it } from 'vitest';

import { MatchingService } from './matching.service.js';
import type { MatchableJob } from './matching.types.js';
import type { SavedSearch } from '../searches/searches.types.js';
import {
  collectUnverifiedSourceCandidates,
  shouldCreateUnverifiedSourceCandidate,
  type SearchScopedProvenance,
} from './source-candidate-match.js';

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-gida',
    userId: 'user-1',
    name: 'Gıda',
    isActive: true,
    keywords: ['Gıda Mühendisliği'],
    technologies: [],
    locations: [],
    countryCode: null,
    countryName: null,
    subdivisionCode: null,
    subdivisionName: null,
    workTypes: [],
    experienceLevels: [],
    sourceIds: ['kariyer_net'],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function job(overrides: Partial<MatchableJob> = {}): MatchableJob {
  return {
    id: 'job-quality',
    sourceId: 'kariyer_net',
    title: 'Kalite Mühendisi',
    companyName: 'Example Food Co',
    description: null,
    location: 'Manisa',
    workModel: null,
    experienceLevel: null,
    technologies: [],
    sourceJobId: 'quality-1',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/quality-1',
    ...overrides,
  };
}

function provenance(
  overrides: Partial<SearchScopedProvenance> = {},
): SearchScopedProvenance {
  return {
    savedSearchId: 'search-gida',
    keyword: 'Gıda Mühendisliği',
    origin: 'profession_variant',
    location: 'Manisa',
    ...overrides,
  };
}

describe('shouldCreateUnverifiedSourceCandidate', () => {
  const matcher = new MatchingService();

  it('creates a candidate for a profession variant hit when detail is blocked', () => {
    const listing = job();
    const saved = search();
    expect(
      shouldCreateUnverifiedSourceCandidate({
        job: listing,
        search: saved,
        decision: matcher.evaluateMatch(listing, saved),
        provenances: [provenance()],
        detailErrorCategory: 'challenge',
      }),
    ).toBe(true);
  });

  it('does not create a candidate for an unrelated competing title', () => {
    const listing = job({
      id: 'job-machine',
      title: 'Makine Mühendisi',
      companyName: 'Gıda A.Ş.',
    });
    const saved = search();
    expect(
      shouldCreateUnverifiedSourceCandidate({
        job: listing,
        search: saved,
        decision: matcher.evaluateMatch(listing, saved),
        provenances: [provenance()],
        detailErrorCategory: 'challenge',
      }),
    ).toBe(false);
  });

  it('does not create a candidate from a loose company-name fragment', () => {
    const listing = job({
      id: 'job-machine',
      title: 'Makine Mühendisi',
      companyName: 'Gıda A.Ş.',
    });
    const saved = search();
    expect(
      shouldCreateUnverifiedSourceCandidate({
        job: listing,
        search: saved,
        decision: matcher.evaluateMatch(listing, saved),
        provenances: [
          provenance({
            keyword: 'Gıda',
            origin: 'user',
          }),
        ],
        detailErrorCategory: 'challenge',
      }),
    ).toBe(false);
  });
});

describe('collectUnverifiedSourceCandidates', () => {
  const matcher = new MatchingService();

  it('skips a pair that already has a verified match', () => {
    const listing = job();
    const saved = search();
    const candidates = collectUnverifiedSourceCandidates({
      jobs: [listing],
      searches: [saved],
      provenances: new Map([[listing.id, [provenance()]]]),
      detailErrorByJobId: new Map([[listing.id, 'challenge']]),
      evaluateMatch: (currentJob, currentSearch) =>
        matcher.evaluateMatch(currentJob, currentSearch),
      verifiedKeys: new Set([`${listing.id}:${saved.id}`]),
    });

    expect(candidates).toEqual([]);
  });
});
