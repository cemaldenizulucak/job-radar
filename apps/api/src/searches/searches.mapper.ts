import type { SourceId, WorkModel } from '../common/domain.types.js';
import { sanitizeCountryCode, sanitizeLocationList, sanitizeLocationToken } from '../common/search-location.js';
import type { SavedSearch } from './searches.types.js';

export const SAVED_SEARCH_SELECT =
  'id, user_id, name, is_active, keywords, technologies, locations, country_code, country_name, subdivision_code, subdivision_name, work_types, experience_levels, sources, created_at, updated_at';

export function mapSavedSearchRows(value: unknown): SavedSearch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const searches: SavedSearch[] = [];

  for (const row of value) {
    const search = mapSavedSearchRow(row);
    if (search) {
      searches.push(search);
    }
  }

  return searches;
}

export function mapSavedSearchRow(value: unknown): SavedSearch | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const name = readString(value, 'name');
  const isActive = readBoolean(value, 'is_active');

  if (!id || !userId || !name || isActive === null) {
    return null;
  }

  return {
    id,
    userId,
    name,
    isActive,
    keywords: readStringArray(value, 'keywords'),
    technologies: readStringArray(value, 'technologies'),
    locations: sanitizeLocationList(readStringArray(value, 'locations')),
    countryCode: sanitizeCountryCode(readString(value, 'country_code')),
    countryName: sanitizeLocationToken(readString(value, 'country_name')),
    subdivisionCode: sanitizeLocationToken(readString(value, 'subdivision_code')),
    subdivisionName: sanitizeLocationToken(readString(value, 'subdivision_name')),
    workTypes: readStringArray(value, 'work_types').filter(isWorkModel),
    experienceLevels: readStringArray(value, 'experience_levels'),
    sourceIds: readStringArray(value, 'sources').filter(isSourceId),
    createdAt: readString(value, 'created_at') ?? '',
    updatedAt: readString(value, 'updated_at') ?? '',
  };
}

function isWorkModel(value: string): value is WorkModel {
  return (
    value === 'remote' ||
    value === 'hybrid' ||
    value === 'onsite' ||
    value === 'unknown'
  );
}

function isSourceId(value: string): value is SourceId {
  return value === 'linkedin' || value === 'kariyer_net';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBoolean(
  row: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = row[key];
  return typeof value === 'boolean' ? value : null;
}

function readStringArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];

  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
