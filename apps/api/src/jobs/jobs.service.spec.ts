import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { MatchingService } from '../matching/matching.service.js';
import { JobsService } from './jobs.service.js';
import type { NormalizedJob } from './jobs.types.js';

function job(
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob {
  return {
    sourceId: 'linkedin',
    sourceJobId: 'li-abc-frontend',
    canonicalUrl: 'https://linkedin.example/abc-frontend',
    title: 'Frontend Developer',
    companyName: 'ABC Technology',
    titleNormalized: 'frontend developer',
    companyNormalized: 'abc technology',
    description: 'React',
    location: 'Istanbul',
    workModel: 'hybrid',
    experienceLevel: 'mid',
    technologies: ['React'],
    publishedAt: null,
    isActive: true,
    ...overrides,
  };
}

function resolvedQuery(result: { data: unknown; error: unknown }) {
  const resultPromise = Promise.resolve(result);
  const query: {
    select: () => typeof query;
    eq: () => typeof query;
    in: () => typeof query;
    maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    then: typeof resultPromise.then;
  } = {
    select: () => query,
    eq: () => query,
    in: () => query,
    maybeSingle: () => resultPromise,
    then: resultPromise.then.bind(resultPromise),
  };
  return query;
}

function createDetailService(options: {
  job: Record<string, unknown>;
  matchStatus: string;
  search: Record<string, unknown>;
}): JobsService {
  const from = vi.fn((table: string) => {
    if (table === 'jobs') {
      return resolvedQuery({ data: [options.job], error: null });
    }

    if (table === 'job_search_matches') {
      return resolvedQuery({
        data: [
          {
            job_id: options.job.id,
            saved_search_id: options.search.id,
            matched_at: '2026-01-01T00:00:00.000Z',
            match_status: options.matchStatus,
          },
        ],
        error: null,
      });
    }

    if (table === 'saved_searches') {
      return resolvedQuery({ data: [options.search], error: null });
    }

    if (table === 'favorites' || table === 'applications') {
      return resolvedQuery({ data: null, error: null });
    }

    return resolvedQuery({ data: [], error: null });
  });

  return new JobsService(
    {
      getClient: () => ({ from }),
    } as unknown as SupabaseService,
    { get: () => undefined } as never,
    new MatchingService(),
  );
}

function chainableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  return query;
}

function createService(store: Map<string, string>): {
  service: JobsService;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const insert = vi.fn((row: { id: string; source: string; source_job_id: string }) => {
    store.set(`${row.source}:${row.source_job_id}`, row.id);
    return Promise.resolve({ error: null });
  });
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const from = vi.fn(() => ({
    select: () => ({
      eq: (column: string, value: string) => ({
        eq: (column2: string, value2: string) => ({
          maybeSingle: async () => {
            const key =
              column === 'source'
                ? `${value}:${value2}`
                : `${value2}:${value}`;
            const id = store.get(key);
            return { data: id ? { id } : null, error: null };
          },
        }),
      }),
    }),
    insert,
    update,
  }));

  const service = new JobsService(
    {
      getClient: () => ({ from }),
    } as unknown as SupabaseService,
    { get: () => undefined } as never,
  );

  return { service, insert, update };
}

describe('JobsService source identity', () => {
  it('does not insert a second row for the same source + source_job_id', async () => {
    const store = new Map<string, string>();
    const { service, insert, update } = createService(store);
    const listing = job();

    const first = await service.upsertNormalized(listing);
    const second = await service.upsertNormalized(listing);

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        is_active: true,
        last_seen_at: expect.any(String),
      }),
    );
    expect(update).toHaveBeenCalledOnce();
  });

  it('stores LinkedIn and Kariyer.net listings as two rows even when the role matches', async () => {
    const store = new Map<string, string>();
    const { service, insert } = createService(store);

    const linkedIn = await service.upsertNormalized(job());
    const kariyer = await service.upsertNormalized(
      job({
        sourceId: 'kariyer_net',
        sourceJobId: 'kn-abc-frontend',
        canonicalUrl: 'https://kariyer.example/abc-frontend',
      }),
    );

    expect(linkedIn.id).not.toBe(kariyer.id);
    expect(linkedIn.inserted).toBe(true);
    expect(kariyer.inserted).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
  });
});

describe('JobsService listForUser', () => {
  const jobRow = {
    id: 'job-1',
    source: 'linkedin',
    title: 'Frontend Developer',
    company: 'ABC Technology',
    location: 'Istanbul',
    work_model: 'hybrid',
    published_at: null,
    discovered_at: '2026-09-01T12:00:00.000Z',
    created_at: '2026-09-01T12:00:00.000Z',
    original_url: 'https://linkedin.example/abc-frontend',
    source_job_id: 'li-abc-frontend',
    duplicate_group_id: null,
    technologies: ['React'],
    description: 'React role',
    experience_level: 'mid',
  };

  it('returns rows from public.jobs without requiring matches', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({ userId: 'user-1' });

    expect(from).toHaveBeenCalledWith('jobs');
    expect(jobsQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(jobsQuery.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^published_at\.is\.null,published_at\.gte\."\d{4}-\d{2}-\d{2}T/,
      ),
    );
    expect(jobsQuery.order).toHaveBeenNthCalledWith(1, 'published_at', {
      ascending: false,
      nullsFirst: false,
    });
    expect(jobsQuery.order).toHaveBeenNthCalledWith(2, 'discovered_at', {
      ascending: false,
    });
    expect(jobsQuery.order).not.toHaveBeenCalledWith(
      'match_score',
      expect.anything(),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'job-1',
        sourceId: 'linkedin',
        companyName: 'ABC Technology',
        isSeen: false,
        isMatched: false,
        isFavorite: false,
      }),
    ]);
  });

  it('attaches favorite state in bulk for the authenticated user', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'favorites') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              expect(column).toBe('user_id');
              expect(value).toBe('user-1');
              return Promise.resolve({
                data: [{ job_id: 'job-1' }],
                error: null,
              });
            },
          }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({ userId: 'user-1' });

    expect(from).toHaveBeenCalledWith('favorites');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'job-1',
        isFavorite: true,
      }),
    ]);
  });

  it('returns only jobs matched to the authenticated user when matchedOnly is true', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-1']);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'job-1',
        matchedSearchIds: ['search-1'],
        isMatched: true,
      }),
    ]);
  });

  it('returns a newly matched job from GET /v1/jobs?matchedOnly=true', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-02T18:00:00.000Z',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      limit: 200,
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-1']);
    expect(jobsQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(result.items.map((item) => item.id)).toEqual(['job-1']);
  });

  it('returns an empty feed when matchedOnly is true and the user has no matches', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
    });

    expect(from).not.toHaveBeenCalledWith('jobs');
    expect(result.items).toEqual([]);
  });

  it('does not return another user matches when matchedOnly is true', async () => {
    const jobsQuery = chainableQuery({
      data: [{ ...jobRow, id: 'job-a' }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-a' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-a',
                  saved_search_id: 'search-a',
                  matched_at: '2026-09-01T12:00:00.000Z',
                },
                {
                  job_id: 'job-b',
                  saved_search_id: 'search-b',
                  matched_at: '2026-09-01T12:00:00.000Z',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({
            data: [],
            error: null,
          });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-a',
      matchedOnly: true,
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-a']);
    expect(result.items.map((item) => item.id)).toEqual(['job-a']);
    expect(result.items[0]?.matchedSearchIds).toEqual(['search-a']);
  });

  it('does not filter is_active when includeInactive is true', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    await service.listForUser({ userId: 'user-1', includeInactive: true });

    expect(jobsQuery.eq).not.toHaveBeenCalledWith('is_active', true);
    expect(jobsQuery.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^published_at\.is\.null,published_at\.gte\."\d{4}-\d{2}-\d{2}T/,
      ),
    );
  });

  it('returns only job_search_matches for the selected savedSearchId', async () => {
    const izmirJob = { ...jobRow, id: 'job-izmir', location: 'İzmir' };
    const otherJob = { ...jobRow, id: 'job-kahramanmaras', location: 'Kahramanmaraş' };
    const jobsQuery = chainableQuery({ data: [izmirJob], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  { id: 'search-izmir', last_discovered_at: '2026-09-04T11:30:00.000Z' },
                  { id: 'search-other', last_discovered_at: '2026-09-04T08:00:00.000Z' },
                ],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-izmir',
                  saved_search_id: 'search-izmir',
                  matched_at: '2026-09-04T11:30:00.000Z',
                },
                {
                  job_id: 'job-kahramanmaras',
                  saved_search_id: 'search-other',
                  matched_at: '2026-09-04T08:00:00.000Z',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, {
            eq: () => result,
            in: () => result,
          });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      savedSearchId: 'search-izmir',
      matchedOnly: true,
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-izmir']);
    expect(result.items.map((item) => item.id)).toEqual(['job-izmir']);
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.savedSearchCounts).toEqual(
      expect.arrayContaining([
        { id: 'search-izmir', count: 1 },
        { id: 'search-other', count: 1 },
      ]),
    );
    expect(result.lastDiscoveryAt).toBe('2026-09-04T11:30:00.000Z');
  });

  it('does not return another user matches for a savedSearchId filter', async () => {
    const jobsQuery = chainableQuery({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-a' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-b',
                  saved_search_id: 'search-b',
                  matched_at: '2026-09-01T12:00:00.000Z',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-a',
      savedSearchId: 'search-b',
      matchedOnly: true,
    });

    expect(result.items).toEqual([]);
    expect(from).not.toHaveBeenCalledWith('jobs');
  });

  it('returns only verified matches when matchStatus=verified', async () => {
    const verifiedRow = { ...jobRow, id: 'job-verified' };
    const unverifiedRow = {
      ...jobRow,
      id: 'job-unverified',
      source: 'kariyer_net',
      original_url: 'https://kariyer.example/unverified',
      source_job_id: 'kn-unverified',
    };
    const jobsQuery = chainableQuery({ data: [verifiedRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }, { id: 'search-2' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-verified',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
                {
                  job_id: 'job-unverified',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'unverified_source_candidate',
                },
                {
                  job_id: 'job-verified',
                  saved_search_id: 'search-2',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'verified',
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-verified']);
    expect(result.items.map((item) => item.id)).toEqual(['job-verified']);
    expect(result.verifiedMatchCount).toBe(1);
    expect(result.unverifiedMatchCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('returns only unverified source candidates when matchStatus=unverified_source_candidate', async () => {
    const unverifiedRow = {
      ...jobRow,
      id: 'job-unverified',
      source: 'kariyer_net',
      original_url: 'https://kariyer.example/unverified',
      source_job_id: 'kn-unverified',
    };
    const jobsQuery = chainableQuery({ data: [unverifiedRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-verified',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
                {
                  job_id: 'job-unverified',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'unverified_source_candidate',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'unverified_source_candidate',
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-unverified']);
    expect(result.items.map((item) => item.id)).toEqual(['job-unverified']);
    expect(result.items[0]?.matchStatus).toBe('unverified_source_candidate');
    expect(result.verifiedMatchCount).toBe(1);
    expect(result.unverifiedMatchCount).toBe(1);
  });

  it('counts a job once when it matches multiple saved searches', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }, { id: 'search-2' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-2',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'verified',
    });

    expect(jobsQuery.in).toHaveBeenCalledWith('id', ['job-1']);
    expect(result.verifiedMatchCount).toBe(1);
    expect(result.unverifiedMatchCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  it('treats a mixed verified and unverified job as verified only', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }, { id: 'search-2' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-2',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'unverified_source_candidate',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const verified = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'verified',
    });
    const possible = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'unverified_source_candidate',
    });

    expect(verified.verifiedMatchCount).toBe(1);
    expect(verified.unverifiedMatchCount).toBe(0);
    expect(verified.items.map((item) => item.id)).toEqual(['job-1']);
    expect(possible.items).toEqual([]);
  });

  it('moves a previously unverified job into the verified tab after it is upgraded', async () => {
    const jobsQuery = chainableQuery({ data: [jobRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const verified = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'verified',
    });
    const possible = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'unverified_source_candidate',
    });

    expect(verified.items.map((item) => item.id)).toEqual(['job-1']);
    expect(possible.items).toEqual([]);
    expect(verified.verifiedMatchCount).toBe(1);
    expect(verified.unverifiedMatchCount).toBe(0);
  });

  it('keeps source filtering inside a matchStatus tab', async () => {
    const kariyerRow = {
      ...jobRow,
      id: 'job-kn',
      source: 'kariyer_net',
      original_url: 'https://kariyer.example/kn',
      source_job_id: 'kn-1',
    };
    const jobsQuery = chainableQuery({ data: [kariyerRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return jobsQuery;
      }

      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-1' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-1',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
                {
                  job_id: 'job-kn',
                  saved_search_id: 'search-1',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'verified',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-1',
      matchedOnly: true,
      matchStatus: 'verified',
      sourceId: 'kariyer_net',
    });

    expect(jobsQuery.eq).toHaveBeenCalledWith('source', 'kariyer_net');
    expect(jobsQuery.in.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(['job-1', 'job-kn']),
    );
    expect(result.verifiedMatchCount).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(['job-kn']);
  });

  it('does not include another user match counts in matchStatus tabs', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'saved_searches') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: 'search-a' }],
                error: null,
              }),
          }),
        };
      }

      if (table === 'job_search_matches') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  job_id: 'job-b',
                  saved_search_id: 'search-b',
                  matched_at: '2026-09-01T12:00:00.000Z',
                  match_status: 'unverified_source_candidate',
                },
              ],
              error: null,
            }),
        };
      }

      return {
        select: () => {
          const result = Promise.resolve({ data: [], error: null });
          return Object.assign(result, { eq: () => result, in: () => result });
        },
      };
    });

    const service = new JobsService(
      {
        getClient: () => ({ from }),
      } as unknown as SupabaseService,
      { get: () => undefined } as never,
    );

    const result = await service.listForUser({
      userId: 'user-a',
      matchedOnly: true,
      matchStatus: 'unverified_source_candidate',
    });

    expect(result.items).toEqual([]);
    expect(result.verifiedMatchCount).toBe(0);
    expect(result.unverifiedMatchCount).toBe(0);
    expect(from).not.toHaveBeenCalledWith('jobs');
  });
});

describe('JobsService getByIdForUser match evidence', () => {
  const qualityJob = {
    id: 'job-quality',
    source: 'kariyer_net',
    title: 'Kalite Mühendisi',
    company: 'Gıda A.Ş.',
    location: 'Manisa',
    work_model: 'onsite',
    published_at: null,
    discovered_at: '2026-09-01T12:00:00.000Z',
    created_at: '2026-09-01T12:00:00.000Z',
    original_url: 'https://www.kariyer.net/is-ilani/quality-1',
    source_job_id: 'quality-1',
    duplicate_group_id: null,
    technologies: [],
    description: null as string | null,
    experience_level: null,
  };

  const gidaSearch = {
    id: 'search-gida',
    user_id: 'user-1',
    name: 'Gıda Mühendisliği',
    is_active: true,
    keywords: ['Gıda Mühendisliği'],
    technologies: [],
    locations: [],
    country_code: null,
    country_name: null,
    subdivision_code: null,
    subdivision_name: null,
    subdivision_codes: [],
    subdivision_names: [],
    work_types: [],
    experience_levels: [],
    sources: ['kariyer_net'],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  it('does not treat a migrated verified match_status as text evidence', async () => {
    const service = createDetailService({
      job: qualityJob,
      matchStatus: 'verified',
      search: gidaSearch,
    });

    const detail = await service.getByIdForUser('user-1', 'job-quality');

    expect(detail?.matchedSearches).toEqual([
      expect.objectContaining({
        id: 'search-gida',
        name: 'Gıda Mühendisliği',
        matchKind: null,
        terms: [],
        evidence: [],
        matchStatus: 'verified',
      }),
    ]);
    expect(
      JSON.stringify(detail?.matchedSearches).includes('Gıda Mühendisliği açıklamada'),
    ).toBe(false);
    expect(
      detail?.matchedSearches[0]?.evidence.some((item) =>
        (item.snippet ?? item.matchedText).includes('Gıda'),
      ),
    ).toBe(false);
  });

  it('returns live description evidence when the listing actually matches', async () => {
    const service = createDetailService({
      job: {
        ...qualityJob,
        description: 'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
      },
      matchStatus: 'verified',
      search: gidaSearch,
    });

    const detail = await service.getByIdForUser('user-1', 'job-quality');

    expect(detail?.matchedSearches[0]).toEqual(
      expect.objectContaining({
        matchKind: 'skill',
        matchStatus: 'verified',
      }),
    );
    expect(detail?.matchedSearches[0]?.evidence[0]?.snippet).toContain(
      'Gıda Mühendisliği',
    );
  });
});
