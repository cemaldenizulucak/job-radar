import type {
  LinkedInPaginationStopReason,
  LinkedInRawJob,
} from './linkedin.types.js';

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

  void input.maxAgeDays;
  void input.now;

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
