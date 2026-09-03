import { z } from 'zod';

import { ApiClientError, apiGet, apiPatch } from '@/lib/api-client';

export type ProfileRecord = {
  userId: string;
  fullName: string | null;
  email: string | null;
  notificationsEnabled: boolean | null;
  timezone: string | null;
  country: string | null;
  city: string | null;
};

export type ProfileUpdateInput = {
  notificationsEnabled?: boolean;
  country?: string | null;
  city?: string | null;
};

const profileSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  notificationsEnabled: z.boolean().nullable(),
  timezone: z.string().nullable(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
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
    return new ProfileServiceError('Profil beklenmeyen bir yanıt verdi.');
  }

  return new ProfileServiceError('Profil yüklenemedi.');
}

function mapProfile(row: z.infer<typeof profileSchema>): ProfileRecord {
  return {
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    notificationsEnabled: row.notificationsEnabled,
    timezone: row.timezone,
    country: row.country ?? null,
    city: row.city ?? null,
  };
}

export async function getProfile(): Promise<ProfileRecord> {
  try {
    return mapProfile(profileSchema.parse(await apiGet('/v1/profiles')));
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateProfile(
  patch: ProfileUpdateInput,
): Promise<ProfileRecord> {
  try {
    return mapProfile(profileSchema.parse(await apiPatch('/v1/profiles', patch)));
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateProfileNotifications(
  notificationsEnabled: boolean,
): Promise<ProfileRecord> {
  return updateProfile({ notificationsEnabled });
}
