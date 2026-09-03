import { z } from 'zod';

import { apiGet } from '@/lib/api-client';

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

export async function listCountries(): Promise<LocationCountry[]> {
  if (countriesCache) {
    return countriesCache;
  }

  try {
    const parsed = locationListSchema.parse(await apiGet('/v1/locations/countries'));
    countriesCache = parsed.items;
    return parsed.items;
  } catch {
    return [];
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

  try {
    const parsed = locationListSchema.parse(
      await apiGet(
        `/v1/locations/subdivisions?countryCode=${encodeURIComponent(code)}`,
      ),
    );
    subdivisionsCache.set(code, parsed.items);
    return parsed.items;
  } catch {
    return [];
  }
}
