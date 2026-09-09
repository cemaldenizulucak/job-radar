import { BadRequestException } from '@nestjs/common';

import {
  assertAllowedJobSourceUrl,
  isAllowedJobSourceHost,
} from '../common/job-source-url.js';
import type { SourceId } from '../common/domain.types.js';
import type { MatchableJob } from '../matching/matching.types.js';

/**
 * Parses a user-supplied listing URL for catalog lookup only.
 * Never fetches and therefore never follows redirects.
 */
export function parseDiagnosisListingUrl(raw: string): URL {
  try {
    return assertAllowedJobSourceUrl(raw);
  } catch {
    throw new BadRequestException('Listing URL host is not allowed.');
  }
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
      storedUrl.hostname.toLowerCase() === requested.hostname.toLowerCase() &&
      storedUrl.pathname === requested.pathname &&
      storedUrl.search === requested.search
    );
  } catch {
    return false;
  }
}

export { isAllowedJobSourceHost };
