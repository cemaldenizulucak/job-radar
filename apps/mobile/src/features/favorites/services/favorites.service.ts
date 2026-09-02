import { z } from 'zod';

import {
  ApiClientError,
  apiDelete,
  apiGet,
  apiPost,
} from '@/lib/api-client';

import { jobListItemSchema } from '@/features/jobs/validation/job.schema';
import { mapJobListItem } from '@/features/jobs/services/jobs.service';
import type { JobListItem } from '@/features/jobs/types/job.types';

export type FavoriteItem = {
  id: string;
  userId: string;
  jobId: string;
  createdAt: string;
  job: JobListItem | null;
};

const favoriteItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobId: z.string(),
  createdAt: z.string(),
  job: jobListItemSchema.nullable(),
});

const favoriteListSchema = z.object({
  items: z.array(favoriteItemSchema),
});

export class FavoritesServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FavoritesServiceError';
  }
}

function toServiceError(error: unknown): FavoritesServiceError {
  if (error instanceof FavoritesServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new FavoritesServiceError(error.message);
  }

  if (error instanceof z.ZodError) {
    return new FavoritesServiceError('Unexpected response from the favorites API.');
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new FavoritesServiceError(error.message);
  }

  return new FavoritesServiceError('Couldn’t update favorites. Try again.');
}

function toFavoriteItem(
  parsed: z.infer<typeof favoriteItemSchema>,
): FavoriteItem {
  return {
    ...parsed,
    job: parsed.job ? mapJobListItem(parsed.job) : null,
  };
}

export async function listFavorites(): Promise<FavoriteItem[]> {
  try {
    return favoriteListSchema
      .parse(await apiGet('/v1/favorites'))
      .items.map(toFavoriteItem);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function addFavorite(jobId: string): Promise<FavoriteItem> {
  try {
    return toFavoriteItem(
      favoriteItemSchema.parse(await apiPost('/v1/favorites', { jobId })),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function removeFavorite(jobId: string): Promise<void> {
  try {
    await apiDelete(`/v1/favorites/${encodeURIComponent(jobId)}`);
  } catch (error) {
    throw toServiceError(error);
  }
}
