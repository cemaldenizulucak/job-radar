import { BadRequestException } from '@nestjs/common';

import type { SourceId, WorkModel } from '../common/domain.types.js';
import { isRecord } from '../common/request.js';
import {
  deriveSavedSearchLocations,
  sanitizeCountryCode,
  sanitizeLocationList,
  sanitizeLocationToken,
  resolveSavedSearchLocation,
  toSearchLocationOrigin,
  type ProfileLocation,
} from '../common/search-location.js';
import type { ImmediateDiscoveryResult } from '../discovery/discovery.types.js';
import type {
  SavedSearch,
  SavedSearchResponse,
  SavedSearchWriteInput,
} from './searches.types.js';

export function toSavedSearchResponse(
  search: SavedSearch,
  _profile?: ProfileLocation | null,
  options?: { discovery?: ImmediateDiscoveryResult | null },
): SavedSearchResponse {
  const resolved = resolveSavedSearchLocation(search);

  return {
    id: search.id,
    userId: search.userId,
    name: search.name,
    isActive: search.isActive,
    keywords: [...search.keywords],
    technologies: [...search.technologies],
    locations: [...search.locations],
    countryCode: search.countryCode,
    countryName: search.countryName,
    subdivisionCode: search.subdivisionCode,
    subdivisionName: search.subdivisionName,
    workTypes: [...search.workTypes],
    experienceLevels: [...search.experienceLevels],
    sources: [...search.sourceIds],
    effectiveLocation: resolved.label,
    locationSource: toSearchLocationOrigin(resolved.source),
    createdAt: search.createdAt,
    updatedAt: search.updatedAt,
    ...(options?.discovery ? { discovery: options.discovery } : {}),
  };
}

export function parseSavedSearchWrite(body: unknown): SavedSearchWriteInput {
  if (!isRecord(body)) {
    throw new BadRequestException('Search payload is required.');
  }

  const name = readRequiredString(body.name, 'name');
  const keywords = readStringArray(body.keywords, 'keywords');
  if (keywords.length === 0) {
    throw new BadRequestException('Add at least one keyword.');
  }

  const sources = readStringArray(body.sources, 'sources').filter(isSourceId);
  if (sources.length === 0) {
    throw new BadRequestException('Select at least one source.');
  }

  const countryName = sanitizeLocationToken(
    readOptionalName(body.countryName, 'countryName'),
  );
  const subdivisionName = sanitizeLocationToken(
    readOptionalName(body.subdivisionName, 'subdivisionName'),
  );
  const countryCode =
    countryName || subdivisionName
      ? sanitizeCountryCode(readOptionalCode(body.countryCode, 'countryCode'))
      : null;
  const subdivisionCode =
    countryCode && subdivisionName
      ? readOptionalCode(body.subdivisionCode, 'subdivisionCode')
      : null;
  const hasStructuredLocation = Boolean(countryName || subdivisionName);

  return {
    name,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    keywords,
    technologies: readStringArray(body.technologies, 'technologies'),
    locations: hasStructuredLocation
      ? deriveSavedSearchLocations({ countryName, subdivisionName })
      : sanitizeLocationList(readStringArray(body.locations, 'locations')),
    countryCode,
    countryName,
    subdivisionCode,
    subdivisionName,
    workTypes: readStringArray(body.workTypes, 'workTypes').filter(isWorkModel),
    experienceLevels: readStringArray(body.experienceLevels, 'experienceLevels'),
    sources,
  };
}

export function parseToggleActive(body: unknown): boolean {
  if (!isRecord(body) || typeof body.isActive !== 'boolean') {
    throw new BadRequestException('isActive is required.');
  }

  return body.isActive;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required.`);
  }

  return value.trim();
}

function readOptionalName(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalCode(value: unknown, field: string): string | null {
  const name = readOptionalName(value, field);
  return name ? name.toUpperCase() : null;
}

function readStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new BadRequestException(`${field} must be an array of strings.`);
  }

  return value.map((item) => item.trim()).filter((item) => item.length > 0);
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
