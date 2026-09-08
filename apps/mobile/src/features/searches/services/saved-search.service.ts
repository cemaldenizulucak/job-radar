import { z } from 'zod';

import { ApiClientError, apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api-client';

import type { SavedSearch, SavedSearchWriteInput, SearchDiscoveryResult, SearchSourceId, WorkType } from '../types/search.types';
import {
  savedSearchWriteSchema,
  SEARCH_SOURCE_IDS,
  WORK_TYPES,
} from '../validation/search.schema';

export class SavedSearchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SavedSearchServiceError';
  }
}

export type SavedSearchWriteResult = {
  search: SavedSearch;
  discovery: SearchDiscoveryResult;
};

const searchDiscoveryApiSchema = z.object({
  status: z.enum(['pending', 'completed', 'partial', 'failed', 'skipped']),
  jobsFetched: z.number(),
  matchesCreated: z.number(),
});

const savedSearchApiSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  keywords: z.array(z.string()),
  technologies: z.array(z.string()),
  locations: z.array(z.string()),
  countryCode: z.string().nullable().optional(),
  countryName: z.string().nullable().optional(),
  subdivisionCode: z.string().nullable().optional(),
  subdivisionName: z.string().nullable().optional(),
  subdivisionCodes: z.array(z.string()).optional(),
  subdivisionNames: z.array(z.string()).optional(),
  workTypes: z.array(z.string()),
  experienceLevels: z.array(z.string()),
  sources: z.array(z.string()),
  effectiveLocation: z.string().nullable().optional(),
  locationSource: z.enum(['search', 'profile', 'none']).optional(),
  discovery: searchDiscoveryApiSchema.optional(),
  lastDiscoveredAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const savedSearchWriteApiSchema = z.object({
  search: savedSearchApiSchema,
  discovery: searchDiscoveryApiSchema,
});

const savedSearchListSchema = z.object({
  items: z.array(savedSearchApiSchema),
});

function isSearchSourceId(value: string): value is SearchSourceId {
  return (SEARCH_SOURCE_IDS as readonly string[]).includes(value);
}

function isWorkType(value: string): value is WorkType {
  return (WORK_TYPES as readonly string[]).includes(value);
}

function mapSearch(row: z.infer<typeof savedSearchApiSchema>): SavedSearch {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    isActive: row.isActive,
    keywords: row.keywords,
    technologies: row.technologies,
    locations: row.locations,
    countryCode: row.countryCode ?? null,
    countryName: row.countryName ?? null,
    subdivisionCode: row.subdivisionCode ?? null,
    subdivisionName: row.subdivisionName ?? null,
    subdivisionCodes:
      row.subdivisionCodes && row.subdivisionCodes.length > 0
        ? row.subdivisionCodes
        : row.subdivisionCode
          ? [row.subdivisionCode]
          : [],
    subdivisionNames:
      row.subdivisionNames && row.subdivisionNames.length > 0
        ? row.subdivisionNames
        : row.subdivisionName
          ? [row.subdivisionName]
          : [],
    workTypes: row.workTypes.filter(isWorkType),
    experienceLevels: row.experienceLevels,
    sources: row.sources.filter(isSearchSourceId),
    effectiveLocation: row.effectiveLocation ?? null,
    locationSource:
      row.locationSource ?? (row.locations.length > 0 ? 'search' : 'none'),
    discovery: row.discovery,
    lastDiscoveredAt: row.lastDiscoveredAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWriteResult(
  row: z.infer<typeof savedSearchWriteApiSchema>,
): SavedSearchWriteResult {
  return {
    search: mapSearch(row.search),
    discovery: row.discovery,
  };
}

function toServiceError(error: unknown): SavedSearchServiceError {
  if (error instanceof SavedSearchServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new SavedSearchServiceError(error.message);
  }

  if (error instanceof z.ZodError) {
    return new SavedSearchServiceError('Aramalar beklenmeyen bir yanıt verdi.');
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new SavedSearchServiceError(error.message);
  }

  return new SavedSearchServiceError('Arama güncellenemedi.');
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  try {
    return savedSearchListSchema
      .parse(await apiGet('/v1/searches'))
      .items.map(mapSearch);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function getSavedSearch(id: string): Promise<SavedSearch> {
  try {
    return mapSearch(
      savedSearchApiSchema.parse(
        await apiGet(`/v1/searches/${encodeURIComponent(id)}`),
      ),
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new SavedSearchServiceError('Arama bulunamadı.');
    }

    throw toServiceError(error);
  }
}

export async function createSavedSearch(
  input: SavedSearchWriteInput,
): Promise<SavedSearchWriteResult> {
  try {
    const parsed = savedSearchWriteSchema.parse(input);
    return mapWriteResult(
      savedSearchWriteApiSchema.parse(await apiPost('/v1/searches', parsed)),
    );
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateSavedSearch(
  id: string,
  input: SavedSearchWriteInput,
): Promise<SavedSearchWriteResult> {
  try {
    const parsed = savedSearchWriteSchema.parse(input);
    return mapWriteResult(
      savedSearchWriteApiSchema.parse(
        await apiPatch(`/v1/searches/${encodeURIComponent(id)}`, parsed),
      ),
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new SavedSearchServiceError('Arama bulunamadı.');
    }

    throw toServiceError(error);
  }
}

export async function toggleSavedSearchActive(
  id: string,
  isActive: boolean,
): Promise<SavedSearchWriteResult> {
  try {
    return mapWriteResult(
      savedSearchWriteApiSchema.parse(
        await apiPatch(`/v1/searches/${encodeURIComponent(id)}/toggle`, {
          isActive,
        }),
      ),
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new SavedSearchServiceError('Arama bulunamadı.');
    }

    throw toServiceError(error);
  }
}

export async function deleteSavedSearch(id: string): Promise<void> {
  try {
    await apiDelete(`/v1/searches/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new SavedSearchServiceError('Arama bulunamadı.');
    }

    throw toServiceError(error);
  }
}
