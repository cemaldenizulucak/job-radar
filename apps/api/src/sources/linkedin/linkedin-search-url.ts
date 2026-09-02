import type { WorkModel } from '../../common/domain.types.js';
import { DEFAULT_JOB_SOURCE_MAX_AGE_DAYS } from '../../discovery/discovery-window.js';
import type { LinkedInSearchInput } from './linkedin.types.js';
import {
  LINKEDIN_DEFAULT_BASE_URL,
  LINKEDIN_PAGE_SIZE,
} from './linkedin-web.config.js';

const SECONDS_PER_DAY = 86_400;

const WORKPLACE_FILTER: Partial<Record<WorkModel, string>> = {
  onsite: '1',
  remote: '2',
  hybrid: '3',
};

/**
 * Builds a public LinkedIn guest job-search URL.
 * keywords → `keywords`, first location → `location`,
 * max-age → `f_TPR=r{seconds}`, date-sorted `sortBy=DD`,
 * a single workplace type → `f_WT`.
 * Experience is not encoded. Pagination uses `start` (25 results per page).
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

  const workplace = workplaceFilter(input.workTypes);
  url.searchParams.set('sortBy', 'DD');

  if (workplace) {
    url.searchParams.set('f_WT', workplace);
  }

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

export function workplaceFilter(
  workTypes: readonly WorkModel[],
): string | null {
  const distinct = [...new Set(workTypes.filter((model) => model !== 'unknown'))];
  if (distinct.length !== 1) {
    return null;
  }

  const code = WORKPLACE_FILTER[distinct[0] ?? 'unknown'];
  return code ?? null;
}

function originFromBase(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return LINKEDIN_DEFAULT_BASE_URL;
  }
}
