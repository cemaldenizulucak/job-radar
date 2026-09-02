import { Logger } from '@nestjs/common';

import type { LinkedInProviderMode, LinkedInRawJob } from './linkedin.types.js';

const logger = new Logger('LinkedInDiscovery');

export type LinkedInJobPreview = {
  title: string | null;
  company: string | null;
  canonicalUrl: string | null;
  externalJobId: string | null;
  publishedAt: string | null;
};

export function isLinkedInDevLogEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'production' && nodeEnv !== 'test';
}

export function previewLinkedInJobs(
  jobs: readonly LinkedInRawJob[],
): LinkedInJobPreview[] {
  return jobs.slice(0, 3).map((job) => ({
    title: previewField(job.title),
    company: previewField(job.companyName),
    canonicalUrl: previewField(job.canonicalUrl),
    externalJobId: previewField(job.externalJobId),
    publishedAt: previewField(job.publishedAt),
  }));
}

export function describeLinkedInRawJob(raw: LinkedInRawJob): {
  keys: string[];
  titleCandidate: string | null;
  companyCandidate: string | null;
  urlCandidate: string | null;
  locationCandidate: string | null;
  externalIdCandidate: string | null;
} {
  return {
    keys: Object.keys(raw).sort(),
    titleCandidate: previewField(raw.title),
    companyCandidate: previewField(raw.companyName),
    urlCandidate: previewField(raw.canonicalUrl),
    locationCandidate: previewField(raw.location),
    externalIdCandidate: previewField(raw.externalJobId),
  };
}

export function logLinkedInDiscoveryStart(input: {
  mode: LinkedInProviderMode;
  requestUrl: string | null;
  savedSearchId: string | null;
  keywords: readonly string[];
  locations: readonly string[];
}): void {
  logLinkedInDev({
    message: `LinkedIn provider=${input.mode}`,
    providerMode: input.mode,
    requestUrl: input.requestUrl,
    savedSearchId: input.savedSearchId,
    keywords: [...input.keywords],
    locations: [...input.locations],
  });
}

export function logLinkedInDev(payload: Record<string, unknown>): void {
  if (!isLinkedInDevLogEnabled()) {
    return;
  }

  logger.log(payload);
}

function previewField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
