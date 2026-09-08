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

  it('does not treat a single generic letter as a substring match', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Satış', description: null, technologies: [] }),
        search({ keywords: ['a'] }),
      ),
    ).toBe(false);
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

  it('rejects Kahramanmaraş and İstanbul for an İzmir search', () => {
    const izmirSearch = search({
      keywords: ['Gıda Mühendisi, kalite güvence'],
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
    });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          location: 'Kahramanmaraş',
          description: 'kalite güvence',
        }),
        izmirSearch,
      ),
    ).toBe(false);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-ist',
          title: 'Gıda Mühendisi',
          location: 'İstanbul(Asya)',
          description: 'kalite güvence',
        }),
        izmirSearch,
      ),
    ).toBe(false);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-izmir',
          title: 'Gıda Mühendisi',
          location: 'İzmir',
          description: null,
        }),
        izmirSearch,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-izmir-tr',
          title: 'Kalite Güvence Uzmanı',
          location: 'İzmir, Türkiye',
          description: null,
        }),
        izmirSearch,
      ),
    ).toBe(true);
  });

  it('does not let a keyword match bypass a city location filter', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Gıda Mühendisi',
        location: 'Kahramanmaraş',
        description: 'kalite güvence',
      }),
      search({
        keywords: ['Gıda Mühendisi', 'kalite güvence'],
        countryCode: 'TR',
        countryName: 'Türkiye',
        subdivisionName: 'İzmir',
      }),
    );

    expect(decision.keyword).toBe('pass');
    expect(decision.location).toBe('fail');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('location mismatch');
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
        title: 'Gıda Üretim Uzmanı',
        companyName: 'Unrelated Holdings',
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

  it('rejects a job with empty location when a city filter is set', () => {
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
    ).toBe(false);
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

  it('rejects an onsite job when the search only allows remote', () => {
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
    ).toBe(false);
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

  it('matches a LinkedIn Gıda Mühendisi listing for the same keyword search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          sourceId: 'linkedin',
          title: 'Gıda Mühendisi',
          location: 'İzmir',
          description: 'Kalite güvence',
        }),
        search({ keywords: ['Gıda Mühendisi'] }),
      ),
    ).toBe(true);
  });

  it('matches ascii and short typo variants of Gıda Mühendisi', () => {
    const listing = job({
      sourceId: 'linkedin',
      title: 'Gıda Mühendisi',
      description: null,
    });

    expect(
      matcher.jobMatchesSearch(listing, search({ keywords: ['Gida Muhendisi'] })),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(listing, search({ keywords: ['Gıda Muhendis'] })),
    ).toBe(true);
  });

  it('does not match Yazılım Mühendisi for a Gıda Mühendisi search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Yazılım Mühendisi', description: null }),
        search({ keywords: ['Gıda Mühendisi'] }),
      ),
    ).toBe(false);
  });

  it('accepts İzmir or İstanbul and rejects Ankara for a multi-city search', () => {
    const saved = search({
      keywords: ['gıda mühendisi'],
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCodes: ['35', '34'],
      subdivisionNames: ['İzmir', 'İstanbul'],
    });

    expect(
      matcher.jobMatchesSearch(
        job({ title: 'Gıda Mühendisi', location: 'İzmir', description: null }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-ist',
          title: 'Gıda Mühendisi',
          location: 'İstanbul(Asya)',
          description: null,
        }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-ank',
          title: 'Gıda Mühendisi',
          location: 'Ankara',
          description: null,
        }),
        saved,
      ),
    ).toBe(false);
  });

  it('matches without a technology field', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          description: null,
          technologies: ['SAP'],
        }),
        search({ keywords: ['Gıda Mühendisi'], technologies: [] }),
      ),
    ).toBe(true);
  });

  it('does not let technologies reject or become required keyword terms', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          description: null,
          technologies: [],
        }),
        search({
          keywords: ['Gıda Mühendisi'],
          technologies: ['react'],
        }),
      ),
    ).toBe(true);
  });

  it('keeps matches scoped to each saved search id for isolation', () => {
    const listing = job({ title: 'Gıda Mühendisi', description: null });
    const userA = search({
      id: 'search-a',
      userId: 'user-a',
      keywords: ['Gıda Mühendisi'],
    });
    const userB = search({
      id: 'search-b',
      userId: 'user-b',
      keywords: ['Yazılım Mühendisi'],
    });

    expect(matcher.matchJobsToSearches([listing], [userA, userB])).toEqual([
      { jobId: 'job-1', savedSearchId: 'search-a' },
    ]);
  });

  it('matches Angular in the description when the title only says frontend', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: 'Angular developer experience with TypeScript.',
        technologies: [],
      }),
      search({ keywords: ['Angular Developer'] }),
    );

    expect(decision.keyword).toBe('pass');
    expect(decision.descriptionMatch).toBe('pass');
    expect(decision.matched).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('does not treat a missing description as a technology mismatch', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: null,
        technologies: [],
      }),
      search({
        keywords: ['Frontend Developer'],
        technologies: ['Angular'],
      }),
    );

    expect(decision.technology).toBe('unknown');
    expect(decision.reasons).not.toContain('keyword mismatch');
    expect(decision.matched).toBe(true);
  });

  it('rejects an unrelated physician listing for a software search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Aile Hekimliği Uzmanı Kat Hekimi',
          description: 'Aile sağlığı merkezi poliklinik hizmeti',
          technologies: [],
        }),
        search({
          keywords: [
            'Frontend Developer',
            'React Developer',
            'Angular Developer',
            'Software Developer',
            'QA / Test Uzmanı',
          ],
        }),
      ),
    ).toBe(false);
  });

  it('treats React and Angular keywords as alternatives, not a joint requirement', () => {
    const saved = search({
      keywords: ['React Developer', 'Angular Developer'],
    });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'React Developer',
          description: 'SPA with React only.',
          technologies: ['React'],
        }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-angular',
          title: 'Angular Developer',
          description: 'SPA with Angular only.',
          technologies: ['Angular'],
        }),
        saved,
      ),
    ).toBe(true);
  });

  it('accepts a Turkey-workable remote job for an İzmir city filter', () => {
    const locations = {
      getCachedSubdivisionNames: (code: string) =>
        code === 'TR' ? ['İstanbul', 'İzmir', 'Ankara'] : null,
    };
    const withAliases = new MatchingService(locations as never);
    const saved = search({
      keywords: ['Frontend Developer'],
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
    });

    expect(
      withAliases.jobMatchesSearch(
        job({
          title: 'Frontend Developer',
          location: 'Istanbul, Turkey',
          workModel: 'remote',
        }),
        saved,
      ),
    ).toBe(true);
    expect(
      withAliases.jobMatchesSearch(
        job({
          id: 'job-hybrid',
          title: 'Frontend Developer',
          location: 'İstanbul, Türkiye',
          workModel: 'hybrid',
        }),
        saved,
      ),
    ).toBe(false);
  });

  it('does not assume an unknown work model matches a remote filter', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        workModel: 'unknown',
      }),
      search({ keywords: ['Frontend Developer'], workTypes: ['remote'] }),
    );

    expect(decision.workModel).toBe('unknown');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('work model unknown');
  });

  it('does not match Makine Mühendisi because the company name contains GIDA', () => {
    const saved = search({
      name: 'Gıda mühendisi Kalite güvence',
      keywords: ['Gıda mühendisi Kalite güvence'],
    });
    const listing = job({
      title: 'Makine Mühendisi',
      companyName:
        'HEK-YOL İNŞAAT TAAHHÜT ÜRETİM MADENCİLİK PETROL OTOMOTİV NAKLİYAT TURİZM GIDA SAN VE TİC AŞ',
      description: 'Gıda tesisimizde bakım ve kalite güvence ekibiyle koordinasyon.',
      technologies: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);
    expect(decision.matched).toBe(false);
    expect(decision.keyword).toBe('fail');
  });

  it('does not match Elektrik Mühendisi at the same food-named company', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Elektrik Mühendisi',
          companyName:
            'HEK-YOL İNŞAAT TAAHHÜT ÜRETİM MADENCİLİK PETROL OTOMOTİV NAKLİYAT TURİZM GIDA SAN VE TİC AŞ',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['Gıda mühendisi', 'Kalite güvence'] }),
      ),
    ).toBe(false);
  });

  it('matches Gıda Mühendisi when the company name has no gıda token', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          companyName: 'Anadolu Üretim AŞ',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['Gıda mühendisi Kalite güvence'] }),
      ),
    ).toBe(true);
  });

  it('matches Kalite Güvence Uzmanı when duties require food engineering', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Kalite Güvence Uzmanı',
          companyName: 'Anadolu Üretim AŞ',
          description:
            'Gıda mühendisliği mezunu aranır. HACCP ve proses kalite güvence görevleri.',
          technologies: [],
        }),
        search({ keywords: ['Gıda mühendisi Kalite güvence'] }),
      ),
    ).toBe(true);
  });

  it('does not treat a software QA listing as food quality assurance via the company name', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Software QA Engineer',
          companyName:
            'HEK-YOL İNŞAAT TAAHHÜT ÜRETİM MADENCİLİK PETROL OTOMOTİV NAKLİYAT TURİZM GIDA SAN VE TİC AŞ',
          description: 'Gıda sektöründe faaliyet gösteren firmamızda test otomasyonu.',
          technologies: ['Playwright'],
        }),
        search({ keywords: ['Gıda mühendisi', 'Kalite güvence'] }),
      ),
    ).toBe(false);
  });

  it('does not use the saved search display name as a keyword', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Gıda Mühendisi',
          description: null,
          technologies: [],
        }),
        search({
          name: 'Gıda mühendisi Kalite güvence',
          keywords: ['Angular Developer'],
        }),
      ),
    ).toBe(false);
  });

  it('keeps React and Angular as alternative role matches', () => {
    const saved = search({ keywords: ['React Developer', 'Angular Developer'] });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'React Developer',
          description: 'SPA with React only.',
          technologies: ['React'],
        }),
        saved,
      ),
    ).toBe(true);
    expect(
      matcher.jobMatchesSearch(
        job({
          id: 'job-angular-desc',
          title: 'Frontend Developer',
          description: 'Angular developer experience with TypeScript.',
          technologies: [],
        }),
        saved,
      ),
    ).toBe(true);
  });
});

const eLearningDescription =
  'Design and develop e-learning content using Articulate Storyline, Rise and SCORM. Experience with UI/UX, responsive design and JavaScript integration is a plus.';

describe('MatchingService role vs skill evidence', () => {
  const eLearning = () =>
    job({
      title: 'E-Learning Content Developer',
      companyName: 'Maritime Trainer',
      description: eLearningDescription,
      technologies: [],
    });

  it('matches UI or JavaScript on e-learning content as a skill match with evidence', () => {
    const listing = eLearning();
    const ui = matcher.evaluateMatch(listing, search({ keywords: ['UI'] }));
    expect(ui.matched).toBe(true);
    expect(ui.matchKind).toBe('skill');
    expect(ui.evidence.some((item) => item.term === 'UI')).toBe(true);
    expect(ui.evidence.every((item) => item.field === 'description')).toBe(true);
    expect(ui.evidence[0]?.snippet?.includes('UI/UX')).toBe(true);

    const js = matcher.evaluateMatch(
      listing,
      search({ keywords: ['JavaScript'] }),
    );
    expect(js.matched).toBe(true);
    expect(js.matchKind).toBe('skill');
    expect(js.evidence[0]?.term).toBe('JavaScript');
    expect(js.evidence[0]?.snippet?.toLowerCase().includes('javascript')).toBe(
      true,
    );
  });

  it('does not infer a frontend match from UI/JS content when the keyword is only Frontend', () => {
    expect(
      matcher.jobMatchesSearch(eLearning(), search({ keywords: ['Frontend'] })),
    ).toBe(false);
  });

  it('matches a Frontend Developer title as a direct role match', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: null,
        technologies: [],
      }),
      search({ keywords: ['Frontend Developer'] }),
    );

    expect(decision.matched).toBe(true);
    expect(decision.matchKind).toBe('direct');
    expect(decision.evidence[0]?.field).toBe('title');
    expect(decision.evidence[0]?.kind).toBe('title');
  });

  it('shows UI as the real reason when the search is named Frontend and keywords are UI', () => {
    const decision = matcher.evaluateMatch(
      eLearning(),
      search({ name: 'Frontend', keywords: ['UI'] }),
    );

    expect(decision.matched).toBe(true);
    expect(decision.evidence.map((item) => item.term)).toEqual(['UI']);
    expect(decision.evidence.some((item) => item.term === 'Frontend')).toBe(
      false,
    );
  });

  it('does not match UI as a fragment inside another word', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Instructional Designer',
          description: 'Build guides for the product.',
          technologies: [],
        }),
        search({ keywords: ['UI'] }),
      ),
    ).toBe(false);
  });

  it('does not invent description evidence when the listing has no description', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'E-Learning Content Developer',
        description: null,
        technologies: [],
      }),
      search({ keywords: ['UI'] }),
    );

    expect(decision.matched).toBe(false);
    expect(decision.evidence).toEqual([]);
  });

  it('keeps location and work model filters after skill matching', () => {
    const listing = eLearning();
    expect(
      matcher.jobMatchesSearch(
        { ...listing, location: 'Berlin, Germany', workModel: 'onsite' },
        search({
          keywords: ['UI'],
          countryCode: 'TR',
          countryName: 'Türkiye',
          workTypes: ['remote'],
        }),
      ),
    ).toBe(false);
    expect(
      matcher.jobMatchesSearch(
        { ...listing, location: 'İzmir, Türkiye', workModel: 'remote' },
        search({
          keywords: ['JavaScript'],
          workTypes: ['remote'],
        }),
      ),
    ).toBe(true);
  });

  it('does not treat JavaScript in the title as a frontend role', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'JavaScript Developer',
          description: null,
          technologies: [],
        }),
        search({ keywords: ['Frontend'] }),
      ),
    ).toBe(false);
  });

  it('does not turn a generic developer title into a frontend match', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Developer',
          description: 'Uses Storyline and Rise.',
          technologies: [],
        }),
        search({ keywords: ['Frontend'] }),
      ),
    ).toBe(false);
  });

  it('still matches a JavaScript skill on a non-frontend engineering title', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Makine Mühendisi',
        description: 'Dashboard için JavaScript ile raporlama otomasyonu.',
        technologies: [],
      }),
      search({ keywords: ['JavaScript'] }),
    );

    expect(decision.matched).toBe(true);
    expect(decision.matchKind).toBe('skill');
    expect(decision.evidence[0]?.field).toBe('description');
  });
});
