import { DEFAULT_JOB_SOURCE_MAX_AGE_DAYS } from '../../discovery/discovery-window.js';
import type { LinkedInSearchInput } from './linkedin.types.js';
import {
  LINKEDIN_DEFAULT_BASE_URL,
  LINKEDIN_PAGE_SIZE,
} from './linkedin-web.config.js';

const SECONDS_PER_DAY = 86_400;

/**
 * Builds a public LinkedIn guest job-search URL.
 * keywords → `keywords`, first location → `location`,
 * max-age → `f_TPR=r{seconds}`, date-sorted `sortBy=DD`.
 * Workplace type is not encoded. Experience is not encoded.
 * Pagination uses `start` (25 results per page).
 */
export function buildLinkedInSearchUrl(
  input: LinkedInSearchInput,
  baseUrl = LINKEDIN_DEFAULT_BASE_URL,
  page = 1,
  pageSize = LINKEDIN_PAGE_SIZE,
): string {
  const origin = originFromBase(baseUrl);
  const url = new URL('/jobs/search/', origin);
  const keyword = input.keywords.map((value) => value.trim()).filter(Boolean).join(' ');
  if (keyword.length > 0) {
    url.searchParams.set('keywords', keyword);
  }

  const location = input.locations.map((value) => value.trim()).find((value) => value.length > 0);
  if (location) {
    url.searchParams.set('location', location);
  }

  const postedSeconds = postedSecondsForMaxAge(input.maxAgeDays);
  if (postedSeconds) {
    url.searchParams.set('f_TPR', `r${postedSeconds}`);
  }

  url.searchParams.set('sortBy', 'DD');

  if (page > 1) {
    url.searchParams.set('start', String((page - 1) * pageSize));
  }

  return url.toString();
}

export function postedSecondsForMaxAge(
  maxAgeDays: number | undefined,
): number | null {
  const days = maxAgeDays ?? DEFAULT_JOB_SOURCE_MAX_AGE_DAYS;
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }

  return Math.trunc(days) * SECONDS_PER_DAY;
}

function originFromBase(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return LINKEDIN_DEFAULT_BASE_URL;
  }
}
