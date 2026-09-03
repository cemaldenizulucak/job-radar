import { isWithinSourceMaxAge } from '../discovery/discovery-window.js';

export const JOB_FEED_DEFAULT_LIMIT = 50;
export const JOB_FEED_MAX_LIMIT = 200;

export function clampJobFeedLimit(limit: number | undefined): number {
  return Math.min(
    Math.max(limit ?? JOB_FEED_DEFAULT_LIMIT, 1),
    JOB_FEED_MAX_LIMIT,
  );
}

export function parseJobFeedLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Same visibility rules as GET /v1/jobs with matchedOnly (active + max age).
 * Pagination is not part of visibility: a job can be retrievable on a later page.
 */
export function isVisibleInMatchedJobFeed(
  job: { isActive: boolean; publishedAt: string | null },
  maxAgeDays: number,
  now: Date = new Date(),
): boolean {
  if (!job.isActive) {
    return false;
  }

  return isWithinSourceMaxAge(job.publishedAt, maxAgeDays, now);
}
