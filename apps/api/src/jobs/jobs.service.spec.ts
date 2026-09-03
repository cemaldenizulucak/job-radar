import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
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
});
