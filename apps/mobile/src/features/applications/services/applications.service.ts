import { z } from 'zod';

import {
  ApiClientError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from '@/lib/api-client';

import type { JobApplicationStatus, JobSourceId } from '@/features/jobs/types/job.types';
import { jobSourceIdSchema } from '@/features/jobs/validation/job.schema';

export type ApplicationItem = {
  id: string;
  userId: string;
  jobId: string;
  status: JobApplicationStatus;
  createdAt: string;
  updatedAt: string;
  title: string;
  companyName: string;
  sourceId: JobSourceId;
  canonicalUrl: string;
};

const applicationStatusSchema = z.enum([
  'NEW',
  'REVIEWING',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
]);

const applicationItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobId: z.string(),
  status: applicationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  companyName: z.string(),
  sourceId: jobSourceIdSchema,
  canonicalUrl: z.string(),
});

const applicationListSchema = z.object({
  items: z.array(applicationItemSchema),
});

export class ApplicationsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationsServiceError';
  }
}

function toServiceError(error: unknown): ApplicationsServiceError {
  if (error instanceof ApplicationsServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new ApplicationsServiceError(error.message);
  }

  if (error instanceof z.ZodError) {
    return new ApplicationsServiceError(
      'Unexpected response from the applications API.',
    );
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new ApplicationsServiceError(error.message);
  }

  return new ApplicationsServiceError('Couldn’t update application. Try again.');
}

export async function listApplications(): Promise<ApplicationItem[]> {
  try {
    return applicationListSchema.parse(await apiGet('/v1/applications')).items;
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function upsertApplication(
  jobId: string,
  status: JobApplicationStatus,
): Promise<ApplicationItem> {
  try {
    return applicationItemSchema.parse(
      await apiPost('/v1/applications', { jobId, status }),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateApplicationStatus(
  id: string,
  status: JobApplicationStatus,
): Promise<ApplicationItem> {
  try {
    return applicationItemSchema.parse(
      await apiPatch(`/v1/applications/${encodeURIComponent(id)}`, { status }),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function deleteApplication(id: string): Promise<void> {
  try {
    await apiDelete(`/v1/applications/${encodeURIComponent(id)}`);
  } catch (error) {
    throw toServiceError(error);
  }
}
