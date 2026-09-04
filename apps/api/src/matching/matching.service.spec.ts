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
    countryCode: null,
    countryName: null,
    subdivisionCode: null,
    subdivisionName: null,
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

  it('matches bilgisayar in the title or description without a role family', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Bilgisayar Mühendisi',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['bilgisayar'] }),
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Yazılım Uzmanı',
          description: 'BİLGİSAYAR laboratuvarı deneyimi',
          technologies: [],
        }),
        search({ keywords: ['Bilgisayar'] }),
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

  it('matches a structured city without rejecting other work models', () => {
    const listing = job({
      title: 'Gıda Mühendisi',
      location: 'Konak / İzmir',
      description: null,
      technologies: [],
    });

    expect(
      matcher.jobMatchesSearch(
        listing,
        search({
          keywords: ['gıda'],
          countryCode: 'TR',
          countryName: 'Türkiye',
          subdivisionCode: '35',
          subdivisionName: 'İzmir',
        }),
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        listing,
        search({
          keywords: ['gıda'],
          countryCode: 'TR',
          countryName: 'Türkiye',
          subdivisionCode: '34',
          subdivisionName: 'İstanbul',
        }),
      ),
    ).toBe(false);
  });

  it('accepts every city in a country-only structured search when aliases are cached', () => {
    const locations = {
      getCachedSubdivisionNames: (code: string) =>
        code === 'TR' ? ['İstanbul', 'İzmir', 'Ankara'] : null,
    };
    const withAliases = new MatchingService(locations as never);

    expect(
      withAliases.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'İzmir',
          description: null,
          technologies: [],
        }),
        search({
          keywords: ['gıda'],
          countryCode: 'TR',
          countryName: 'Türkiye',
        }),
      ),
    ).toBe(true);
    expect(
      withAliases.jobMatchesSearch(
        job({
          id: 'job-2',
          title: 'Gıda Mühendisi',
          location: 'Berlin',
          description: null,
          technologies: [],
        }),
        search({
          keywords: ['gıda'],
          countryCode: 'TR',
          countryName: 'Türkiye',
        }),
      ),
    ).toBe(false);
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

  it('accepts every location when the search location is empty', () => {
    const saved = search({ keywords: ['gıda'], locations: [] });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Istanbul, Turkey',
          description: null,
          technologies: [],
        }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-2',
          title: 'Gıda Mühendisi',
          location: 'Berlin',
          description: null,
          technologies: [],
        }),
        saved,
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

  it('matches Frontend Developer with every other filter empty', () => {
    const saved = search({
      keywords: ['Frontend Developer'],
      technologies: [],
      locations: [],
      workTypes: [],
      experienceLevels: [],
    });

    for (const workModel of ['remote', 'hybrid', 'onsite'] as const) {
      expect(
        matcher.jobMatchesSearch(
          job({
            id: `job-${workModel}`,
            title: 'Frontend Developer',
            location: 'Ankara',
            workModel,
            experienceLevel: 'junior',
            technologies: [],
            description: null,
          }),
          saved,
        ),
      ).toBe(true);
    }
  });

  it('never rejects on work model even when the search stored a work type', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Frontend Developer',
          workModel: 'onsite',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['Frontend Developer'], workTypes: ['remote'] }),
      ),
    ).toBe(true);
  });

  it('does not reject on technologies or experience when those filters are empty', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Frontend Developer',
          technologies: ['Vue'],
          experienceLevel: 'intern',
          description: null,
        }),
        search({
          keywords: ['Frontend Developer'],
          technologies: [],
          experienceLevels: [],
        }),
      ),
    ).toBe(true);
  });

  it('writes matches to the originating saved_search_id for each user', () => {
    const listing = job({ title: 'Frontend Developer', description: null });
    const userA = search({
      id: 'search-a',
      userId: 'user-a',
      keywords: ['Frontend Developer'],
    });
    const userB = search({
      id: 'search-b',
      userId: 'user-b',
      keywords: ['Frontend Developer'],
    });

    expect(matcher.matchJobsToSearches([listing], [userA, userB])).toEqual([
      { jobId: 'job-1', savedSearchId: 'search-a' },
      { jobId: 'job-1', savedSearchId: 'search-b' },
    ]);
  });

  it('does not reject on location when only keyword=bilgisayar is set', () => {
    const saved = search({
      keywords: ['bilgisayar'],
      technologies: [],
      locations: ['', 'Tümü'],
      countryCode: null,
      countryName: 'Tümü',
      subdivisionCode: '',
      subdivisionName: '',
      workTypes: [],
      experienceLevels: [],
    });
    const ankara = job({
      title: 'Bilgisayar Mühendisi',
      location: 'Ankara',
      description: null,
      technologies: [],
    });
    const berlin = job({
      id: 'job-2',
      title: 'Yazılım Uzmanı',
      description: 'bilgisayar laboratuvarı',
      location: 'Berlin',
      technologies: [],
    });

    const ankaraDecision = matcher.evaluateMatch(ankara, saved);
    const berlinDecision = matcher.evaluateMatch(berlin, saved);

    expect(ankaraDecision.location).toBe('skipped');
    expect(berlinDecision.location).toBe('skipped');
    expect(ankaraDecision.technology).toBe('skipped');
    expect(ankaraDecision.experience).toBe('skipped');
    expect(ankaraDecision.workModel).toBe('skipped');
    expect(ankaraDecision.reasons).not.toContain('location mismatch');
    expect(berlinDecision.reasons).not.toContain('location mismatch');
    expect(ankaraDecision.matched).toBe(true);
    expect(berlinDecision.matched).toBe(true);
  });

  it('keeps text matching even if the keyword is not a software role family', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Bilgisayar Operatörü',
        description: null,
        technologies: [],
      }),
      search({ keywords: ['BİLGİSAYAR'] }),
    );

    expect(decision.roleFamily).toBe('none');
    expect(decision.matched).toBe(true);
    expect(decision.keyword).toBe('pass');
  });
});
