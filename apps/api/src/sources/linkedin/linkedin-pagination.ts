import { DEFAULT_JOB_SOURCE_MAX_AGE_DAYS } from '../../discovery/discovery-window.js';
import { parseLinkedInPublishedAt } from './linkedin-published-at.js';
import type {
  LinkedInPaginationStopReason,
  LinkedInRawJob,
} from './linkedin.types.js';

export function oldestReliablePublishedAt(
  jobs: readonly LinkedInRawJob[],
  now: Date = new Date(),
): Date | null {
  let oldest: Date | null = null;

  for (const job of jobs) {
    const iso = parseLinkedInPublishedAt(job.publishedAt, now);
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

export function shouldStopLinkedInPagination(input: {
  page: number;
  maxPages: number;
  jobsOnPage: readonly LinkedInRawJob[];
  maxAgeDays?: number;
  now?: Date;
}): LinkedInPaginationStopReason | null {
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

export function readLinkedInStartParam(url: string | undefined): number {
  if (!url) {
    return 0;
  }

  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('start');
    if (!raw) {
      return 0;
    }

    const start = Number.parseInt(raw, 10);
    return Number.isFinite(start) && start > 0 ? start : 0;
  } catch {
    return 0;
  }
}

export function isLinkedInPaginationLoop(
  requestUrl: string,
  finalUrl: string | undefined,
): boolean {
  const requested = readLinkedInStartParam(requestUrl);
  if (requested <= 0) {
    return false;
  }

  return readLinkedInStartParam(finalUrl ?? requestUrl) === 0;
}
