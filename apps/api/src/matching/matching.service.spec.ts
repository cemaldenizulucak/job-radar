import { MatchingService } from './matching.service.js';
import type { MatchableJob } from './matching.types.js';
import type { SavedSearch } from '../searches/searches.types.js';

const matcher = new MatchingService();

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'Search',
    isActive: true,
    keywords: ['frontend'],
    technologies: [],
    locations: [],
    workTypes: [],
    experienceLevels: [],
    sourceIds: ['linkedin', 'kariyer_net'],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function job(overrides: Partial<MatchableJob> = {}): MatchableJob {
  return {
    id: 'job-1',
    sourceId: 'linkedin',
    title: 'Frontend Engineer',
    companyName: 'ABC Technology',
    description: 'React and TypeScript.',
    location: 'Istanbul, Turkey',
    workModel: 'remote',
    experienceLevel: 'mid',
    technologies: ['React', 'TypeScript'],
    ...overrides,
  };
}

describe('MatchingService generic text matching', () => {
  it('matches one listing to many saved searches', () => {
    const listing = job({ title: 'Gıda Mühendisi', description: null });
    const food = search({ id: 'search-gida', keywords: ['gıda'] });
    const engineer = search({ id: 'search-muhendis', keywords: ['mühendis'] });

    expect(matcher.matchJobsToSearches([listing], [food, engineer])).toEqual([
      { jobId: 'job-1', savedSearchId: 'search-gida' },
      { jobId: 'job-1', savedSearchId: 'search-muhendis' },
    ]);
  });

  it('does not match unrelated job text', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Satış Temsilcisi',
          description: 'B2B satış',
          technologies: [],
        }),
        search({ keywords: ['muhasebe'] }),
      ),
    ).toBe(false);
  });

  it('does not use inactive searches', () => {
    const listing = job({ title: 'Gıda Mühendisi' });
    const inactive = search({ isActive: false, keywords: ['gıda'] });

    expect(matcher.jobMatchesSearch(listing, inactive)).toBe(false);
    expect(matcher.matchJobsToSearches([listing], [inactive])).toEqual([]);
  });

  it('does not match a listing from a source the search excluded', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ sourceId: 'kariyer_net', title: 'Gıda Mühendisi' }),
        search({ keywords: ['gıda'], sourceIds: ['linkedin'] }),
      ),
    ).toBe(false);
  });

  it('matches gıda against Gıda Mühendisi', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Gıda Mühendisi', description: null, technologies: [] }),
        search({ keywords: ['gıda'] }),
      ),
    ).toBe(true);
  });

  it('matches GIDA against Gıda Mühendisi', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Gıda Mühendisi', description: null, technologies: [] }),
        search({ keywords: ['GIDA'] }),
      ),
    ).toBe(true);
  });

  it('matches mühendis against Gıda Mühendisi', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Gıda Mühendisi', description: null, technologies: [] }),
        search({ keywords: ['mühendis'] }),
      ),
    ).toBe(true);
  });

  it('matches a phrase inside a longer English sentence', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'A Senior Specialist for Gıda Production',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'] }),
      ),
    ).toBe(true);
  });

  it('matches frontend against Senior Frontend Developer and Front-End Engineer', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Senior Frontend Developer', description: null, technologies: [] }),
        search({ keywords: ['frontend'] }),
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Senior Front-End Engineer', description: null, technologies: [] }),
        search({ keywords: ['frontend'] }),
      ),
    ).toBe(true);
  });

  it('matches react when the title or description contains React', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Software Engineer', description: 'We use React daily.', technologies: [] }),
        search({ keywords: ['react'] }),
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'React Developer', description: null, technologies: [] }),
        search({ keywords: ['react'] }),
      ),
    ).toBe(true);
  });

  it('matches a single letter when it appears in searchable text', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Satış', description: null, technologies: [] }),
        search({ keywords: ['a'] }),
      ),
    ).toBe(true);
  });

  it('uses OR semantics across multiple keywords', () => {
    const listing = job({
      title: 'Kalite Uzmanı',
      description: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['gıda mühendisi', 'kalite uzmanı'],
    });

    expect(matcher.jobMatchesSearch(listing, saved)).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Gıda Mühendisi', description: null, technologies: [] }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Muhasebe Uzmanı', description: null, technologies: [] }),
        saved,
      ),
    ).toBe(false);
  });

  it('does not reject on location when the search has no location', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Ankara',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
      ),
    ).toBe(true);
  });

  it('filters by location with Turkish substring matching', () => {
    const listing = job({
      title: 'Gıda Mühendisi',
      location: 'Konak / İzmir',
      description: null,
      technologies: [],
    });

    expect(
      matcher.jobMatchesSearch(listing, search({ keywords: ['gıda'], locations: ['İzmir'] })),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(listing, search({ keywords: ['gıda'], locations: ['istanbul'] })),
    ).toBe(false);
  });

  it('matches Istanbul to İstanbul(Asya)', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'İstanbul(Asya)',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: ['istanbul'] }),
      ),
    ).toBe(true);
  });

  it('does not hide a textual match because technologies look unrelated', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Frontend Developer',
          description: null,
          technologies: ['Angular'],
        }),
        search({ keywords: ['frontend'], technologies: ['react'] }),
      ),
    ).toBe(true);
  });

  it('still matches Front-End Geliştirici for a frontend developer keyword', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Front-End Geliştirici',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['frontend developer'] }),
      ),
    ).toBe(true);
  });

  it('still matches existing frontend/react searches through text', () => {
    const listing = job({
      title: 'Senior Frontend Engineer (React)',
      description: null,
      technologies: [],
    });

    expect(
      matcher.jobMatchesSearch(
        listing,
        search({ keywords: ['frontend'], technologies: ['react'] }),
      ),
    ).toBe(true);
  });

  it('scores an exact title phrase higher than a description hit', () => {
    const saved = search({ keywords: ['gıda mühendisi'] });
    const titleHit = matcher.evaluateMatch(
      job({ title: 'Gıda Mühendisi', description: null, technologies: [] }),
      saved,
    );
    const descriptionHit = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Üretim Uzmanı',
        description: 'Gıda mühendisi arıyoruz.',
        technologies: [],
      }),
      saved,
    );

    expect(titleHit.matched).toBe(true);
    expect(descriptionHit.matched).toBe(true);
    expect(titleHit.score).toBeGreaterThan(descriptionHit.score);
  });

  it('never uses score to exclude a textual match', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Üretim',
        companyName: 'Gıda AŞ',
        description: null,
        technologies: [],
      }),
      search({ keywords: ['gıda'] }),
    );

    expect(decision.matched).toBe(true);
    expect(decision.score).toBeGreaterThan(0);
    expect(decision.reasons).toEqual([]);
  });

  it('uses profile city and country when the search location is empty', () => {
    const profile = { country: 'Turkey', city: 'Izmir' };

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Izmir, Turkey',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
        profile,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Istanbul, Turkey',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
        profile,
      ),
    ).toBe(false);
  });

  it('matches any city in the country when the profile has no city', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Istanbul, Turkey',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
        { country: 'Turkey', city: null },
      ),
    ).toBe(true);
  });

  it('allows a country-only job when city metadata is missing', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Türkiye',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
        { country: 'Türkiye', city: 'İzmir' },
      ),
    ).toBe(true);
  });

  it('does not reject a job with unknown location text', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: null,
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: ['İzmir'] }),
      ),
    ).toBe(true);
  });

  it('still matches when the user has no profile location', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Berlin',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['gıda'], locations: [] }),
        { country: null, city: null },
      ),
    ).toBe(true);
  });
});
