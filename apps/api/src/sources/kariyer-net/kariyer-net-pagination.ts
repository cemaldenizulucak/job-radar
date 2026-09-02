import { DEFAULT_JOB_SOURCE_MAX_AGE_DAYS } from '../../discovery/discovery-window.js';
import { parseKariyerNetPublishedAt } from './kariyer-net-published-at.js';
import type {
  KariyerNetPaginationStopReason,
  KariyerNetRawJob,
} from './kariyer-net.types.js';

export function oldestReliablePublishedAt(
  jobs: readonly KariyerNetRawJob[],
  now: Date = new Date(),
): Date | null {
  let oldest: Date | null = null;

  for (const job of jobs) {
    const iso = parseKariyerNetPublishedAt(job.publishedAt, now);
    if (!iso) {
      continue;
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    if (!oldest || date < oldest) {
      oldest = date;
    }
  }

  return oldest;
}

export function shouldStopKariyerNetPagination(input: {
  page: number;
  maxPages: number;
  jobsOnPage: readonly KariyerNetRawJob[];
  maxAgeDays?: number;
  now?: Date;
}): KariyerNetPaginationStopReason | null {
  if (input.jobsOnPage.length === 0) {
    return 'no_results';
  }

  const maxAgeDays = input.maxAgeDays ?? DEFAULT_JOB_SOURCE_MAX_AGE_DAYS;
  const oldest = oldestReliablePublishedAt(input.jobsOnPage, input.now);
  if (oldest) {
    const cutoff = new Date(
      (input.now ?? new Date()).getTime() - maxAgeDays * 24 * 60 * 60 * 1000,
    );
    if (oldest < cutoff) {
      return 'max_age';
    }
  }

  if (input.page >= input.maxPages) {
    return 'max_pages';
  }

  return null;
}
