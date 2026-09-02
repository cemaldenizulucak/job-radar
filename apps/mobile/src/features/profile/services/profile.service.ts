import { z } from 'zod';

import { ApiClientError, apiGet, apiPatch } from '@/lib/api-client';

export type ProfileRecord = {
  userId: string;
  fullName: string | null;
  email: string | null;
  notificationsEnabled: boolean | null;
  timezone: string | null;
};

const profileSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  notificationsEnabled: z.boolean().nullable(),
  timezone: z.string().nullable(),
});

export class ProfileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

function toServiceError(error: unknown): ProfileServiceError {
  if (error instanceof ProfileServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new ProfileServiceError(error.message);
  }

  if (error instanceof z.ZodError) {
    return new ProfileServiceError('Unexpected response from the profile API.');
  }

  return new ProfileServiceError('Couldn’t load profile.');
}

export async function getProfile(): Promise<ProfileRecord> {
  try {
    return profileSchema.parse(await apiGet('/v1/profiles'));
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateProfileNotifications(
  notificationsEnabled: boolean,
): Promise<ProfileRecord> {
  try {
    return profileSchema.parse(
      await apiPatch('/v1/profiles', { notificationsEnabled }),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}
