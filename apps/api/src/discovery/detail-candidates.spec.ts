import { describe, expect, it } from 'vitest';

import type { MatchDecision } from '../matching/matching.types.js';
import type { SavedSearch } from '../searches/searches.types.js';
import type { SourceJobRaw } from '../sources/job-source.adapter.js';
import {
  classifyTitleKeywordCertainty,
  isDetailRetryEligible,
  selectDetailCandidates,
} from './detail-candidates.js';
import type { SourceQueryProvenance } from './source-job-provenance.js';

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'Quality',
    isActive: true,
    keywords: ['Gıda Mühendisi', 'Kalite güvence', 'denetçi'],
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

function job(overrides: Partial<SourceJobRaw> = {}): SourceJobRaw {
  return {
    sourceJobId: 'job-1',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
    title: 'Kalite Mühendisi',
    companyName: 'Example Co',
    location: 'Manisa',
    description: undefined,
    ...overrides,
  };
}

function decision(overrides: Partial<MatchDecision> = {}): MatchDecision {
  return {
    title: 'Kalite Mühendisi',
    sourceId: 'kariyer_net',
    savedSearchId: 'search-1',
    matched: false,
    score: 0,
    threshold: 0,
    reasons: ['keyword mismatch'],
    keyword: 'fail',
    keywordKind: null,
    matchKind: null,
    evidence: [],
    roleFamily: 'none',
    roleMatch: null,
    titleMatch: 'fail',
    descriptionMatch: 'fail',
    location: 'pass',
    technology: 'skipped',
    experience: 'skipped',
    workModel: 'skipped',
    searchTerms: [],
    technologyTerms: [],
    ...overrides,
  };
}

function provenance(
  overrides: Partial<SourceQueryProvenance> = {},
): SourceQueryProvenance {
  return {
    keyword: 'Gıda Mühendisliği',
    origin: 'profession_variant',
    location: 'Manisa',
    page: 1,
    ...overrides,
  };
}

describe('classifyTitleKeywordCertainty', () => {
  it('treats a title keyword hit as definite pass', () => {
    expect(
      classifyTitleKeywordCertainty(
        decision({ keyword: 'pass', titleMatch: 'pass', matched: true, reasons: [] }),
        { title: 'Gıda Mühendisi' },
        search(),
      ),
    ).toBe('definite_pass');
  });

  it('treats a competing engineering title as definite fail', () => {
    expect(
      classifyTitleKeywordCertainty(
        decision({ keyword: 'fail', titleMatch: 'fail' }),
        { title: 'Makine Mühendisi' },
        search({ keywords: ['Gıda Mühendisi'] }),
      ),
    ).toBe('definite_fail');
  });

  it('treats Kalite Mühendisi without a title hit as inconclusive', () => {
    expect(
      classifyTitleKeywordCertainty(
        decision(),
        { title: 'Kalite Mühendisi' },
        search(),
      ),
    ).toBe('inconclusive');
  });
});

describe('isDetailRetryEligible', () => {
  const now = Date.parse('2026-09-09T12:00:00.000Z');

  it('allows a first attempt', () => {
    expect(isDetailRetryEligible(undefined, now)).toBe(true);
  });

  it('backs off after a failure instead of retrying immediately', () => {
    expect(
      isDetailRetryEligible(
        {
          description: null,
          detailFetchAttempts: 1,
          detailFetchAttemptedAt: '2026-09-09T11:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('stops after the attempt cap', () => {
    expect(
      isDetailRetryEligible(
        {
          description: null,
          detailFetchAttempts: 3,
          detailFetchAttemptedAt: '2026-08-01T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('selectDetailCandidates', () => {
  it('fetches Kalite Mühendisi from a profession variant before a title match', () => {
    const quality = job({ sourceJobId: 'quality-1', title: 'Kalite Mühendisi' });
    const direct = job({
      sourceJobId: 'gida-1',
      title: 'Gıda Mühendisi',
      location: 'İzmir',
    });
    const selected = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs: [direct, quality],
      provenances: new Map([
        [
          'kariyer_net:gida-1',
          [provenance({ keyword: 'Gıda Mühendisi', origin: 'user', location: 'İzmir' })],
        ],
        ['kariyer_net:quality-1', [provenance()]],
      ]),
      catalog: new Map(),
      evaluateMatch: (item) =>
        item.title === 'Gıda Mühendisi'
          ? decision({
              title: item.title,
              keyword: 'pass',
              titleMatch: 'pass',
              matched: true,
              reasons: [],
            })
          : decision({ title: item.title }),
      maxDetails: 1,
    });

    expect(selected.map((item) => item.job.sourceJobId)).toEqual(['quality-1']);
  });

  it('spreads the detail budget across cities and queries', () => {
    const jobs = [
      job({ sourceJobId: 'izmir-a', location: 'İzmir' }),
      job({ sourceJobId: 'izmir-b', location: 'İzmir' }),
      job({ sourceJobId: 'manisa-a', location: 'Manisa' }),
      job({ sourceJobId: 'manisa-b', location: 'Manisa' }),
    ];
    const provenances = new Map(
      jobs.map((item) => [
        `kariyer_net:${item.sourceJobId}`,
        [
          provenance({
            location: item.location ?? null,
          }),
        ],
      ]),
    );
    const selected = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs,
      provenances,
      catalog: new Map(),
      evaluateMatch: () => decision(),
      maxDetails: 2,
    });

    const cities = selected.map((item) => item.job.location).sort();
    expect(cities).toEqual(['Manisa', 'İzmir']);
  });

  it('requests one detail for a listing found by two queries', () => {
    const listing = job({ sourceJobId: 'dup-1' });
    const selected = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs: [listing],
      provenances: new Map([
        [
          'kariyer_net:dup-1',
          [
            provenance(),
            provenance({
              keyword: 'Kalite güvence',
              origin: 'user',
              location: 'Manisa',
            }),
          ],
        ],
      ]),
      catalog: new Map(),
      evaluateMatch: () => decision(),
      maxDetails: 8,
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.job.sourceJobId).toBe('dup-1');
  });

  it('skips listings that already have a description', () => {
    const selected = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs: [
        job({
          sourceJobId: 'filled',
          description: 'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
        }),
      ],
      provenances: new Map([['kariyer_net:filled', [provenance()]]]),
      catalog: new Map(),
      evaluateMatch: () => decision(),
      maxDetails: 8,
    });

    expect(selected).toEqual([]);
  });

  it('selects leftover empty listings on the next pass after an attempt is recorded', () => {
    const first = job({ sourceJobId: 'first' });
    const second = job({ sourceJobId: 'second', location: 'İzmir' });
    const provenances = new Map([
      ['kariyer_net:first', [provenance()]],
      [
        'kariyer_net:second',
        [provenance({ location: 'İzmir' })],
      ],
    ]);
    const evaluateMatch = () => decision();
    const firstPick = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs: [first, second],
      provenances,
      catalog: new Map(),
      evaluateMatch,
      maxDetails: 1,
    });
    expect(firstPick).toHaveLength(1);
    const chosen = firstPick[0]?.identity ?? '';

    const leftover = selectDetailCandidates({
      sourceId: 'kariyer_net',
      search: search(),
      jobs: [first, second],
      provenances,
      catalog: new Map([
        [
          chosen,
          {
            description: null,
            detailFetchAttempts: 1,
            detailFetchAttemptedAt: '2026-09-09T11:50:00.000Z',
          },
        ],
      ]),
      evaluateMatch,
      maxDetails: 1,
      nowMs: Date.parse('2026-09-09T12:00:00.000Z'),
    });

    expect(leftover).toHaveLength(1);
    expect(leftover[0]?.identity).not.toBe(chosen);
  });
});
