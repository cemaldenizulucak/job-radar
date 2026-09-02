import { createHash } from 'node:crypto';

import { KARIYER_NET_DEFAULT_BASE_URL } from './kariyer-net-web.config.js';

const LISTING_PATH_PATTERN = /\/is-ilani\/([^/?#]+)/i;
const TRAILING_ID_PATTERN = /(\d{5,})$/;

export function canonicalizeKariyerNetJobUrl(
  rawUrl: string,
  baseUrl = KARIYER_NET_DEFAULT_BASE_URL,
): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed, `${originFromBase(baseUrl)}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

export function extractKariyerNetListingId(rawUrl: string): string | null {
  const canonical = canonicalizeKariyerNetJobUrl(rawUrl);
  if (!canonical) {
    return null;
  }

  const pathMatch = canonical.match(LISTING_PATH_PATTERN);
  const slug = pathMatch?.[1];
  if (!slug) {
    return null;
  }

  const idMatch = slug.match(TRAILING_ID_PATTERN);
  return idMatch?.[1] ?? (/^\d{5,}$/.test(slug) ? slug : null);
}

export function resolveKariyerNetExternalId(rawUrl: string): string | null {
  const canonical = canonicalizeKariyerNetJobUrl(rawUrl);
  if (!canonical) {
    return null;
  }

  return extractKariyerNetListingId(canonical) ?? fallbackIdFromCanonicalUrl(canonical);
}

export function fallbackIdFromCanonicalUrl(canonicalUrl: string): string {
  const digest = createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 16);
  return `kn-url-${digest}`;
}

function originFromBase(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return KARIYER_NET_DEFAULT_BASE_URL;
  }
}
