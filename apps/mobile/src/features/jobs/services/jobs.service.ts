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
    return new JobsServiceError('Unexpected response from the jobs API.');
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new JobsServiceError(error.message);
  }

  return new JobsServiceError('Couldn’t load jobs. Try again.');
}

export function mapJobListItem(
  parsed: ReturnType<typeof jobListItemSchema.parse>,
): JobListItem {
  return {
    ...parsed,
    isMatched: parsed.isMatched ?? parsed.matchedSearchIds.length > 0,
  };
}

function mapJobDetail(parsed: ReturnType<typeof jobDetailSchema.parse>): JobDetail {
  return {
    ...mapJobListItem(parsed),
    description: parsed.description ?? null,
    experienceLevel: parsed.experienceLevel ?? null,
    technologies: parsed.technologies ?? [],
    matchedSearches: parsed.matchedSearches ?? [],
    duplicateJobs: parsed.duplicateJobs ?? [],
    isFavorite: parsed.isFavorite ?? false,
    applicationStatus: parsed.applicationStatus ?? null,
    applicationId: parsed.applicationId ?? null,
  };
}

export async function listJobs(
  options: { matchedOnly?: boolean } = {},
): Promise<JobListItem[]> {
  const matchedOnly = options.matchedOnly ?? true;
  try {
    const payload = jobListResponseSchema.parse(
      await apiGet(
        `/v1/jobs?limit=50&matchedOnly=${matchedOnly ? 'true' : 'false'}`,
      ),
    );
    return payload.items.map(mapJobListItem);
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
      throw new JobsServiceError('Job not found.');
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
