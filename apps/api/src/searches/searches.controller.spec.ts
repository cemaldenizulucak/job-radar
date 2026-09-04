import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
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

const createBody = {
  name: 'angular',
  keywords: ['angular'],
  locations: ['izmir'],
  sources: ['linkedin', 'kariyer_net'],
  isActive: true,
};

function createController(options: {
  created?: SavedSearch;
  previous?: SavedSearch;
  updated?: SavedSearch;
}): {
  controller: SearchesController;
  discovery: { enqueueForSavedSearch: ReturnType<typeof vi.fn> };
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
    enqueueForSavedSearch: vi.fn().mockReturnValue({
      status: 'pending',
      jobsFetched: 0,
      matchesCreated: 0,
    }),
    getImmediateRun: vi.fn().mockReturnValue(null),
  };

  return {
    controller: new SearchesController(
      searches as unknown as SearchesService,
      discovery as unknown as DiscoveryService,
      {
        getByUserId: vi.fn().mockResolvedValue({
          userId: user.id,
          fullName: null,
          email: null,
          notificationsEnabled: true,
          timezone: null,
          country: null,
          city: null,
        }),
      } as never,
    ),
    discovery,
    searches,
  };
}

describe('SearchesController immediate discovery', () => {
  it('creates an active search and enqueues discovery for that search only', async () => {
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
    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledTimes(1);
    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledWith(created);
    expect(result).toEqual({
      search: expect.objectContaining({
        id: 'search-1',
        name: 'angular',
        discovery: {
          status: 'pending',
          jobsFetched: 0,
          matchesCreated: 0,
        },
      }),
      discovery: {
        status: 'pending',
        jobsFetched: 0,
        matchesCreated: 0,
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

    expect(discovery.enqueueForSavedSearch).not.toHaveBeenCalled();
    expect(result.discovery.status).toBe('skipped');
  });

  it('discovers when a search is activated', async () => {
    const previous = search({ isActive: false });
    const updated = search({ isActive: true });
    const { controller, discovery } = createController({ previous, updated });

    const result = await controller.toggle(user, 'search-1', { isActive: true });

    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledWith(updated);
    expect(result.discovery.status).toBe('pending');
  });

  it('discovers when keywords change', async () => {
    const previous = search();
    const updated = search({ keywords: ['react'] });
    const { controller, discovery } = createController({ previous, updated });

    await controller.update(user, 'search-1', {
      ...createBody,
      keywords: ['react'],
    });

    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledWith(updated);
  });

  it('discovers when location changes', async () => {
    const previous = search();
    const updated = search({ locations: ['istanbul'] });
    const { controller, discovery } = createController({ previous, updated });

    await controller.update(user, 'search-1', {
      ...createBody,
      locations: ['istanbul'],
    });

    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledWith(updated);
  });

  it('does not discover when only the name changes', async () => {
    const previous = search();
    const updated = search({ name: 'Angular jobs' });
    const { controller, discovery } = createController({ previous, updated });

    const result = await controller.update(user, 'search-1', {
      ...createBody,
      name: 'Angular jobs',
    });

    expect(discovery.enqueueForSavedSearch).not.toHaveBeenCalled();
    expect(result.discovery.status).toBe('skipped');
  });

  it('keeps the created search when discovery is only enqueued in the background', async () => {
    const created = search();
    const { controller, searches, discovery } = createController({
      created,
    });

    const result = await controller.create(user, createBody);

    expect(searches.createForUser).toHaveBeenCalled();
    expect(discovery.enqueueForSavedSearch).toHaveBeenCalledWith(created);
    expect(result.search.id).toBe('search-1');
    expect(result.discovery).toEqual({
      status: 'pending',
      jobsFetched: 0,
      matchesCreated: 0,
    });
  });
});
