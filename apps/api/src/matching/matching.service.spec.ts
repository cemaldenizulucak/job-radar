import { MATCH_SCORE_THRESHOLD, MatchingService } from './matching.service.js';
import type { MatchableJob } from './matching.types.js';
import type { SavedSearch } from '../searches/searches.types.js';

const matcher = new MatchingService();

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-frontend',
    userId: 'user-1',
    name: 'Frontend',
    isActive: true,
    keywords: ['frontend'],
    technologies: ['react'],
    locations: ['istanbul'],
    workTypes: ['remote'],
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

describe('MatchingService', () => {
  it('matches one listing to many saved searches', () => {
    const listing = job();
    const frontend = search({ id: 'search-frontend' });
    const reactRemote = search({
      id: 'search-react',
      name: 'React remote',
      keywords: ['engineer'],
      technologies: ['react'],
    });

    const matches = matcher.matchJobsToSearches([listing], [
      frontend,
      reactRemote,
    ]);

    expect(matches).toEqual([
      { jobId: 'job-1', savedSearchId: 'search-frontend' },
      { jobId: 'job-1', savedSearchId: 'search-react' },
    ]);
  });

  it('does not match when required criteria fail', () => {
    const listing = job({ description: null, technologies: ['Vue'] });
    const reactSearch = search();

    expect(matcher.jobMatchesSearch(listing, reactSearch)).toBe(false);
  });

  it('does not use inactive searches', () => {
    const listing = job();
    const inactive = search({ isActive: false });

    expect(matcher.jobMatchesSearch(listing, inactive)).toBe(false);
    expect(matcher.matchJobsToSearches([listing], [inactive])).toEqual([]);
  });

  it('does not match a listing from a source the search excluded', () => {
    const listing = job({ sourceId: 'kariyer_net' });
    const linkedInOnly = search({ sourceIds: ['linkedin'] });

    expect(matcher.jobMatchesSearch(listing, linkedInOnly)).toBe(false);
  });

  it('lets one listing match many searches when each search criteria pass', () => {
    const listing = job({
      title: 'Frontend Developer',
      technologies: ['React', 'Angular'],
    });
    const frontend = search({
      id: 'search-frontend',
      keywords: ['frontend'],
      technologies: [],
    });
    const angular = search({
      id: 'search-angular',
      name: 'Angular',
      keywords: ['frontend'],
      technologies: ['angular'],
    });

    expect(matcher.matchJobsToSearches([listing], [frontend, angular])).toEqual([
      { jobId: 'job-1', savedSearchId: 'search-frontend' },
      { jobId: 'job-1', savedSearchId: 'search-angular' },
    ]);
  });

  it('matches Frontend Developer to Front-End Geliştirici', () => {
    const listing = job({
      sourceId: 'kariyer_net',
      title: 'Front-End Geliştirici',
      description: null,
      location: 'İstanbul(Asya)',
      workModel: null,
      experienceLevel: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      locations: ['istanbul'],
      experienceLevels: ['mid'],
      workTypes: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('pass');
    expect(decision.location).toBe('pass');
    expect(decision.technology).toBe('unknown');
    expect(decision.experience).toBe('unknown');
    expect(decision.matched).toBe(true);
  });

  it('matches Frontend Developer to Arayüz Yazılım Uzmanı', () => {
    const listing = job({
      sourceId: 'kariyer_net',
      title: 'Arayüz Yazılım Uzmanı',
      description: null,
      location: 'İstanbul(Asya)',
      workModel: null,
      experienceLevel: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      locations: ['istanbul'],
      experienceLevels: ['mid'],
      workTypes: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('pass');
    expect(decision.threshold).toBe(MATCH_SCORE_THRESHOLD);
    expect(decision.threshold).toBe(50);
    expect(decision.score).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
    expect(decision.matched).toBe(true);
  });

  it('does not match Frontend Developer to Java Yazılım Uzmanı', () => {
    const listing = job({
      sourceId: 'kariyer_net',
      title: 'Java Yazılım Uzmanı',
      description: null,
      location: 'İstanbul',
      workModel: 'hybrid',
      experienceLevel: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      locations: ['istanbul'],
      experienceLevels: ['mid'],
      workTypes: [],
    });

    expect(matcher.jobMatchesSearch(listing, saved)).toBe(false);
    expect(matcher.evaluateMatch(listing, saved).keyword).toBe('fail');
  });

  it('does not match Frontend Developer to Full-Stack Java Developer', () => {
    const listing = job({
      sourceId: 'kariyer_net',
      title: 'Full-Stack Java Developer',
      description: null,
      location: 'İstanbul',
      workModel: null,
      experienceLevel: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      locations: ['istanbul'],
      experienceLevels: ['mid'],
      workTypes: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('fail');
    expect(decision.matched).toBe(false);
    expect(decision.threshold).toBe(MATCH_SCORE_THRESHOLD);
  });

  it('matches Full-Stack Java Developer when a frontend role term is present', () => {
    const listing = job({
      sourceId: 'kariyer_net',
      title: 'Full-Stack Java Developer',
      description: 'Looking for a frontend developer who also knows Java.',
      location: 'İstanbul',
      workModel: null,
      experienceLevel: null,
      technologies: [],
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: [],
      locations: ['istanbul'],
      experienceLevels: [],
      workTypes: [],
    });

    expect(matcher.jobMatchesSearch(listing, saved)).toBe(true);
  });

  it('matches Senior Frontend Engineer (React) to frontend developer + react', () => {
    const listing = job({
      title: 'Senior Frontend Engineer (React)',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      workTypes: [],
      experienceLevels: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('pass');
    expect(decision.keywordKind).toBe('alias');
    expect(decision.matched).toBe(true);
  });

  it('matches React Native Developer when the search includes React', () => {
    const listing = job({
      title: 'React Native Developer',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      workTypes: [],
      experienceLevels: [],
    });

    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('pass');
    expect(decision.keywordKind).toBe('related');
    expect(decision.matched).toBe(true);
  });

  it('does not match React Native Developer without React in the saved search', () => {
    const listing = job({
      title: 'React Native Developer',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });

    expect(matcher.evaluateMatch(listing, saved).keyword).toBe('fail');
    expect(matcher.jobMatchesSearch(listing, saved)).toBe(false);
  });

  it('does not match Java Developer or Python Developer to frontend developer + react', () => {
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      workTypes: [],
      experienceLevels: [],
    });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Java Developer',
          description: null,
          technologies: [],
          workModel: null,
        }),
        saved,
      ),
    ).toBe(false);
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Python Developer',
          description: null,
          technologies: [],
          workModel: null,
        }),
        saved,
      ),
    ).toBe(false);
  });

  it('scores Frontend Developer above Full Stack Developer (React)', () => {
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      workTypes: [],
      experienceLevels: [],
    });
    const frontend = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: 'React',
        technologies: [],
        workModel: null,
      }),
      saved,
    );
    const fullStack = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Full Stack Developer (React)',
        description: null,
        technologies: [],
        workModel: null,
      }),
      saved,
    );

    expect(frontend.matched).toBe(true);
    expect(fullStack.matched).toBe(true);
    expect(frontend.keywordKind).toBe('direct');
    expect(fullStack.keywordKind).toBe('related');
    expect(frontend.score).toBeGreaterThan(fullStack.score);
  });

  it('treats missing technologies as unknown instead of an automatic fail', () => {
    const listing = job({ technologies: [], description: null });
    const saved = search({ workTypes: [] });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(true);
    expect(decision.reasons).not.toContain('technology conflict');
  });

  it('matches a technology listed only in the job description', () => {
    const listing = job({
      technologies: [],
      description: 'React and TypeScript.',
    });
    const saved = search({ workTypes: [] });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('pass');
    expect(decision.descriptionMatch).toBe('pass');
    expect(decision.matched).toBe(true);
  });

  it('fails when the listing explicitly lists a conflicting technology', () => {
    const listing = job({ technologies: ['Angular'], description: null });
    const saved = search({ workTypes: [] });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('fail');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('technology conflict');
  });

  it('matches Istanbul to İstanbul(Asya)', () => {
    const listing = job({
      location: 'İstanbul(Asya)',
      workModel: null,
      technologies: [],
    });
    const saved = search({ workTypes: [], experienceLevels: [] });

    expect(matcher.evaluateMatch(listing, saved).location).toBe('pass');
    expect(matcher.jobMatchesSearch(listing, saved)).toBe(true);
  });

  it('matches Angular in the description of a Senior Frontend Developer', () => {
    const listing = job({
      title: 'Senior Frontend Developer',
      description: 'Angular 17, RxJS, TypeScript',
      technologies: [],
      workModel: null,
    });
    const saved = angularSearch();
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.searchTerms.some((term) => term.kind === 'technology')).toBe(
      true,
    );
    expect(decision.technology).toBe('pass');
    expect(decision.descriptionMatch).toBe('pass');
    expect(decision.matched).toBe(true);
  });

  it('matches Associate Frontend Developer when technologies include Angular', () => {
    const listing = job({
      title: 'Associate Frontend Developer',
      description: null,
      technologies: ['Angular'],
      workModel: null,
    });
    const saved = angularSearch();
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('pass');
    expect(decision.matched).toBe(true);
  });

  it('does not match a Java Developer with no Angular evidence', () => {
    const listing = job({
      title: 'Java Developer',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = angularSearch();
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.matched).toBe(false);
    expect(decision.keyword).toBe('fail');
  });

  it('may match a Frontend Developer when Angular evidence is unknown', () => {
    const listing = job({
      title: 'Frontend Developer',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = angularSearch();
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('unknown');
    expect(decision.keyword).toBe('pass');
    expect(decision.roleMatch).toBe('alias');
    expect(decision.matched).toBe(true);
    expect(decision.score).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
  });

  it('matches Frontend Developer with explicit Angular above unknown Angular', () => {
    const saved = angularSearch();
    const explicit = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: 'Angular 17, RxJS, TypeScript',
        technologies: [],
        workModel: null,
      }),
      saved,
    );
    const unknown = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Frontend Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      saved,
    );

    expect(explicit.matched).toBe(true);
    expect(explicit.technology).toBe('pass');
    expect(explicit.roleMatch).toBe('direct');
    expect(unknown.matched).toBe(true);
    expect(unknown.technology).toBe('unknown');
    expect(unknown.roleMatch).toBe('alias');
    expect(explicit.score).toBeGreaterThan(unknown.score);
  });

  it('does not match WEB YAZILIM UZMANI to Angular when technology is unknown', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'WEB YAZILIM UZMANI',
        description: null,
        technologies: [],
        workModel: null,
      }),
      angularSearch(),
    );

    expect(decision.roleFamily).toBe('software');
    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('generic role without technology evidence');
  });

  it('does not match Senior Web Application Developer to Angular when technology is unknown', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Senior Web Application Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      angularSearch(),
    );

    expect(decision.roleFamily).toBe('software');
    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('generic role without technology evidence');
  });

  it('matches Full Stack Developer with explicit Angular below a frontend Angular role', () => {
    const saved = angularSearch();
    const fullStack = matcher.evaluateMatch(
      job({
        title: 'Full Stack Developer',
        description: 'Angular and TypeScript',
        technologies: [],
        workModel: null,
      }),
      saved,
    );
    const frontend = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Frontend Developer',
        description: 'Angular and TypeScript',
        technologies: [],
        workModel: null,
      }),
      saved,
    );

    expect(fullStack.matched).toBe(true);
    expect(fullStack.roleFamily).toBe('fullstack');
    expect(fullStack.technology).toBe('pass');
    expect(frontend.matched).toBe(true);
    expect(fullStack.score).toBeLessThan(frontend.score);
  });

  it('does not match Full Stack Developer to Angular when technology is unknown', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Full Stack Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      angularSearch(),
    );

    expect(decision.roleFamily).toBe('fullstack');
    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('generic role without technology evidence');
  });

  it('matches Senior Frontend Engineer (React) for a React search', () => {
    const listing = job({
      title: 'Senior Frontend Engineer (React)',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['react'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.searchTerms[0]?.kind).toBe('technology');
    expect(decision.technology).toBe('pass');
    expect(decision.titleMatch).toBe('pass');
    expect(decision.matched).toBe(true);
  });

  it('scores frontend + Angular evidence above frontend with unknown technology', () => {
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['angular'],
      workTypes: [],
      experienceLevels: [],
    });
    const withAngular = matcher.evaluateMatch(
      job({
        title: 'Frontend Developer',
        description: 'Angular 17 and TypeScript',
        technologies: [],
        workModel: null,
      }),
      saved,
    );
    const unknownTech = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Frontend Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      saved,
    );

    expect(withAngular.matched).toBe(true);
    expect(unknownTech.matched).toBe(true);
    expect(withAngular.technology).toBe('pass');
    expect(unknownTech.technology).toBe('unknown');
    expect(withAngular.score).toBeGreaterThan(unknownTech.score);
  });

  it('does not automatically match an unrelated Java backend role that mentions Angular', () => {
    const listing = job({
      title: 'Java Backend Developer',
      description: 'Incidental mention of Angular in a Java service.',
      technologies: [],
      workModel: null,
    });
    const saved = angularSearch();
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.technology).toBe('pass');
    expect(decision.matched).toBe(false);
  });

  it('matches Senior Frontend Engineer (React) for frontend developer + React', () => {
    const listing = job({
      title: 'Senior Frontend Engineer (React)',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: ['react'],
      workTypes: [],
      experienceLevels: [],
    });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keywordKind).toBe('alias');
    expect(decision.technology).toBe('pass');
    expect(decision.matched).toBe(true);
  });

  it('matches Arayüz Yazılım Uzmanı to frontend developer', () => {
    const listing = job({
      title: 'Arayüz Yazılım Uzmanı',
      description: null,
      technologies: [],
      workModel: null,
    });
    const saved = search({
      keywords: ['frontend developer'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });
    const decision = matcher.evaluateMatch(listing, saved);

    expect(decision.keyword).toBe('pass');
    expect(decision.keywordKind).toBe('alias');
    expect(decision.matched).toBe(true);
  });

  it('matches React Native Developer to a React search as related, below a frontend React role', () => {
    const reactOnly = search({
      keywords: ['react'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });
    const native = matcher.evaluateMatch(
      job({
        title: 'React Native Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      reactOnly,
    );
    const frontend = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Senior Frontend Engineer (React)',
        description: null,
        technologies: [],
        workModel: null,
      }),
      reactOnly,
    );

    expect(native.matched).toBe(true);
    expect(native.roleMatch).toBe('related');
    expect(frontend.matched).toBe(true);
    expect(frontend.roleMatch).toBe('direct');
    expect(native.score).toBeLessThan(frontend.score);
  });

  it('does not match Java Developer to an Angular search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Java Developer',
          description: null,
          technologies: [],
          workModel: null,
        }),
        angularSearch(),
      ),
    ).toBe(false);
  });

  it('does not match Python Developer to a React search', () => {
    const reactOnly = search({
      keywords: ['react'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });

    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Python Developer',
          description: null,
          technologies: [],
          workModel: null,
        }),
        reactOnly,
      ),
    ).toBe(false);
  });

  it('matches Full Stack Developer (React) to a React search below a direct frontend role', () => {
    const reactOnly = search({
      keywords: ['react'],
      technologies: [],
      workTypes: [],
      experienceLevels: [],
    });
    const fullStack = matcher.evaluateMatch(
      job({
        title: 'Full Stack Developer (React)',
        description: null,
        technologies: [],
        workModel: null,
      }),
      reactOnly,
    );
    const frontend = matcher.evaluateMatch(
      job({
        id: 'job-2',
        title: 'Senior Frontend Developer',
        description: 'React',
        technologies: [],
        workModel: null,
      }),
      reactOnly,
    );

    expect(fullStack.matched).toBe(true);
    expect(fullStack.roleFamily).toBe('fullstack');
    expect(frontend.matched).toBe(true);
    expect(frontend.roleFamily).toBe('frontend');
    expect(fullStack.score).toBeLessThan(frontend.score);
  });

  it('does not match Full Stack Java to Angular when Angular is not in the listing', () => {
    const listing = job({
      title: 'Full Stack Java Developer (Banking)',
      description: null,
      technologies: [],
      workModel: null,
    });
    const decision = matcher.evaluateMatch(listing, angularSearch());

    expect(decision.roleFamily).toBe('fullstack');
    expect(decision.technology).toBe('fail');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('technology conflict');
  });

  it('does not match a React frontend title to an Angular-only search', () => {
    const decision = matcher.evaluateMatch(
      job({
        title: 'Senior Frontend Engineer (React)',
        description: null,
        technologies: [],
        workModel: null,
      }),
      angularSearch(),
    );

    expect(decision.roleFamily).toBe('frontend');
    expect(decision.technology).toBe('fail');
    expect(decision.matched).toBe(false);
  });

  it('does not match Java & Frontend Developers to an Angular-only search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Java & Frontend Developers',
          description: null,
          technologies: [],
          workModel: null,
        }),
        angularSearch(),
      ),
    ).toBe(false);
  });

  it('still matches a frontend title with unknown technology on Kariyer-style cards', () => {
    const decision = matcher.evaluateMatch(
      job({
        sourceId: 'kariyer_net',
        title: 'Senior Front-End Developer',
        description: null,
        technologies: [],
        workModel: null,
      }),
      angularSearch(),
    );

    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(true);
  });

  it('does not match a generic software title to Angular when technology is unknown', () => {
    const listing = job({
      title: 'Software Developer',
      description: null,
      technologies: [],
      workModel: null,
    });
    const decision = matcher.evaluateMatch(listing, angularSearch());

    expect(decision.roleFamily).toBe('software');
    expect(decision.technology).toBe('unknown');
    expect(decision.matched).toBe(false);
    expect(decision.reasons).toContain('generic role without technology evidence');
  });

  it('does not match unrelated specialist titles to an Angular search', () => {
    expect(
      matcher.jobMatchesSearch(
        job({
          title: 'Aile Hekimliği Uzmanı Kat Hekimi',
          description: null,
          technologies: [],
          workModel: null,
        }),
        angularSearch(),
      ),
    ).toBe(false);
  });
});

function angularSearch(): SavedSearch {
  return search({
    name: 'Angular Istanbul',
    keywords: ['angular'],
    technologies: [],
    locations: ['istanbul'],
    workTypes: [],
    experienceLevels: [],
  });
}
