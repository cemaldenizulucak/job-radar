import { isIP } from 'node:net';

import { BadRequestException } from '@nestjs/common';

import type { SourceId } from '../common/domain.types.js';
import type { MatchableJob } from '../matching/matching.types.js';

const ALLOWED_REGISTRABLE_DOMAINS = ['kariyer.net', 'linkedin.com'] as const;

/**
 * Parses a user-supplied listing URL for catalog lookup only.
 * Never fetches and therefore never follows redirects.
 */
export function parseDiagnosisListingUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new BadRequestException('Listing URL is invalid.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BadRequestException('Listing URL is invalid.');
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException('Listing URL must use https.');
  }

  if (url.username || url.password) {
    throw new BadRequestException('Listing URL must not include credentials.');
  }

  if (url.port && url.port !== '443') {
    throw new BadRequestException('Listing URL host is not allowed.');
  }

  const host = normalizeHostname(url.hostname);
  if (
    !host ||
    isIP(host) !== 0 ||
    hostnameIsBlocked(host) ||
    !isAllowedDiagnosisHost(host)
  ) {
    throw new BadRequestException('Listing URL host is not allowed.');
  }

  return url;
}

export function listingMatchesDiagnosisTarget(
  job: Pick<MatchableJob, 'sourceId' | 'sourceJobId' | 'canonicalUrl'>,
  input: {
    sourceId?: SourceId;
    sourceJobId?: string;
    url?: string;
    parsedUrl?: URL | null;
  },
): boolean {
  if (input.sourceId && job.sourceId !== input.sourceId) {
    return false;
  }

  if (input.sourceJobId && job.sourceJobId === input.sourceJobId) {
    return true;
  }

  const requested = input.parsedUrl ?? null;
  if (requested && listingUrlsMatch(job.canonicalUrl, requested)) {
    return true;
  }

  return false;
}

export function listingUrlsMatch(
  stored: string | null | undefined,
  requested: URL,
): boolean {
  if (!stored) {
    return false;
  }

  if (stored === requested.href) {
    return true;
  }

  try {
    const storedUrl = new URL(stored);
    return (
      storedUrl.protocol === requested.protocol &&
      normalizeHostname(storedUrl.hostname) ===
        normalizeHostname(requested.hostname) &&
      storedUrl.pathname === requested.pathname &&
      storedUrl.search === requested.search
    );
  } catch {
    return false;
  }
}

function isAllowedDiagnosisHost(hostname: string): boolean {
  return ALLOWED_REGISTRABLE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function hostnameIsBlocked(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    return true;
  }

  return false;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}
