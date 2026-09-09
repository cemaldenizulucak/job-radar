import type { NormalizedJob } from './jobs.types.js';
import { isUsableJobDescription } from './listing-description.js';

export type ExistingListingFields = {
  description: string | null;
  publishedAt: string | null;
};

/**
 * List cards often omit description. Never replace a stored description
 * with empty incoming text, and never invent copy from search terms.
 */
export function mergeNormalizedJobUpdate(
  incoming: NormalizedJob,
  existing: ExistingListingFields,
): NormalizedJob {
  return {
    ...incoming,
    description: isUsableJobDescription(incoming.description)
      ? incoming.description
      : existing.description,
    publishedAt: incoming.publishedAt ?? existing.publishedAt,
  };
}
