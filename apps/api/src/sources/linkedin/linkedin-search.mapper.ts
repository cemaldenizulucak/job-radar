import type { SourceAdapterCapabilities, SourceSearchQuery } from '../job-source.adapter.js';
import type { LinkedInSearchInput } from './linkedin.types.js';

/**
 * Maps JobRadar search criteria onto LinkedIn public query params.
 * Unsupported capabilities are omitted so matching can filter later.
 */
export function mapLinkedInSearch(
  query: SourceSearchQuery,
  capabilities: SourceAdapterCapabilities,
): LinkedInSearchInput {
  return {
    keywords: capabilities.supportsKeywordSearch
      ? uniqueNonEmpty([...query.keywords, ...query.technologies])
      : [],
    locations: capabilities.supportsLocation
      ? uniqueNonEmpty([...query.locations])
      : [],
    workTypes: capabilities.supportsRemoteFilter
      ? query.workModels.filter((model) => model !== 'unknown')
      : [],
    experienceLevels: capabilities.supportsExperienceLevel
      ? uniqueNonEmpty([...query.experienceLevels])
      : [],
    ...(query.maxAgeDays !== undefined ? { maxAgeDays: query.maxAgeDays } : {}),
  };
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}
