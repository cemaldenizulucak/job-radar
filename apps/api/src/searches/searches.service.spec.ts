import { InternalServerErrorException } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { transientQueryClock } from '../infrastructure/supabase/transient-query.js';
import { SearchesService } from './searches.service.js';

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

function createSupabase(
  result: QueryResult,
): {
  service: SupabaseService;
  from: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
} {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockResolvedValue(result);

  const from = vi.fn(() => builder);

  return {
    service: {
      getClient: () => ({ from }),
    } as unknown as SupabaseService,
    from,
    eq: builder.eq,
  };
}

function createSupabaseSequence(results: QueryResult[]): {
  service: SupabaseService;
  eq: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockImplementation(async () => {
    const result = results[Math.min(index, results.length - 1)] ?? {
      data: null,
      error: { message: 'missing' },
    };
    index += 1;
    return result;
  });

  return {
    service: {
      getClient: () => ({ from: vi.fn(() => builder) }),
    } as unknown as SupabaseService,
    eq: builder.eq,
  };
}

const frontendSearchRow = {
  id: 'search-1',
  user_id: 'user-1',
  name: 'Frontend',
  is_active: true,
  keywords: ['frontend'],
  technologies: [],
  locations: [],
  work_types: ['remote'],
  experience_levels: [],
  sources: ['linkedin'],
};

describe('SearchesService', () => {
  beforeEach(() => {
    vi.spyOn(transientQueryClock, 'sleep').mockResolvedValue(undefined);
    vi.spyOn(transientQueryClock, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads only active saved searches', async () => {
    const { service, from, eq } = createSupabase({
      data: [frontendSearchRow],
      error: null,
    });
    const searches = new SearchesService(service);

    const result = await searches.getActiveSearches();

    expect(from).toHaveBeenCalledWith('saved_searches');
    expect(eq).toHaveBeenCalledWith('is_active', true);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'search-1',
        isActive: true,
        sourceIds: ['linkedin'],
      }),
    ]);
    expect(searches.consumeActiveLoadTelemetry()).toEqual({
      attemptCount: 1,
      recoveredAfterRetry: false,
    });
  });

  it('lists only the authenticated user searches', async () => {
    const order = vi.fn(async () => ({
      data: [frontendSearchRow],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({
      select: () => ({ eq }),
    }));
    const searches = new SearchesService({
      getClient: () => ({ from }),
    } as unknown as SupabaseService);

    const result = await searches.listForUser('user-1');

    expect(from).toHaveBeenCalledWith('saved_searches');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual([
      expect.objectContaining({ id: 'search-1', userId: 'user-1' }),
    ]);
  });

  it('does not include database error details in the HTTP error', async () => {
    const secret = 'sb_secret_test_value_must_not_leak';
    const { service } = createSupabase({
      data: null,
      error: { message: `permission denied ${secret}` },
    });
    const searches = new SearchesService(service);

    await expect(searches.getActiveSearches()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    try {
      await searches.getActiveSearches();
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(String(error)).not.toContain(secret);
    }
  });

  it('retries PGRST303 and then returns saved searches', async () => {
    const { service, eq } = createSupabaseSequence([
      {
        data: null,
        error: { code: 'PGRST303', message: 'JWT issued at future' },
      },
      {
        data: [frontendSearchRow],
        error: null,
      },
    ]);
    const searches = new SearchesService(service);

    const result = await searches.getActiveSearches();

    expect(eq).toHaveBeenCalledTimes(2);
    expect(result).toEqual([expect.objectContaining({ id: 'search-1' })]);
    expect(searches.consumeActiveLoadTelemetry()).toEqual({
      attemptCount: 2,
      recoveredAfterRetry: true,
    });
  });

  it('fails after three PGRST303 attempts', async () => {
    const { service, eq } = createSupabase({
      data: null,
      error: { code: 'PGRST303', message: 'JWT issued at future' },
    });
    const searches = new SearchesService(service);

    await expect(searches.getActiveSearches()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(eq).toHaveBeenCalledTimes(3);
  });

  it('does not retry RLS or missing-column errors', async () => {
    const { service, eq } = createSupabase({
      data: null,
      error: { code: 'PGRST204', message: 'column does not exist' },
    });
    const searches = new SearchesService(service);

    await expect(searches.getActiveSearches()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(eq).toHaveBeenCalledTimes(1);
  });
});
