export const LINKEDIN_DEFAULT_BASE_URL = 'https://www.linkedin.com';
export const LINKEDIN_DEFAULT_TIMEOUT_MS = 10_000;
export const LINKEDIN_DEFAULT_DELAY_MS = 1_000;
export const LINKEDIN_MAX_RETRIES = 1;
export const LINKEDIN_DEFAULT_MAX_PAGES = 5;
export const LINKEDIN_PAGE_SIZE = 25;
export const LINKEDIN_USER_AGENT =
  'JobRadar/1.0 (personal private job digest; low-volume)';

export type LinkedInWebConfig = {
  baseUrl: string;
  timeoutMs: number;
  delayMs: number;
  maxRetries: number;
  maxPages: number;
  pageSize: number;
  userAgent: string;
};

export function readLinkedInWebConfig(env: {
  get(key: string): string | undefined;
}): LinkedInWebConfig {
  return {
    baseUrl: readBaseUrl(env.get('LINKEDIN_BASE_URL')),
    timeoutMs: readPositiveInt(
      env.get('LINKEDIN_REQUEST_TIMEOUT_MS'),
      LINKEDIN_DEFAULT_TIMEOUT_MS,
    ),
    delayMs: readNonNegativeInt(
      env.get('LINKEDIN_REQUEST_DELAY_MS'),
      LINKEDIN_DEFAULT_DELAY_MS,
    ),
    maxRetries: LINKEDIN_MAX_RETRIES,
    maxPages: Math.min(
      10,
      readPositiveInt(env.get('LINKEDIN_MAX_PAGES'), LINKEDIN_DEFAULT_MAX_PAGES),
    ),
    pageSize: LINKEDIN_PAGE_SIZE,
    userAgent: LINKEDIN_USER_AGENT,
  };
}

function readBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return LINKEDIN_DEFAULT_BASE_URL;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return LINKEDIN_DEFAULT_BASE_URL;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return LINKEDIN_DEFAULT_BASE_URL;
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
