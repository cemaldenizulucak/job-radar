import { ZodError } from 'zod';

import { ApiClientError, apiGet, apiPatch } from '@/lib/api-client';

import type { JobDetail, JobListItem } from '../types/job.types';
import { jobDetailSchema, jobListItemSchema, jobListResponseSchema } from '../validation/job.schema';

export class JobsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobsServiceError';
  }
}

function toServiceError(error: unknown): JobsServiceError {
  if (error instanceof JobsServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new JobsServiceError(error.message);
  }

  if (error instanceof ZodError) {
    return new JobsServiceError('İlanlar beklenmeyen bir yanıt verdi.');
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new JobsServiceError(error.message);
  }

    return new JobsServiceError('İlanlar yüklenemedi. Lütfen tekrar deneyin.');
}

export function mapJobListItem(
  parsed: ReturnType<typeof jobListItemSchema.parse>,
): JobListItem {
  return {
    ...parsed,
    isMatched: parsed.isMatched ?? parsed.matchedSearchIds.length > 0,
    isFavorite: parsed.isFavorite ?? false,
  };
}

function mapJobDetail(parsed: ReturnType<typeof jobDetailSchema.parse>): JobDetail {
  return {
    ...mapJobListItem(parsed),
    description: parsed.description ?? null,
    experienceLevel: parsed.experienceLevel ?? null,
    technologies: parsed.technologies ?? [],
    matchedSearches: (parsed.matchedSearches ?? []).map((search) => ({
      id: search.id,
      name: search.name,
      matchKind: search.matchKind ?? null,
      terms: search.terms ?? [],
      evidence: search.evidence ?? [],
    })),
    duplicateJobs: parsed.duplicateJobs ?? [],
    isFavorite: parsed.isFavorite ?? false,
    applicationStatus: parsed.applicationStatus ?? null,
    applicationId: parsed.applicationId ?? null,
  };
}

export async function listJobs(
  options: {
    matchedOnly?: boolean;
    savedSearchId?: string | 'all';
  } = {},
): Promise<{
  items: JobListItem[];
  lastDiscoveryAt: string | null;
  totalCount: number;
  savedSearchCounts: readonly { id: string; count: number }[];
}> {
  const matchedOnly = options.matchedOnly ?? true;
  const savedSearchId =
    options.savedSearchId && options.savedSearchId !== 'all'
      ? options.savedSearchId
      : undefined;
  try {
    const params = new URLSearchParams({
      limit: '200',
      matchedOnly: matchedOnly ? 'true' : 'false',
    });
    if (savedSearchId) {
      params.set('savedSearchId', savedSearchId);
    }

    const payload = jobListResponseSchema.parse(
      await apiGet(`/v1/jobs?${params.toString()}`),
    );
    const items = payload.items.map(mapJobListItem);
    return {
      items,
      lastDiscoveryAt: payload.lastDiscoveryAt ?? null,
      totalCount: payload.totalCount ?? items.length,
      savedSearchCounts: payload.savedSearchCounts ?? [],
    };
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function getJob(id: string): Promise<JobDetail> {
  try {
    return mapJobDetail(
      jobDetailSchema.parse(await apiGet(`/v1/jobs/${encodeURIComponent(id)}`)),
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new JobsServiceError('İlan bulunamadı.');
    }

    throw toServiceError(error);
  }
}

export async function markJobSeen(id: string): Promise<JobDetail> {
  try {
    return mapJobDetail(
      jobDetailSchema.parse(
        await apiPatch(`/v1/jobs/${encodeURIComponent(id)}/seen`),
      ),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}
