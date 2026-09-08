import { DuplicateGroupsService } from '../duplicates/duplicate-groups.service.js';
import { DuplicatesService } from '../duplicates/duplicates.service.js';
import type { DuplicateGroup } from '../duplicates/duplicates.types.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { sourceListingIdentity } from '../jobs/job-identity.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { NormalizedJob } from '../jobs/jobs.types.js';
import { MatchingService } from '../matching/matching.service.js';
import type { JobSearchMatch } from '../matching/matching.types.js';
import { SearchesService } from '../searches/searches.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { buildDiscoveryNotificationDrafts } from '../notifications/discovery-notification.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { SavedSearch } from '../searches/searches.types.js';
import type { JobSourceAdapter, SourceSearchQuery } from '../sources/job-source.adapter.js';
import { KariyerNetSourceAdapter } from '../sources/adapters/kariyer-net-source.adapter.js';
import { LinkedInSourceAdapter } from '../sources/adapters/linkedin-source.adapter.js';
import { KariyerNetMockProvider } from '../sources/kariyer-net/kariyer-net-mock.provider.js';
import { createKariyerNetProvider } from '../sources/kariyer-net/kariyer-net-provider.factory.js';
import { LinkedInDisabledProvider } from '../sources/linkedin/linkedin-disabled.provider.js';
import { LinkedInMockProvider } from '../sources/linkedin/linkedin-mock.provider.js';
import { SourceUnavailableError } from '../sources/source-errors.js';
import { SourceRegistry } from '../sources/source-registry.js';
import { LocationsService } from '../locations/locations.service.js';
import { DiscoveryService } from './discovery.service.js';
import { EMPTY_DISCOVERY_SUMMARY } from './discovery.types.js';

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'Frontend',
    isActive: true,
    keywords: ['frontend', 'react'],
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

class FakeSearchesService extends SearchesService {
  readonly discoveredAt = new Map<string, string>();

  constructor(private readonly active: SavedSearch[]) {
    super(Object.create(SupabaseService.prototype) as SupabaseService);
  }

  override getActiveSearches(): Promise<SavedSearch[]> {
    return Promise.resolve(this.active);
  }

  override markDiscoveredAt(
    searchIds: readonly string[],
    discoveredAt: Date | string = new Date(),
  ): Promise<void> {
    const iso =
      discoveredAt instanceof Date ? discoveredAt.toISOString() : discoveredAt;
    for (const id of searchIds) {
      this.discoveredAt.set(id, iso);
    }
    return Promise.resolve();
  }
}

class FakeJobsService extends JobsService {
  readonly listings = new Map<string, { id: string; job: NormalizedJob }>();
  readonly matches: JobSearchMatch[] = [];

  constructor() {
    super(
      Object.create(SupabaseService.prototype) as SupabaseService,
      { get: () => undefined } as never,
    );
  }

  override upsertNormalized(
    job: NormalizedJob,
  ): Promise<{ id: string; inserted: boolean }> {
    const key = sourceListingIdentity(job.sourceId, job.sourceJobId);
    const existing = this.listings.get(key);

    if (existing) {
      existing.job = job;
      return Promise.resolve({ id: existing.id, inserted: false });
    }

    const id = key;
    this.listings.set(key, { id, job });
    return Promise.resolve({ id, inserted: true });
  }

  override listDuplicateCandidates() {
    return Promise.resolve(
      [...this.listings.values()].map(({ id, job }) => ({
        id,
        sourceId: job.sourceId,
        title: job.title,
        companyName: job.companyName,
        canonicalUrl: job.canonicalUrl,
      })),
    );
  }

  override saveMatches(matches: readonly JobSearchMatch[]): Promise<JobSearchMatch[]> {
    const created: JobSearchMatch[] = [];

    for (const match of matches) {
      const exists = this.matches.some(
        (item) =>
          item.jobId === match.jobId &&
          item.savedSearchId === match.savedSearchId,
      );
      if (exists) {
        continue;
      }

      this.matches.push(match);
      created.push(match);
    }

    return Promise.resolve(created);
  }

  override syncMatchesForSearches(
    searchIds: readonly string[],
    matches: readonly JobSearchMatch[],
  ): Promise<JobSearchMatch[]> {
    const allowed = new Set(searchIds);
    const desired = matches.filter((match) => allowed.has(match.savedSearchId));
    const desiredKeys = new Set(
      desired.map((match) => `${match.jobId}:${match.savedSearchId}`),
    );
    const kept = this.matches.filter(
      (match) =>
        !allowed.has(match.savedSearchId) ||
        desiredKeys.has(`${match.jobId}:${match.savedSearchId}`),
    );
    this.matches.length = 0;
    this.matches.push(...kept);
    return this.saveMatches(desired);
  }

  override markInactiveNotSeenSince(): Promise<number> {
    return Promise.resolve(0);
  }

  override listMatchableActiveJobs() {
    return Promise.resolve(
      [...this.listings.values()].map(({ id, job }) => ({
        id,
        sourceId: job.sourceId,
        title: job.title,
        companyName: job.companyName,
        description: job.description,
        location: job.location,
        workModel: job.workModel,
        experienceLevel: job.experienceLevel,
        technologies: job.technologies,
      })),
    );
  }

  override listMatchesForSearches(
    searchIds: readonly string[],
  ): Promise<JobSearchMatch[]> {
    const allowed = new Set(searchIds);
    return Promise.resolve(
      this.matches.filter((match) => allowed.has(match.savedSearchId)),
    );
  }
}

class FakeDuplicateGroupsService extends DuplicateGroupsService {
  readonly groups: DuplicateGroup[] = [];

  constructor() {
    super(Object.create(SupabaseService.prototype) as SupabaseService);
  }

  override saveGroups(groups: readonly DuplicateGroup[]): Promise<number> {
    let created = 0;

    for (const group of groups) {
      const exists = this.groups.some((existing) =>
        sameMembers(existing.memberIds, group.memberIds),
      );
      if (exists) {
        continue;
      }

      this.groups.push(group);
      created += 1;
    }

    return Promise.resolve(created);
  }
}

class FakeProfilesService extends ProfilesService {
  constructor(
    private readonly locationsByUser = new Map<
      string,
      { country: string | null; city: string | null }
    >(),
  ) {
    super(Object.create(SupabaseService.prototype) as SupabaseService);
  }

  override getByUserId(userId: string) {
    const location = this.locationsByUser.get(userId) ?? {
      country: null,
      city: null,
    };

    return Promise.resolve({
      userId,
      fullName: null,
      email: null,
      notificationsEnabled: true,
      timezone: null,
      country: location.country,
      city: location.city,
    });
  }

  override getLocationsByUserIds(userIds: readonly string[]) {
    const locations = new Map(
      userIds.map((userId) => [
        userId,
        this.locationsByUser.get(userId) ?? { country: null, city: null },
      ]),
    );

    return Promise.resolve(locations);
  }
}

class FakeNotificationsService extends NotificationsService {
  createdCount = 0;
  calls = 0;
  lastInput: Parameters<NotificationsService['createForNewMatches']>[0] | null =
    null;

  constructor() {
    super(Object.create(SupabaseService.prototype) as SupabaseService);
  }

  override createForNewMatches(
    input: Parameters<NotificationsService['createForNewMatches']>[0],
  ): Promise<number> {
    this.calls += 1;
    this.lastInput = input;
    const created = buildDiscoveryNotificationDrafts(input).length;
    this.createdCount += created;
    return Promise.resolve(created);
  }
}

function sameMembers(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function createDiscovery(
  searches: SavedSearch[],
  adapters?: JobSourceAdapter[],
  jobs = new FakeJobsService(),
  groups = new FakeDuplicateGroupsService(),
  notifications = new FakeNotificationsService(),
  profiles = new FakeProfilesService(),
): {
  discovery: DiscoveryService;
  jobs: FakeJobsService;
  groups: FakeDuplicateGroupsService;
  notifications: FakeNotificationsService;
  searches: FakeSearchesService;
} {
  const searchesService = new FakeSearchesService(searches);
  const locations = {
    primeSubdivisionCaches: vi.fn().mockResolvedValue(undefined),
    getCachedSubdivisionNames: vi.fn().mockReturnValue(null),
    getCountryName: (code: string) => (code === 'TR' ? 'Türkiye' : null),
    getSubdivisionName: (country: string | null, subdivision: string | null) => {
      const plate = subdivision?.padStart(2, '0') ?? '';
      if (country !== 'TR') {
        return null;
      }
      if (plate === '35') {
        return 'İzmir';
      }
      if (plate === '34') {
        return 'İstanbul';
      }
      return null;
    },
  } as unknown as LocationsService;
  const discovery = new DiscoveryService(
    searchesService,
    new SourceRegistry(
      adapters ?? [
        new LinkedInSourceAdapter(new LinkedInMockProvider()),
        new KariyerNetSourceAdapter(new KariyerNetMockProvider()),
      ],
    ),
    new MatchingService(locations),
    new DuplicatesService(),
    groups,
    jobs,
    notifications,
    profiles,
    { get: () => undefined } as never,
    locations,
  );

  return { discovery, jobs, groups, notifications, searches: searchesService };
}

describe('DiscoveryService', () => {
  it('runs the mock pipeline without deleting or merging source listings', async () => {
    const { discovery, jobs, groups } = createDiscovery([search()]);

    const result = await discovery.run();

    expect(result).toEqual({
      usersProcessed: 1,
      searchesProcessed: 1,
      jobsFetched: 6,
      jobsInserted: 6,
      matchesCreated: 4,
      duplicateGroupsCreated: 1,
      notificationsCreated: 1,
      kariyerNetPagesFetched: 1,
      kariyerNetJobsCollected: 3,
      stopReason: null,
      sourceAttempts: 2,
      sourceFailures: 0,
      sourcePartials: 0,
      catalogJobsChecked: 0,
      rawProviderJobs: 6,
      normalizedJobs: 6,
      notifiedJobCount: 4,
    });
    expect(jobs.listings.size).toBe(6);
    expect(
      jobs.listings.has(sourceListingIdentity('linkedin', 'li-abc-frontend')),
    ).toBe(true);
    expect(
      jobs.listings.has(sourceListingIdentity('kariyer_net', 'kn-abc-frontend')),
    ).toBe(true);
    expect(groups.groups[0]?.memberIds).toEqual(
      expect.arrayContaining([
        'linkedin:li-abc-frontend',
        'kariyer_net:kn-abc-frontend',
      ]),
    );
  });

  it('does not ingest the same source listing twice', async () => {
    const jobs = new FakeJobsService();
    const groups = new FakeDuplicateGroupsService();
    const notifications = new FakeNotificationsService();
    const { discovery } = createDiscovery(
      [search()],
      undefined,
      jobs,
      groups,
      notifications,
    );

    await discovery.run();
    expect(notifications.calls).toBe(1);

    const second = await discovery.run();

    expect(second.jobsInserted).toBe(0);
    expect(second.matchesCreated).toBe(0);
    expect(second.duplicateGroupsCreated).toBe(0);
    expect(second.notificationsCreated).toBe(0);
    expect(notifications.calls).toBe(1);
    expect(jobs.listings.size).toBe(6);
  });

  it('does not fail discovery when push notification delivery throws', async () => {
    class ThrowingNotificationsService extends FakeNotificationsService {
      override createForNewMatches(): Promise<number> {
        return Promise.reject(new Error('DeviceNotRegistered'));
      }
    }

    const notifications = new ThrowingNotificationsService();
    const { discovery, jobs } = createDiscovery(
      [search()],
      undefined,
      new FakeJobsService(),
      new FakeDuplicateGroupsService(),
      notifications,
    );

    await expect(discovery.run()).resolves.toMatchObject({
      jobsInserted: 6,
      matchesCreated: 4,
      notificationsCreated: 0,
    });
    expect(jobs.listings.size).toBe(6);
  });

  it('isolates a failing adapter so the other source still stores jobs', async () => {
    const linkedIn: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: true,
        supportsExperienceLevel: true,
      },
      isEnabled: () => true,
      search: async () => {
        throw new SourceUnavailableError('linkedin', 'source unavailable');
      },
    };
    const { discovery, jobs } = createDiscovery(
      [search()],
      [linkedIn, new KariyerNetSourceAdapter(new KariyerNetMockProvider())],
    );

    const result = await discovery.run();

    expect(result.jobsInserted).toBe(3);
    expect(jobs.listings.size).toBe(3);
    expect(
      [...jobs.listings.keys()].every((key) => key.startsWith('kariyer_net:')),
    ).toBe(true);
  });

  it('keeps Kariyer.net jobs when pagination is blocked after a successful page', async () => {
    const kariyer: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'kariyer_net',
        pagesFetched: 1,
        jobsCollected: 4,
        stopReason: 'blocked_after_success',
        jobs: [1, 2, 3, 4].map((index) => ({
          sourceJobId: `kn-page1-${index}`,
          canonicalUrl: `https://www.kariyer.net/is-ilani/page1-${index}`,
          title: `Frontend Developer ${index}`,
          companyName: 'Ornek Teknoloji',
          location: 'Istanbul',
        })),
      }),
    };
    const { discovery, jobs } = createDiscovery(
      [search({ sourceIds: ['kariyer_net'] })],
      [kariyer],
    );

    const result = await discovery.run();

    expect(result.jobsFetched).toBe(4);
    expect(result.jobsInserted).toBe(4);
    expect(result.kariyerNetPagesFetched).toBe(1);
    expect(result.kariyerNetJobsCollected).toBe(4);
    expect(result.stopReason).toBe('blocked_after_success');
    expect(result.sourceAttempts).toBe(1);
    expect(result.sourceFailures).toBe(0);
    expect(result.sourcePartials).toBe(1);
    expect(jobs.listings.size).toBe(4);
  });

  it('skips disabled LinkedIn without aborting discovery', async () => {
    const { discovery, jobs } = createDiscovery(
      [search()],
      [
        new LinkedInSourceAdapter(new LinkedInDisabledProvider()),
        new KariyerNetSourceAdapter(new KariyerNetMockProvider()),
      ],
    );

    const result = await discovery.run();

    expect(result.jobsFetched).toBe(3);
    expect(result.jobsInserted).toBe(3);
    expect(result.kariyerNetPagesFetched).toBe(1);
    expect(result.kariyerNetJobsCollected).toBe(3);
    expect(result.stopReason).toBeNull();
    expect(
      [...jobs.listings.keys()].every((key) => key.startsWith('kariyer_net:')),
    ).toBe(true);
    expect(
      [...jobs.listings.keys()].some((key) => key.startsWith('linkedin:')),
    ).toBe(false);
  });

  it('continues LinkedIn discovery when Kariyer.net live mode has no provider', async () => {
    const { discovery, jobs } = createDiscovery(
      [search()],
      [
        new LinkedInSourceAdapter(new LinkedInMockProvider()),
        new KariyerNetSourceAdapter(createKariyerNetProvider('live')),
      ],
    );

    const result = await discovery.run();

    expect(result.jobsInserted).toBe(3);
    expect(
      [...jobs.listings.keys()].every((key) => key.startsWith('linkedin:')),
    ).toBe(true);
  });

  it('does not insert a second Kariyer.net row for the same source + external id', async () => {
    const jobs = new FakeJobsService();
    const { discovery } = createDiscovery(
      [search({ sourceIds: ['kariyer_net'] })],
      [new KariyerNetSourceAdapter(new KariyerNetMockProvider())],
      jobs,
    );

    const first = await discovery.run();
    const second = await discovery.run();

    expect(first.jobsInserted).toBe(3);
    expect(second.jobsInserted).toBe(0);
    expect(jobs.listings.size).toBe(3);
    expect(
      jobs.listings.has(sourceListingIdentity('kariyer_net', 'kn-abc-frontend')),
    ).toBe(true);
  });

  it('does not call adapters when there are no active searches', async () => {
    const searchFn = vi.fn();
    const linkedIn: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: true,
        supportsExperienceLevel: true,
      },
      isEnabled: () => true,
      search: searchFn,
    };
    const { discovery } = createDiscovery([], [linkedIn]);

    await expect(discovery.run()).resolves.toEqual({
      ...EMPTY_DISCOVERY_SUMMARY,
    });
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('notifies only newly created visible matches, not raw provider volume', async () => {
    const foodJobs = Array.from({ length: 12 }, (_, index) => ({
      sourceJobId: `food-${index}`,
      canonicalUrl: `https://www.kariyer.net/is-ilani/food-${index}`,
      title: 'Gıda Mühendisi',
      companyName: 'Gıda AŞ',
      location: 'İzmir',
    }));
    const otherJobs = Array.from({ length: 78 }, (_, index) => ({
      sourceJobId: `sales-${index}`,
      canonicalUrl: `https://www.kariyer.net/is-ilani/sales-${index}`,
      title: 'Satış Temsilcisi',
      companyName: 'Satış AŞ',
      location: 'Ankara',
    }));
    const closedFood = {
      sourceJobId: 'food-closed',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/food-closed',
      title: 'Gıda Mühendisi',
      companyName: 'Eski Gıda',
      location: 'İzmir',
      availability: 'closed' as const,
    };
    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'kariyer_net',
        jobs: [...foodJobs, ...otherJobs, closedFood],
        jobsCollected: 91,
      }),
    };
    const notifications = new FakeNotificationsService();
    const { discovery, jobs } = createDiscovery(
      [
        search({
          keywords: ['gıda'],
          technologies: [],
          sourceIds: ['kariyer_net'],
        }),
      ],
      [adapter],
      new FakeJobsService(),
      new FakeDuplicateGroupsService(),
      notifications,
    );

    const result = await discovery.run();
    const drafts = buildDiscoveryNotificationDrafts(notifications.lastInput!);

    expect(result.rawProviderJobs).toBe(91);
    expect(result.normalizedJobs).toBe(91);
    expect(result.matchesCreated).toBe(13);
    expect(result.notifiedJobCount).toBe(12);
    expect(result.notificationsCreated).toBe(1);
    expect(drafts[0]?.title).toBe('12 yeni ilan bulundu');
    expect(drafts[0]?.newJobCount).toBe(12);
    expect(drafts[0]?.savedSearchId).toBe('search-1');
    expect(jobs.matches).toHaveLength(13);

    const second = await discovery.run();
    expect(second.matchesCreated).toBe(0);
    expect(second.notifiedJobCount).toBe(0);
    expect(second.notificationsCreated).toBe(0);
  }, 15_000);

  it('can create job_search_matches for an already stored listing', async () => {
    const existing: NormalizedJob = {
      sourceId: 'kariyer_net',
      sourceJobId: 'kn-existing-frontend',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/existing-frontend',
      title: 'Front-End Geliştirici',
      companyName: 'Ornek Teknoloji',
      titleNormalized: 'front end gelistirici',
      companyNormalized: 'ornek teknoloji',
      description: null,
      location: 'İstanbul(Asya)',
      workModel: null,
      experienceLevel: null,
      technologies: [],
      publishedAt: null,
      isActive: true,
    };
    const jobs = new FakeJobsService();
    jobs.listings.set(sourceListingIdentity(existing.sourceId, existing.sourceJobId), {
      id: 'existing-job-id',
      job: existing,
    });

    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'kariyer_net',
        jobs: [
          {
            sourceJobId: existing.sourceJobId,
            canonicalUrl: existing.canonicalUrl,
            title: existing.title,
            companyName: existing.companyName,
            location: existing.location ?? undefined,
            technologies: [],
          },
        ],
      }),
    };

    const { discovery } = createDiscovery(
      [
        search({
          keywords: ['frontend developer'],
          technologies: ['react'],
          locations: ['istanbul'],
          experienceLevels: ['mid'],
          sourceIds: ['kariyer_net'],
        }),
      ],
      [adapter],
      jobs,
    );

    const result = await discovery.run();

    expect(result.jobsInserted).toBe(0);
    expect(result.matchesCreated).toBe(1);
    expect(result.notificationsCreated).toBe(1);
    expect(jobs.matches).toEqual([
      { jobId: 'existing-job-id', savedSearchId: 'search-1' },
    ]);

    const second = await discovery.run();
    expect(second.matchesCreated).toBe(0);
    expect(second.notificationsCreated).toBe(0);
  });

  it('discards jobs confidently older than 30 days and keeps unknown publishedAt', async () => {
    const now = Date.now();
    const oldPublishedAt = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recentPublishedAt = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'kariyer_net',
        jobs: [
          {
            sourceJobId: 'old-java',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/old-java',
            title: 'Java Developer',
            companyName: 'Old Co',
            publishedAt: oldPublishedAt,
          },
          {
            sourceJobId: 'recent-frontend',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/recent-frontend',
            title: 'Frontend Developer',
            companyName: 'Recent Co',
            location: 'Istanbul',
            publishedAt: recentPublishedAt,
          },
          {
            sourceJobId: 'unknown-date',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/unknown-date',
            title: 'Frontend Developer',
            companyName: 'Unknown Co',
            location: 'Istanbul',
          },
        ],
      }),
    };

    const { discovery, jobs } = createDiscovery(
      [search({ sourceIds: ['kariyer_net'] })],
      [adapter],
    );

    const result = await discovery.run();

    expect(result.jobsInserted).toBe(2);
    expect(
      [...jobs.listings.keys()].sort(),
    ).toEqual([
      'kariyer_net:recent-frontend',
      'kariyer_net:unknown-date',
    ]);
  });

  it('runForSavedSearch fetches only that search even when others are active', async () => {
    const queries: string[] = [];
    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async (query) => {
        queries.push(query.savedSearchId ?? '');
        return {
          sourceId: 'kariyer_net',
          jobs: [
            {
              sourceJobId: 'kn-angular-1',
              canonicalUrl: 'https://www.kariyer.net/is-ilani/angular-1',
              title: 'Angular Developer',
              companyName: 'Izmir Co',
              location: 'Izmir',
            },
          ],
        };
      },
    };
    const target = search({
      id: 'search-angular',
      keywords: ['angular'],
      locations: ['izmir'],
      sourceIds: ['kariyer_net'],
    });
    const other = search({
      id: 'search-java',
      keywords: ['java'],
      locations: ['istanbul'],
      sourceIds: ['kariyer_net'],
    });
    const { discovery } = createDiscovery([target, other], [adapter]);

    const result = await discovery.runForSavedSearch(target);

    expect(queries).toEqual(['search-angular']);
    expect(result.searchesProcessed).toBe(1);
    expect(result.jobsInserted).toBe(1);
    expect(result.sourceAttempts).toBe(1);
  });

  it('runForSavedSearch does not fetch when the search is inactive', async () => {
    const searchFn = vi.fn();
    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: searchFn,
    };
    const { discovery } = createDiscovery(
      [search({ isActive: false, sourceIds: ['kariyer_net'] })],
      [adapter],
    );

    const result = await discovery.runForSavedSearch(
      search({ isActive: false, sourceIds: ['kariyer_net'] }),
    );

    expect(searchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ...EMPTY_DISCOVERY_SUMMARY });
  });

  it('coalesces overlapping runForSavedSearch calls for the same search', async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => {
        calls += 1;
        await started;
        return {
          sourceId: 'kariyer_net',
          jobs: [
            {
              sourceJobId: 'kn-one',
              canonicalUrl: 'https://www.kariyer.net/is-ilani/one',
              title: 'Frontend Developer',
              companyName: 'Co',
              location: 'Izmir',
            },
          ],
        };
      },
    };
    const target = search({ sourceIds: ['kariyer_net'] });
    const { discovery } = createDiscovery([target], [adapter]);

    const first = discovery.runForSavedSearch(target);
    const second = discovery.runForSavedSearch(target);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(firstResult).toEqual(secondResult);
    expect(firstResult.jobsInserted).toBe(1);
  });

  it('run and runForSavedSearch share upsert, match, and duplicate handling', async () => {
    const target = search();
    const jobs = new FakeJobsService();
    const groups = new FakeDuplicateGroupsService();
    const { discovery } = createDiscovery([target], undefined, jobs, groups);

    const immediate = await discovery.runForSavedSearch(target);
    const scheduled = await discovery.run();

    expect(immediate.jobsInserted).toBeGreaterThan(0);
    expect(immediate.matchesCreated).toBeGreaterThan(0);
    expect(scheduled.jobsInserted).toBe(0);
    expect(scheduled.matchesCreated).toBe(0);
    expect(jobs.listings.size).toBe(immediate.jobsInserted);
    expect(groups.groups).toHaveLength(immediate.duplicateGroupsCreated);
  });

  it('does not mark stale listings during a search-scoped run', async () => {
    const jobs = new FakeJobsService();
    const markStale = vi.spyOn(jobs, 'markInactiveNotSeenSince');
    const target = search({ sourceIds: ['kariyer_net'] });
    const { discovery } = createDiscovery(
      [target],
      [new KariyerNetSourceAdapter(new KariyerNetMockProvider())],
      jobs,
    );

    await discovery.runForSavedSearch(target);

    expect(markStale).not.toHaveBeenCalled();
  });

  it('still runs when the user has no profile location', async () => {
    const { discovery, jobs } = createDiscovery([search()]);

    const result = await discovery.run();

    expect(result.searchesProcessed).toBe(1);
    expect(result.jobsFetched).toBeGreaterThan(0);
    expect(jobs.listings.size).toBeGreaterThan(0);
  });

  it('does not send profile location to adapters when the search location is empty', async () => {
    const received: SourceSearchQuery[] = [];
    const capture = (sourceId: 'linkedin' | 'kariyer_net'): JobSourceAdapter => ({
      sourceId,
      displayName: sourceId,
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async (query) => {
        received.push(query);
        return { sourceId, jobs: [] };
      },
    });

    const { discovery } = createDiscovery(
      [
        search({
          keywords: ['Frontend Developer'],
          locations: [],
          sourceIds: ['linkedin', 'kariyer_net'],
        }),
      ],
      [capture('linkedin'), capture('kariyer_net')],
      undefined,
      undefined,
      undefined,
      new FakeProfilesService(
        new Map([['user-1', { country: 'Turkey', city: 'Izmir' }]]),
      ),
    );

    await discovery.run();

    expect(received).toHaveLength(2);
    expect(received[0]?.locations).toEqual([]);
    expect(received[1]?.locations).toEqual([]);
    expect(received[0]?.workModels).toEqual([]);
    expect(received[1]?.workModels).toEqual([]);
    expect(received[0]?.keywords).toEqual(['Frontend Developer']);
  });

  it('does not send stored work types to adapters and still sends location', async () => {
    const received: SourceSearchQuery[] = [];
    const capture: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: true,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async (query) => {
        received.push(query);
        return { sourceId: 'linkedin', jobs: [] };
      },
    };

    const { discovery } = createDiscovery(
      [
        search({
          keywords: ['Frontend Developer'],
          countryCode: 'TR',
          countryName: 'Türkiye',
          subdivisionCode: '35',
          subdivisionName: 'İzmir',
          workTypes: ['remote'],
          sourceIds: ['linkedin'],
        }),
      ],
      [capture],
    );

    await discovery.run();

    expect(received).toHaveLength(1);
    expect(received[0]?.workModels).toEqual([]);
    expect(received[0]?.locations).toEqual(['Türkiye']);
    expect(received[0]?.keywords).toEqual(['Frontend Developer']);
  });

  it('includes every user active search in a scheduled run', async () => {
    const userA = search({
      id: 'search-a',
      userId: 'user-a',
      name: 'User A Frontend',
      keywords: ['frontend'],
    });
    const userB = search({
      id: 'search-b',
      userId: 'user-b',
      name: 'User B Frontend',
      keywords: ['frontend'],
    });
    const { discovery, jobs } = createDiscovery([userA, userB]);

    const result = await discovery.run();

    expect(result.usersProcessed).toBe(2);
    expect(result.searchesProcessed).toBe(2);
    expect(result.matchesCreated).toBeGreaterThan(0);
    expect(
      jobs.matches.some(
        (match) => match.savedSearchId === 'search-a',
      ),
    ).toBe(true);
    expect(
      jobs.matches.some(
        (match) => match.savedSearchId === 'search-b',
      ),
    ).toBe(true);
  });

  it('matches a new user search against jobs already in the catalog', async () => {
    const jobs = new FakeJobsService();
    await jobs.upsertNormalized({
      sourceId: 'linkedin',
      sourceJobId: 'existing-frontend',
      title: 'Frontend Developer',
      companyName: 'Catalog Co',
      titleNormalized: 'frontend developer',
      companyNormalized: 'catalog co',
      location: 'Ankara',
      workModel: 'onsite',
      experienceLevel: 'mid',
      technologies: [],
      description: 'React',
      canonicalUrl: 'https://example.com/frontend',
      publishedAt: null,
      isActive: true,
    });

    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };

    const { discovery } = createDiscovery(
      [
        search({
          id: 'search-new',
          userId: 'user-b',
          name: 'Frontend Developer',
          keywords: ['Frontend Developer'],
          locations: [],
          workTypes: ['remote'],
          experienceLevels: [],
          sourceIds: ['linkedin'],
        }),
      ],
      [emptyAdapter],
      jobs,
    );

    const result = await discovery.runForSavedSearch(
      search({
        id: 'search-new',
        userId: 'user-b',
        name: 'Frontend Developer',
        keywords: ['Frontend Developer'],
        locations: [],
        workTypes: ['remote'],
        experienceLevels: [],
        sourceIds: ['linkedin'],
      }),
    );

    expect(result.jobsFetched).toBe(0);
    expect(result.catalogJobsChecked).toBe(1);
    expect(result.matchesCreated).toBe(1);
    expect(jobs.matches).toEqual([
      {
        jobId: sourceListingIdentity('linkedin', 'existing-frontend'),
        savedSearchId: 'search-new',
      },
    ]);
  });

  it('matches a new bilgisayar search against catalog jobs before the next crawl', async () => {
    const jobs = new FakeJobsService();
    await jobs.upsertNormalized({
      sourceId: 'linkedin',
      sourceJobId: 'existing-computer',
      title: 'Bilgisayar Mühendisi',
      companyName: 'Catalog Co',
      titleNormalized: 'bilgisayar muhendisi',
      companyNormalized: 'catalog co',
      location: 'Ankara',
      workModel: 'onsite',
      experienceLevel: 'mid',
      technologies: [],
      description: 'Donanım ve yazılım',
      canonicalUrl: 'https://example.com/bilgisayar',
      publishedAt: null,
      isActive: true,
    });

    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };

    const target = search({
      id: 'search-bilgisayar',
      keywords: ['bilgisayar'],
      locations: [],
      sourceIds: ['linkedin'],
    });
    const { discovery } = createDiscovery([target], [emptyAdapter], jobs);

    const result = await discovery.runForSavedSearch(target);

    expect(result.jobsFetched).toBe(0);
    expect(result.catalogJobsChecked).toBe(1);
    expect(result.matchesCreated).toBe(1);
    expect(jobs.matches).toEqual([
      {
        jobId: sourceListingIdentity('linkedin', 'existing-computer'),
        savedSearchId: 'search-bilgisayar',
      },
    ]);
  });

  it('does not mix User A and User B matches when rematching the catalog', async () => {
    const jobs = new FakeJobsService();
    await jobs.upsertNormalized({
      sourceId: 'linkedin',
      sourceJobId: 'shared-computer',
      title: 'Bilgisayar Mühendisi',
      companyName: 'Catalog Co',
      titleNormalized: 'bilgisayar muhendisi',
      companyNormalized: 'catalog co',
      location: 'Ankara',
      workModel: 'onsite',
      experienceLevel: 'mid',
      technologies: [],
      description: 'Donanım',
      canonicalUrl: 'https://example.com/shared-computer',
      publishedAt: null,
      isActive: true,
    });

    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };

    const userA = search({
      id: 'search-a',
      userId: 'user-a',
      keywords: ['bilgisayar'],
      locations: [],
      sourceIds: ['linkedin'],
    });
    const userB = search({
      id: 'search-b',
      userId: 'user-b',
      keywords: ['bilgisayar'],
      locations: [],
      sourceIds: ['linkedin'],
    });
    const { discovery } = createDiscovery(
      [userA, userB],
      [emptyAdapter],
      jobs,
    );

    await discovery.runForSavedSearch(userA);

    expect(jobs.matches).toEqual([
      {
        jobId: sourceListingIdentity('linkedin', 'shared-computer'),
        savedSearchId: 'search-a',
      },
    ]);
    expect(
      jobs.matches.some((match) => match.savedSearchId === 'search-b'),
    ).toBe(false);
  });

  it('matches catalog jobs even when live discovery returns unrelated listings', async () => {
    const jobs = new FakeJobsService();
    await jobs.upsertNormalized({
      sourceId: 'linkedin',
      sourceJobId: 'catalog-computer',
      title: 'Bilgisayar Öğretmeni',
      companyName: 'Catalog Co',
      titleNormalized: 'bilgisayar ogretmeni',
      companyNormalized: 'catalog co',
      location: 'Van',
      workModel: 'onsite',
      experienceLevel: null,
      technologies: [],
      description: null,
      canonicalUrl: 'https://example.com/catalog-computer',
      publishedAt: null,
      isActive: true,
    });

    const adapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'linkedin',
        jobs: [
          {
            sourceJobId: 'live-computer',
            canonicalUrl: 'https://example.com/live-computer',
            title: 'Bilgisayar Teknikeri',
            companyName: 'Live Co',
            location: 'Berlin',
          },
        ],
      }),
    };

    const target = search({
      id: 'search-bilgisayar',
      keywords: ['bilgisayar'],
      locations: [],
      countryName: null,
      sourceIds: ['linkedin'],
    });
    const { discovery } = createDiscovery([target], [adapter], jobs);

    const result = await discovery.runForSavedSearch(target);

    expect(result.catalogJobsChecked).toBeGreaterThanOrEqual(1);
    expect(result.matchesCreated).toBe(2);
    expect(jobs.matches.map((match) => match.jobId).sort()).toEqual(
      [
        sourceListingIdentity('linkedin', 'catalog-computer'),
        sourceListingIdentity('linkedin', 'live-computer'),
      ].sort(),
    );
  });

  it('enqueues background discovery and marks the run pending until it finishes', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => {
        await gate;
        return { sourceId: 'linkedin', jobs: [] };
      },
    };
    const target = search({ sourceIds: ['linkedin'] });
    const { discovery } = createDiscovery([target], [adapter]);

    const queued = discovery.enqueueForSavedSearch(target);

    expect(queued.status).toBe('pending');
    expect(discovery.getImmediateRun(target.id)?.status).toBe('pending');

    release();
    await vi.waitFor(() => {
      expect(discovery.getImmediateRun(target.id)?.status).toBe('completed');
    });
  });

  it('marks immediate discovery partial when pagination loops after the first page', async () => {
    const adapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({
        sourceId: 'linkedin',
        pagesFetched: 1,
        jobsCollected: 2,
        stopReason: 'pagination_loop',
        jobs: [
          {
            sourceJobId: 'li-loop-1',
            canonicalUrl: 'https://www.linkedin.com/jobs/view/1',
            title: 'Frontend Developer',
            companyName: 'Example',
            location: 'İzmir',
          },
        ],
      }),
    };
    const target = search({ sourceIds: ['linkedin'] });
    const { discovery } = createDiscovery([target], [adapter]);

    discovery.enqueueForSavedSearch(target);

    await vi.waitFor(() => {
      expect(discovery.getImmediateRun(target.id)?.status).toBe('partial');
    });
    expect(discovery.getImmediateRun(target.id)?.jobsFetched).toBe(1);
  });

  it('keeps a failed background discovery status without deleting the search', async () => {
    const adapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => {
        throw new Error('linkedin unavailable');
      },
    };
    const target = search({ sourceIds: ['linkedin'] });
    const { discovery } = createDiscovery([target], [adapter]);

    discovery.enqueueForSavedSearch(target);

    await vi.waitFor(() => {
      expect(discovery.getImmediateRun(target.id)?.status).toBe('failed');
    });
  });

  it('rejects out-of-city catalog jobs for an İzmir search and drops stale matches', async () => {
    const jobs = new FakeJobsService();
    const kahramanmaras = {
      sourceId: 'linkedin' as const,
      sourceJobId: 'gida-kahramanmaras',
      canonicalUrl: 'https://example.com/kahramanmaras',
      title: 'Gıda Mühendisi',
      companyName: 'Gıda Co',
      titleNormalized: 'gida muhendisi',
      companyNormalized: 'gida co',
      location: 'Kahramanmaraş',
      workModel: 'onsite' as const,
      experienceLevel: 'mid',
      technologies: [],
      description: 'kalite güvence',
      publishedAt: null,
      isActive: true,
    };
    const istanbul = {
      ...kahramanmaras,
      sourceJobId: 'gida-istanbul',
      canonicalUrl: 'https://example.com/istanbul',
      location: 'İstanbul(Asya)',
    };
    const izmir = {
      ...kahramanmaras,
      sourceJobId: 'gida-izmir',
      canonicalUrl: 'https://example.com/izmir',
      location: 'İzmir',
    };

    await jobs.upsertNormalized(kahramanmaras);
    await jobs.upsertNormalized(istanbul);
    await jobs.upsertNormalized(izmir);
    jobs.matches.push({
      jobId: sourceListingIdentity('linkedin', 'gida-kahramanmaras'),
      savedSearchId: 'search-izmir',
    });

    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };
    const target = search({
      id: 'search-izmir',
      keywords: ['Gıda Mühendisi, kalite güvence'],
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCode: '35',
      subdivisionName: 'İzmir',
      locations: ['İzmir', 'İzmir, Türkiye'],
      sourceIds: ['linkedin'],
    });
    const { discovery, searches } = createDiscovery(
      [target],
      [emptyAdapter],
      jobs,
    );

    await discovery.runForSavedSearch(target);

    expect(jobs.matches).toEqual([
      {
        jobId: sourceListingIdentity('linkedin', 'gida-izmir'),
        savedSearchId: 'search-izmir',
      },
    ]);
    expect(searches.discoveredAt.get('search-izmir')).toEqual(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });

  it('drops a previously stored match that only held because of the company name', async () => {
    const jobs = new FakeJobsService();
    const machine = {
      sourceId: 'kariyer_net' as const,
      sourceJobId: 'hekyol-makine',
      canonicalUrl: 'https://example.com/makine',
      title: 'Makine Mühendisi',
      companyName:
        'HEK-YOL İNŞAAT TAAHHÜT ÜRETİM MADENCİLİK PETROL OTOMOTİV NAKLİYAT TURİZM GIDA SAN VE TİC AŞ',
      titleNormalized: 'makine muhendisi',
      companyNormalized: 'hek yol gida',
      location: 'İzmir',
      workModel: 'onsite' as const,
      experienceLevel: 'mid',
      technologies: [] as string[],
      description: 'Gıda tesisinde bakım. Kalite güvence ekibiyle koordinasyon.',
      publishedAt: null,
      isActive: true,
    };
    await jobs.upsertNormalized(machine);
    jobs.matches.push({
      jobId: sourceListingIdentity('kariyer_net', 'hekyol-makine'),
      savedSearchId: 'search-gida',
    });

    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Kariyer.net',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'kariyer_net', jobs: [] }),
    };
    const target = search({
      id: 'search-gida',
      name: 'Gıda mühendisi Kalite güvence',
      keywords: ['Gıda mühendisi Kalite güvence'],
      sourceIds: ['kariyer_net'],
    });
    const { discovery } = createDiscovery([target], [emptyAdapter], jobs);

    await discovery.runForSavedSearch(target);

    expect(jobs.listings.size).toBe(1);
    expect(jobs.matches).toEqual([]);
  });

  it('updates lastDiscoveryAt after targeted discovery completes', async () => {
    const target = search({ id: 'search-new', sourceIds: ['linkedin'] });
    const { discovery, searches } = createDiscovery(
      [target],
      [
        {
          sourceId: 'linkedin',
          displayName: 'LinkedIn',
          capabilities: {
            supportsKeywordSearch: true,
            supportsLocation: true,
            supportsRemoteFilter: false,
            supportsExperienceLevel: false,
          },
          isEnabled: () => true,
          search: async () => ({ sourceId: 'linkedin', jobs: [] }),
        },
      ],
    );

    await discovery.runForSavedSearch(target);

    expect(searches.discoveredAt.get('search-new')).toBeTruthy();
    expect(discovery.getImmediateRun('search-new')).toBeNull();
  });

  it('fetches LinkedIn with the keyword and country, then matches the listing', async () => {
    const received: SourceSearchQuery[] = [];
    const linkedin: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async (query) => {
        received.push(query);
        return {
          sourceId: 'linkedin',
          jobs: [
            {
              sourceJobId: 'li-gida-1',
              canonicalUrl: 'https://www.linkedin.com/jobs/view/gida-1',
              title: 'Gıda Mühendisi',
              companyName: 'Gıda Co',
              location: 'İzmir',
            },
          ],
        };
      },
    };
    const target = search({
      id: 'search-gida',
      keywords: ['Gıda Mühendisi'],
      technologies: [],
      countryCode: 'TR',
      countryName: 'Türkiye',
      subdivisionCodes: ['35', '34'],
      subdivisionNames: ['İzmir', 'İstanbul'],
      sourceIds: ['linkedin'],
    });
    const { discovery, jobs } = createDiscovery([target], [linkedin]);

    const result = await discovery.runForSavedSearch(target);

    expect(received[0]?.keywords).toEqual([
      'Gıda Mühendisi',
      'Gıda Mühendisliği',
    ]);
    expect(received[0]?.locations).toEqual(['Türkiye']);
    expect(result.matchesCreated).toBe(1);
    expect(jobs.matches).toEqual([
      {
        jobId: sourceListingIdentity('linkedin', 'li-gida-1'),
        savedSearchId: 'search-gida',
      },
    ]);
  });

  it('previews stale match removal without deleting listings, then applies', async () => {
    const jobs = new FakeJobsService();
    const listing = {
      sourceId: 'linkedin' as const,
      sourceJobId: '4461124795',
      title: 'E-Learning Content Developer',
      companyName: 'Maritime Trainer',
      titleNormalized: 'e-learning content developer',
      companyNormalized: 'maritime trainer',
      location: 'Remote',
      workModel: 'remote' as const,
      experienceLevel: null,
      technologies: [],
      description:
        'Develop Storyline, Rise and SCORM courses. Experience with UI/UX, responsive design and JavaScript integration.',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/4461124795',
      publishedAt: null,
      isActive: true,
    };
    const upserted = await jobs.upsertNormalized(listing);
    jobs.matches.push({
      jobId: upserted.id,
      savedSearchId: 'search-frontend',
    });
    const emptyAdapter: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: {
        supportsKeywordSearch: true,
        supportsLocation: true,
        supportsRemoteFilter: false,
        supportsExperienceLevel: false,
      },
      isEnabled: () => true,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };
    const { discovery } = createDiscovery(
      [
        search({
          id: 'search-frontend',
          name: 'Frontend',
          keywords: ['Frontend'],
        }),
      ],
      [emptyAdapter],
      jobs,
    );

    const preview = await discovery.rematchStoredMatches();
    expect(preview.dryRun).toBe(true);
    expect(preview.deleteCount).toBe(1);
    expect(preview.insertCount).toBe(0);
    expect(jobs.matches).toHaveLength(1);
    expect(jobs.listings.size).toBe(1);

    const applied = await discovery.rematchStoredMatches({ dryRun: false });
    expect(applied.dryRun).toBe(false);
    expect(applied.deleteCount).toBe(1);
    expect(jobs.matches).toEqual([]);
    expect(jobs.listings.size).toBe(1);
  });
});
