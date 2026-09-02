import type { WorkModel } from '../../common/domain.types.js';
import { normalizeText } from '../../common/normalize-text.js';
import type { NormalizedJob } from '../../jobs/jobs.types.js';
import type { LinkedInRawJob } from './linkedin.types.js';
import { parseLinkedInPublishedAt } from './linkedin-published-at.js';

export type LinkedInNormalizedJob = NormalizedJob;

export function normalizeLinkedInJob(
  raw: LinkedInRawJob,
): LinkedInNormalizedJob | null {
  if (linkedInNormalizeRejectionReasons(raw).length > 0) {
    return null;
  }

  const sourceJobId = readIdentity(raw.externalJobId);
  const canonicalUrl = readTrimmedString(raw.canonicalUrl);
  const title = readTrimmedString(raw.title);
  const companyName = readTrimmedString(raw.companyName);

  if (!sourceJobId || !canonicalUrl || !title || !companyName) {
    return null;
  }

  return {
    sourceId: 'linkedin',
    sourceJobId,
    canonicalUrl,
    title,
    companyName,
    titleNormalized: normalizeText(title),
    companyNormalized: normalizeText(companyName),
    description: readTrimmedString(raw.description),
    location: readTrimmedString(raw.location),
    workModel: readWorkModel(raw.workModel),
    experienceLevel: readTrimmedString(raw.experienceLevel),
    technologies: [],
    publishedAt: parseLinkedInPublishedAt(raw.publishedAt),
    isActive: true,
  };
}

export function linkedInNormalizeRejectionReasons(raw: LinkedInRawJob): string[] {
  const reasons: string[] = [];
  const sourceJobId = readIdentity(raw.externalJobId);
  const canonicalUrl = readTrimmedString(raw.canonicalUrl);
  const title = readTrimmedString(raw.title);
  const companyName = readTrimmedString(raw.companyName);

  if (!title) {
    reasons.push('missing title');
  }

  if (!companyName) {
    reasons.push('missing companyName');
  }

  if (!canonicalUrl) {
    reasons.push('missing canonicalUrl');
  } else if (!isHttpUrl(canonicalUrl)) {
    reasons.push('invalid URL');
  }

  if (!sourceJobId) {
    reasons.push('missing LinkedIn job id');
  }

  return reasons;
}

function readIdentity(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return readTrimmedString(value);
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readWorkModel(value: unknown): WorkModel | null {
  const raw = readTrimmedString(value)?.toLocaleLowerCase();
  if (!raw) {
    return null;
  }

  if (raw === 'remote' || raw === 'work from home') {
    return 'remote';
  }

  if (raw === 'hybrid') {
    return 'hybrid';
  }

  if (raw === 'onsite' || raw === 'on-site' || raw === 'on site') {
    return 'onsite';
  }

  if (raw === 'unknown') {
    return 'unknown';
  }

  return null;
}
