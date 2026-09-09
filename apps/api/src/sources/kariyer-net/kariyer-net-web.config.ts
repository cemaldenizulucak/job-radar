import { isKariyerNetDebugHtmlEnabled } from './kariyer-net-debug-html.js';

export const KARIYER_NET_DEFAULT_BASE_URL = 'https://www.kariyer.net';
export const KARIYER_NET_DEFAULT_TIMEOUT_MS = 10_000;
export const KARIYER_NET_DEFAULT_DELAY_MS = 750;
export const KARIYER_NET_MAX_RETRIES = 1;
export const KARIYER_NET_MAX_JOBS_PER_SEARCH = 25;
export const KARIYER_NET_DEFAULT_MAX_PAGES = 10;
export const KARIYER_NET_DEFAULT_MAX_DETAIL_REQUESTS = 8;
export const KARIYER_NET_USER_AGENT =
  'JobRadar/1.0 (personal private job digest; low-volume)';

export type KariyerNetWebConfig = {
  baseUrl: string;
  timeoutMs: number;
  delayMs: number;
  maxRetries: number;
  maxJobsPerSearch: number;
  maxPages: number;
  maxDetailRequests: number;
  userAgent: string;
  debugHtml: boolean;
};

export function readKariyerNetWebConfig(env: {
  get(key: string): string | undefined;
}): KariyerNetWebConfig {
  return {
    baseUrl: readBaseUrl(env.get('KARIYER_NET_BASE_URL')),
    timeoutMs: readPositiveInt(
      env.get('KARIYER_NET_REQUEST_TIMEOUT_MS'),
      KARIYER_NET_DEFAULT_TIMEOUT_MS,
    ),
    delayMs: readNonNegativeInt(
      env.get('KARIYER_NET_REQUEST_DELAY_MS'),
      KARIYER_NET_DEFAULT_DELAY_MS,
    ),
    maxRetries: KARIYER_NET_MAX_RETRIES,
    maxJobsPerSearch: KARIYER_NET_MAX_JOBS_PER_SEARCH,
    maxPages: Math.min(
      20,
      readPositiveInt(env.get('KARIYER_NET_MAX_PAGES'), KARIYER_NET_DEFAULT_MAX_PAGES),
    ),
    maxDetailRequests: Math.min(
      25,
      readPositiveInt(
        env.get('KARIYER_NET_MAX_DETAIL_REQUESTS'),
        KARIYER_NET_DEFAULT_MAX_DETAIL_REQUESTS,
      ),
    ),
    userAgent: KARIYER_NET_USER_AGENT,
    debugHtml: isKariyerNetDebugHtmlEnabled(env.get('KARIYER_NET_DEBUG_HTML')),
  };
}

function readBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return KARIYER_NET_DEFAULT_BASE_URL;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return KARIYER_NET_DEFAULT_BASE_URL;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return KARIYER_NET_DEFAULT_BASE_URL;
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
