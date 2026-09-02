import { Logger } from '@nestjs/common';

import type { KariyerNetProviderMode, KariyerNetRawJob } from './kariyer-net.types.js';

const logger = new Logger('KariyerNetDiscovery');

export type KariyerNetJobPreview = {
  title: string | null;
  company: string | null;
  canonicalUrl: string | null;
  externalJobId: string | null;
};

export function isKariyerNetDevLogEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'production' && nodeEnv !== 'test';
}

export function previewKariyerNetJobs(
  jobs: readonly KariyerNetRawJob[],
): KariyerNetJobPreview[] {
  return jobs.slice(0, 3).map((job) => ({
    title: previewField(job.title),
    company: previewField(job.companyName),
    canonicalUrl: previewField(job.canonicalUrl),
    externalJobId: previewField(job.externalJobId),
  }));
}

export function describeKariyerNetRawJob(raw: KariyerNetRawJob): {
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

export function logKariyerNetDiscoveryStart(input: {
  mode: KariyerNetProviderMode;
  requestUrl: string | null;
  savedSearchId: string | null;
  keywords: readonly string[];
  locations: readonly string[];
}): void {
  logKariyerNetDev({
    message: `Kariyer.net provider=${input.mode}`,
    providerMode: input.mode,
    requestUrl: input.requestUrl,
    savedSearchId: input.savedSearchId,
    keywords: [...input.keywords],
    locations: [...input.locations],
  });
}

export function logKariyerNetDev(payload: Record<string, unknown>): void {
  if (!isKariyerNetDevLogEnabled()) {
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
