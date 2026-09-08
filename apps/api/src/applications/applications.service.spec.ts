import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { ApplicationsService } from './applications.service.js';

describe('ApplicationsService', () => {
  it('upserts an application status for the user and job', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'app-1',
        user_id: 'user-1',
        job_id: 'job-1',
        status: 'APPLIED',
        created_at: '2026-09-01T12:00:00.000Z',
        updated_at: '2026-09-01T12:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    const service = new ApplicationsService(
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
            isFavorite: false,
          },
        ],
      } as unknown as JobsService,
    );

    const result = await service.upsert('user-1', 'job-1', 'APPLIED');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        job_id: 'job-1',
        status: 'APPLIED',
      }),
      { onConflict: 'user_id,job_id' },
    );
    expect(result.status).toBe('APPLIED');
    expect(result.title).toBe('Frontend Developer');
  });
});
