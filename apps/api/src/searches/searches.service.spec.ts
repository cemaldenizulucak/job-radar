import { InternalServerErrorException } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { SearchesService } from './searches.service.js';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
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

describe('SearchesService', () => {
  it('loads only active saved searches', async () => {
    const { service, from, eq } = createSupabase({
      data: [
        {
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
        },
      ],
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
  });

  it('lists only the authenticated user searches', async () => {
    const order = vi.fn(async () => ({
      data: [
        {
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
        },
      ],
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
});
