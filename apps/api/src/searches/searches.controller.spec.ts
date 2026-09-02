import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import {
  EMPTY_DISCOVERY_SUMMARY,
  type DiscoveryRunSummary,
} from '../discovery/discovery.types.js';
import { SearchesController } from './searches.controller.js';
import { SearchesService } from './searches.service.js';
import type { SavedSearch } from './searches.types.js';

const user: AuthenticatedUser = { id: 'user-1', email: 'user@example.com' };

function search(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    userId: 'user-1',
    name: 'angular',
    isActive: true,
    keywords: ['angular'],
    technologies: [],
    locations: ['izmir'],
    workTypes: [],
    experienceLevels: [],
    sourceIds: ['linkedin', 'kariyer_net'],
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  };
}

const createBody = {
  name: 'angular',
  keywords: ['angular'],
  locations: ['izmir'],
  sources: ['linkedin', 'kariyer_net'],
  isActive: true,
};

function completedSummary(
  overrides: Partial<DiscoveryRunSummary> = {},
): DiscoveryRunSummary {
  return {
    ...EMPTY_DISCOVERY_SUMMARY,
    searchesProcessed: 1,
    jobsFetched: 4,
    jobsInserted: 4,
    matchesCreated: 3,
    sourceAttempts: 2,
    sourceFailures: 0,
    ...overrides,
  };
}

function createController(options: {
  created?: SavedSearch;
  previous?: SavedSearch;
  updated?: SavedSearch;
  discovery?: DiscoveryRunSummary | Error;
}): {
  controller: SearchesController;
  discovery: { runForSavedSearch: ReturnType<typeof vi.fn> };
  searches: {
    createForUser: ReturnType<typeof vi.fn>;
    getByIdForUser: ReturnType<typeof vi.fn>;
    updateForUser: ReturnType<typeof vi.fn>;
    toggleActiveForUser: ReturnType<typeof vi.fn>;
  };
} {
  const created = options.created ?? search();
  const searches = {
    createForUser: vi.fn().mockResolvedValue(created),
    getByIdForUser: vi.fn().mockResolvedValue(options.previous ?? created),
    updateForUser: vi.fn().mockResolvedValue(options.updated ?? created),
    toggleActiveForUser: vi.fn().mockResolvedValue(options.updated ?? created),
  };
  const discovery = {
    runForSavedSearch:
      options.discovery instanceof Error
        ? vi.fn().mockRejectedValue(options.discovery)
        : vi.fn().mockResolvedValue(options.discovery ?? completedSummary()),
  };

  return {
    controller: new SearchesController(
      searches as unknown as SearchesService,
      discovery as unknown as DiscoveryService,
    ),
    discovery,
    searches,
  };
}

describe('SearchesController immediate discovery', () => {
  it('creates an active search and discovers only that search', async () => {
    const created = search();
    const { controller, discovery, searches } = createController({ created });

    const result = await controller.create(user, createBody);

    expect(searches.createForUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'angular',
        keywords: ['angular'],
        locations: ['izmir'],
      }),
    );
    expect(discovery.runForSavedSearch).toHaveBeenCalledTimes(1);
    expect(discovery.runForSavedSearch).toHaveBeenCalledWith(created);
    expect(result).toEqual({
      search: expect.objectContaining({ id: 'search-1', name: 'angular' }),
      discovery: {
        status: 'completed',
        jobsFetched: 4,
        matchesCreated: 3,
      },
    });
  });

  it('does not discover when the created search is inactive', async () => {
    const { controller, discovery } = createController({
      created: search({ isActive: false }),
    });

    const result = await controller.create(user, {
      ...createBody,
      isActive: false,
    });

    expect(discovery.runForSavedSearch).not.toHaveBeenCalled();
    expect(result.discovery.status).toBe('skipped');
  });

  it('discovers when a search is activated', async () => {
    const previous = search({ isActive: false });
    const updated = search({ isActive: true });
    const { controller, discovery } = createController({ previous, updated });

    const result = await controller.toggle(user, 'search-1', { isActive: true });

    expect(discovery.runForSavedSearch).toHaveBeenCalledWith(updated);
    expect(result.discovery.status).toBe('completed');
  });

  it('discovers when keywords change', async () => {
    const previous = search();
    const updated = search({ keywords: ['react'] });
    const { controller, discovery } = createController({ previous, updated });

    await controller.update(user, 'search-1', {
      ...createBody,
      keywords: ['react'],
    });

    expect(discovery.runForSavedSearch).toHaveBeenCalledWith(updated);
  });

  it('discovers when location changes', async () => {
    const previous = search();
    const updated = search({ locations: ['istanbul'] });
    const { controller, discovery } = createController({ previous, updated });

    await controller.update(user, 'search-1', {
      ...createBody,
      locations: ['istanbul'],
    });

    expect(discovery.runForSavedSearch).toHaveBeenCalledWith(updated);
  });

  it('does not discover when only the name changes', async () => {
    const previous = search();
    const updated = search({ name: 'Angular jobs' });
    const { controller, discovery } = createController({ previous, updated });

    const result = await controller.update(user, 'search-1', {
      ...createBody,
      name: 'Angular jobs',
    });

    expect(discovery.runForSavedSearch).not.toHaveBeenCalled();
    expect(result.discovery.status).toBe('skipped');
  });

  it('keeps the created search when a source fails during discovery', async () => {
    const created = search();
    const { controller, searches } = createController({
      created,
      discovery: new Error('linkedin unavailable'),
    });

    const result = await controller.create(user, createBody);

    expect(searches.createForUser).toHaveBeenCalled();
    expect(result.search.id).toBe('search-1');
    expect(result.discovery).toEqual({
      status: 'failed',
      jobsFetched: 0,
      matchesCreated: 0,
    });
  });

  it('reports partial discovery when some sources fail', async () => {
    const { controller } = createController({
      discovery: completedSummary({
        sourceAttempts: 2,
        sourceFailures: 1,
        jobsFetched: 3,
        matchesCreated: 2,
      }),
    });

    const result = await controller.create(user, createBody);

    expect(result.discovery).toEqual({
      status: 'partial',
      jobsFetched: 3,
      matchesCreated: 2,
    });
  });
});
