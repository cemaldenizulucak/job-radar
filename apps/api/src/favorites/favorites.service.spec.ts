import { NotFoundException } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { JobDetail, JobListItem } from '../jobs/jobs.types.js';
import { FavoritesService } from './favorites.service.js';

const jobListItem: JobListItem = {
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
  isMatched: false,
  isNew: false,
  isSeen: false,
  isFavorite: true,
};

const jobDetail: JobDetail = {
  ...jobListItem,
  description: null,
  experienceLevel: null,
  technologies: [],
  matchedSearches: [],
  duplicateJobs: [],
  isFavorite: false,
  applicationStatus: null,
  applicationId: null,
};

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
    const getByIdForUserOrThrow = vi.fn(async () => jobDetail);
    const service = new FavoritesService(
      {
        getClient: () => ({ from: () => ({ upsert }) }),
      } as unknown as SupabaseService,
      {
        getByIdForUserOrThrow,
        getMappedByIds: async () => [jobListItem],
      } as unknown as JobsService,
    );

    const result = await service.add('user-1', 'job-1');

    expect(getByIdForUserOrThrow).toHaveBeenCalledWith('user-1', 'job-1');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', job_id: 'job-1' },
      { onConflict: 'user_id,job_id' },
    );
    expect(result.jobId).toBe('job-1');
    expect(result.userId).toBe('user-1');
    expect(result.job).toEqual(jobListItem);
    expect(result.job?.isFavorite).toBe(true);
    expect(result.job && 'applicationStatus' in result.job).toBe(false);
  });

  it('returns 404 for an unknown job instead of creating a favorite', async () => {
    const upsert = vi.fn();
    const service = new FavoritesService(
      {
        getClient: () => ({ from: () => ({ upsert }) }),
      } as unknown as SupabaseService,
      {
        getByIdForUserOrThrow: async () => {
          throw new NotFoundException('Job not found.');
        },
        getMappedByIds: vi.fn(),
      } as unknown as JobsService,
    );

    await expect(service.add('user-1', 'missing-job')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('lists only the authenticated user favorites', async () => {
    const eq = vi.fn(() => ({
      order: async () => ({
        data: [
          {
            id: 'fav-1',
            user_id: 'user-1',
            job_id: 'job-1',
            created_at: '2026-09-01T12:00:00.000Z',
          },
        ],
        error: null,
      }),
    }));
    const select = vi.fn(() => ({ eq }));
    const getMappedByIds = vi.fn(async () => [jobListItem]);
    const service = new FavoritesService(
      {
        getClient: () => ({ from: () => ({ select }) }),
      } as unknown as SupabaseService,
      { getMappedByIds } as unknown as JobsService,
    );

    const items = await service.listForUser('user-1');

    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(getMappedByIds).toHaveBeenCalledWith(['job-1'], 'user-1');
    expect(items).toHaveLength(1);
    expect(items[0]?.userId).toBe('user-1');
    expect(items[0]?.jobId).toBe('job-1');
    expect(items[0]?.job).toEqual(jobListItem);
  });

  it('removes only the authenticated user favorite row', async () => {
    const eqJob = vi.fn(async () => ({ error: null }));
    const eqUser = vi.fn(() => ({ eq: eqJob }));
    const del = vi.fn(() => ({ eq: eqUser }));
    const service = new FavoritesService(
      {
        getClient: () => ({ from: () => ({ delete: del }) }),
      } as unknown as SupabaseService,
      {} as unknown as JobsService,
    );

    await service.remove('user-1', 'job-1');

    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqJob).toHaveBeenCalledWith('job_id', 'job-1');
  });
});
