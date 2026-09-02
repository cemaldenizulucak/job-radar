import { BadRequestException } from '@nestjs/common';

import type { SourceId, WorkModel } from '../common/domain.types.js';
import { isRecord } from '../common/request.js';
import type { SavedSearch, SavedSearchWriteInput } from './searches.types.js';

export function toSavedSearchResponse(search: SavedSearch) {
  return {
    id: search.id,
    userId: search.userId,
    name: search.name,
    isActive: search.isActive,
    keywords: [...search.keywords],
    technologies: [...search.technologies],
    locations: [...search.locations],
    workTypes: [...search.workTypes],
    experienceLevels: [...search.experienceLevels],
    sources: [...search.sourceIds],
    createdAt: search.createdAt,
    updatedAt: search.updatedAt,
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

  return {
    name,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    keywords,
    technologies: readStringArray(body.technologies, 'technologies'),
    locations: readStringArray(body.locations, 'locations'),
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
