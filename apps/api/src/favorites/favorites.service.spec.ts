import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { FavoritesService } from './favorites.service.js';

describe('FavoritesService', () => {
  it('upserts a favorite for the user and job', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'fav-1',
        user_id: 'user-1',
        job_id: 'job-1',
        created_at: '2026-09-01T12:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    const service = new FavoritesService(
      {
        getClient: () => ({ from: () => ({ upsert }) }),
      } as unknown as SupabaseService,
      {
        getMappedByIds: async () => [
          {
            id: 'job-1',
            sourceId: 'linkedin',
            title: 'Frontend Developer',
            companyName: 'ABC Technology',
            location: 'Istanbul',
            workModel: 'hybrid',
            publishedAt: null,
            firstDiscoveredAt: new Date('2026-09-01T12:00:00.000Z'),
            canonicalUrl: 'https://example.com',
            matchedSearchIds: [],
            duplicateGroupSize: 1,
            isNew: false,
            isSeen: false,
          },
        ],
      } as unknown as JobsService,
    );

    const result = await service.add('user-1', 'job-1');

    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', job_id: 'job-1' },
      { onConflict: 'user_id,job_id' },
    );
    expect(result.jobId).toBe('job-1');
    expect(result.job?.title).toBe('Frontend Developer');
  });
});
