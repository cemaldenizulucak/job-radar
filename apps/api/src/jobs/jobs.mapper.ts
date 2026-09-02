import type { WorkModel } from '../common/domain.types.js';
import type { JobListItem } from './jobs.types.js';

export const JOB_FEED_SELECT =
  'id, title, company, description, location, work_model, experience_level, technologies, source, source_job_id, original_url, published_at, discovered_at, duplicate_group_id, created_at';

export type JobFeedRow = {
  item: JobListItem;
  duplicateGroupId: string | null;
  description: string | null;
  experienceLevel: string | null;
  technologies: readonly string[];
};

export function mapJobFeedRow(
  value: unknown,
  matchedSearchIds: readonly string[],
): JobFeedRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const sourceId = readSourceId(value, 'source');
  const title = readString(value, 'title');

  if (!id || !title || !sourceId) {
    return null;
  }

  const discoveredAt =
    readDate(value, 'discovered_at') ??
    readDate(value, 'created_at') ??
    new Date(0);

  return {
    duplicateGroupId: readString(value, 'duplicate_group_id'),
    description: readString(value, 'description'),
    experienceLevel: readString(value, 'experience_level'),
    technologies: readStringArray(value, 'technologies'),
    item: {
      id,
      sourceId,
      title,
      companyName: readString(value, 'company') ?? '',
      location: readString(value, 'location'),
      workModel: readWorkModel(value, 'work_model'),
      publishedAt: readDate(value, 'published_at'),
      firstDiscoveredAt: discoveredAt,
      canonicalUrl: readString(value, 'original_url') ?? '',
      matchedSearchIds,
      isMatched: matchedSearchIds.length > 0,
      duplicateGroupSize: 1,
      isNew: false,
      isSeen: false,
    },
  };
}

function readWorkModel(
  row: Record<string, unknown>,
  key: string,
): WorkModel | null {
  const value = readString(row, key)?.toLowerCase();
  if (
    value === 'remote' ||
    value === 'hybrid' ||
    value === 'onsite' ||
    value === 'unknown'
  ) {
    return value;
  }

  return null;
}

function readSourceId(
  row: Record<string, unknown>,
  key: string,
): 'linkedin' | 'kariyer_net' | null {
  const raw = readString(row, key);
  if (!raw) {
    return null;
  }

  const value = raw.trim().toLowerCase().replace(/[.\s-]+/g, '_');
  if (value === 'linkedin' || value === 'kariyer_net' || value === 'kariyer') {
    return value === 'kariyer' ? 'kariyer_net' : value;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function readDate(row: Record<string, unknown>, key: string): Date | null {
  const value = row[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
