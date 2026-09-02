import type { WorkModel } from '../../common/domain.types.js';
import { normalizeText } from '../../common/normalize-text.js';
import type { NormalizedJob } from '../../jobs/jobs.types.js';
import type { KariyerNetRawJob } from './kariyer-net.types.js';
import { parseKariyerNetPublishedAt } from './kariyer-net-published-at.js';

export type KariyerNetNormalizedJob = NormalizedJob & {
  employmentType: string | null;
};

const COMPANY_REQUIRED_REASON =
  'missing companyName (required by NormalizedJob; listing pages may omit it)';

export function normalizeKariyerNetJob(
  raw: KariyerNetRawJob,
): KariyerNetNormalizedJob | null {
  const sourceJobId = readIdentity(raw.externalJobId);
  const canonicalUrl = readTrimmedString(raw.canonicalUrl);
  const title = readTrimmedString(raw.title);
  const companyName = readTrimmedString(raw.companyName);

  if (kariyerNetNormalizeRejectionReasons(raw).length > 0) {
    return null;
  }

  if (!sourceJobId || !canonicalUrl || !title || !companyName) {
    return null;
  }

  return {
    sourceId: 'kariyer_net',
    sourceJobId,
    canonicalUrl,
    title,
    companyName,
    titleNormalized: normalizeText(title),
    companyNormalized: normalizeText(companyName),
    description: readTrimmedString(raw.description),
    location: readTrimmedString(raw.location),
    workModel: readWorkModel(raw.workModel),
    employmentType: readTrimmedString(raw.employmentType),
    experienceLevel: readTrimmedString(raw.experienceLevel),
    technologies: readStringArray(raw.technologies),
    publishedAt: parseKariyerNetPublishedAt(raw.publishedAt),
    isActive: true,
  };
}

export function kariyerNetNormalizeRejectionReasons(
  raw: KariyerNetRawJob,
): string[] {
  const reasons: string[] = [];
  const sourceJobId = readIdentity(raw.externalJobId);
  const canonicalUrl = readTrimmedString(raw.canonicalUrl);
  const title = readTrimmedString(raw.title);
  const companyName = readTrimmedString(raw.companyName);

  if (!title) {
    reasons.push('missing title');
  }

  if (!companyName) {
    reasons.push(COMPANY_REQUIRED_REASON);
  }

  if (!canonicalUrl) {
    reasons.push('missing canonicalUrl');
  } else if (!isHttpUrl(canonicalUrl)) {
    reasons.push('invalid URL');
  }

  if (!sourceJobId) {
    reasons.push('missing external id');
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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

  if (raw === 'remote' || raw === 'uzaktan' || raw === 'remote / home office') {
    return 'remote';
  }

  if (raw === 'hybrid' || raw === 'hibrit' || raw === 'hybrid / hibrit') {
    return 'hybrid';
  }

  if (
    raw === 'onsite' ||
    raw === 'on-site' ||
    raw === 'iş yerinde' ||
    raw === 'is yerinde' ||
    raw === 'ofiste'
  ) {
    return 'onsite';
  }

  if (raw === 'unknown') {
    return 'unknown';
  }

  return null;
}
