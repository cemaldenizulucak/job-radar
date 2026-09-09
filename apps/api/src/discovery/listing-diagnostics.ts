import { isVisibleInMatchedJobFeed } from '../jobs/job-feed-visibility.js';
import type { MatchDecision, MatchableJob } from '../matching/matching.types.js';
import type { ListingDiagnosis, ListingDiagnosisOutcome } from './discovery.types.js';

export function listingDiagnosisFromDecision(input: {
  job: MatchableJob | null;
  decision: MatchDecision | null;
  maxAgeDays: number;
  publishedAt?: string | null;
  isActive?: boolean;
}): ListingDiagnosis {
  const job = input.job;
  if (!job) {
    return {
      outcome: 'not_discovered',
      reason: 'Listing is not in the catalog for this source identity or URL.',
      inCatalog: false,
      matched: false,
      visibleInFeed: false,
      keyword: null,
      location: null,
      hasDescription: false,
    };
  }

  const hasDescription = Boolean(job.description?.trim());
  const decision = input.decision;
  const matched = decision?.matched === true;
  const visibleInFeed = isVisibleInMatchedJobFeed(
    {
      isActive: input.isActive ?? true,
      publishedAt: input.publishedAt ?? null,
    },
    input.maxAgeDays,
  );

  if (!matched) {
    if (!hasDescription && decision?.keyword === 'fail') {
      return {
        outcome: 'detail_missing',
        reason:
          'Title did not match and the stored description is empty, so education-field evidence could not be evaluated.',
        inCatalog: true,
        matched: false,
        visibleInFeed,
        keyword: decision.keyword,
        location: decision.location,
        hasDescription,
      };
    }

    return {
      outcome: 'filtered',
      reason: decision?.reasons.join('; ') || 'Listing did not match the saved search.',
      inCatalog: true,
      matched: false,
      visibleInFeed,
      keyword: decision?.keyword ?? null,
      location: decision?.location ?? null,
      hasDescription,
    };
  }

  if (!visibleInFeed) {
    return {
      outcome: 'matched_hidden',
      reason:
        'Listing matched the saved search but is hidden from the feed by activity or the product date window.',
      inCatalog: true,
      matched: true,
      visibleInFeed: false,
      keyword: decision?.keyword ?? null,
      location: decision?.location ?? null,
      hasDescription,
    };
  }

  return {
    outcome: 'matched' satisfies ListingDiagnosisOutcome,
    reason: 'Listing is in the catalog, matched the saved search, and is visible in the feed.',
    inCatalog: true,
    matched: true,
    visibleInFeed: true,
    keyword: decision?.keyword ?? null,
    location: decision?.location ?? null,
    hasDescription,
  };
}
