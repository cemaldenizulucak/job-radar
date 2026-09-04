import { z } from 'zod';

import { ApiClientError, apiGetPublic } from '@/lib/api-client';

import type { LocationCountry, LocationSubdivision } from '../types';

const locationItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const locationListSchema = z.object({
  items: z.array(locationItemSchema),
});

let countriesCache: LocationCountry[] | null = null;
const subdivisionsCache = new Map<string, LocationSubdivision[]>();

export function resetLocationCatalogCache(): void {
  countriesCache = null;
  subdivisionsCache.clear();
}

export async function listCountries(): Promise<LocationCountry[]> {
  if (countriesCache) {
    return countriesCache;
  }

  try {
    const parsed = locationListSchema.parse(
      await apiGetPublic('/v1/locations/countries'),
    );
    countriesCache = parsed.items;
    return parsed.items;
  } catch (error) {
    logLocationCatalogFailure('/v1/locations/countries', error);
    throw error;
  }
}

export async function listSubdivisions(
  countryCode: string,
): Promise<LocationSubdivision[]> {
  const code = countryCode.trim().toUpperCase();
  if (!code) {
    return [];
  }

  const cached = subdivisionsCache.get(code);
  if (cached) {
    return cached;
  }

  const endpoint = `/v1/locations/subdivisions?countryCode=${encodeURIComponent(code)}`;

  try {
    const parsed = locationListSchema.parse(await apiGetPublic(endpoint));
    subdivisionsCache.set(code, parsed.items);
    return parsed.items;
  } catch (error) {
    logLocationCatalogFailure(endpoint, error);
    throw error;
  }
}

export function logLocationCatalogFailure(endpoint: string, error: unknown): void {
  const status = error instanceof ApiClientError ? error.status : undefined;
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'unknown';

  console.warn('Locations catalog request failed', {
    endpoint,
    status,
    message,
  });
}
