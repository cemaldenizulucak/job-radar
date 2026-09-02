import { LINKEDIN_DEFAULT_BASE_URL } from './linkedin-web.config.js';

const JOB_VIEW_ID_PATTERN =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/(?:[a-z]{2}\/)?(?:comm\/)?jobs\/view\/(?:[^/?#]*-)?(\d{6,})/i;
const RELATIVE_JOB_VIEW_PATTERN =
  /(?:^|\/)(?:[a-z]{2}\/)?jobs\/view\/(?:[^/?#]*-)?(\d{6,})/i;
const CURRENT_JOB_ID_PATTERN = /[?&]currentJobId=(\d{6,})/i;
const URN_PATTERN = /urn:li:jobPosting:(\d{6,})/i;

export function extractLinkedInJobId(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const urn = trimmed.match(URN_PATTERN)?.[1];
  if (urn) {
    return urn;
  }

  const currentJobId = trimmed.match(CURRENT_JOB_ID_PATTERN)?.[1];
  if (currentJobId) {
    return currentJobId;
  }

  const fromAbsolute = trimmed.match(JOB_VIEW_ID_PATTERN)?.[1];
  if (fromAbsolute) {
    return fromAbsolute;
  }

  const fromRelative = trimmed.match(RELATIVE_JOB_VIEW_PATTERN)?.[1];
  return fromRelative ?? null;
}

export function canonicalizeLinkedInJobUrl(
  rawUrl: string,
  baseUrl = LINKEDIN_DEFAULT_BASE_URL,
): string | null {
  const jobId = extractLinkedInJobId(rawUrl);
  if (jobId) {
    return `https://www.linkedin.com/jobs/view/${jobId}`;
  }

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

export function resolveLinkedInExternalId(rawUrl: string): string | null {
  return extractLinkedInJobId(rawUrl);
}

function originFromBase(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return LINKEDIN_DEFAULT_BASE_URL;
  }
}
