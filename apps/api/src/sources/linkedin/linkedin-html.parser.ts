import type { LinkedInRawJob } from './linkedin.types.js';
import {
  canonicalizeLinkedInJobUrl,
  extractLinkedInJobId,
} from './linkedin-listing-id.js';
import { LINKEDIN_DEFAULT_BASE_URL } from './linkedin-web.config.js';

const CARD_OPEN_PATTERN =
  /<div\b[^>]*(?:class\s*=\s*["'][^"']*\bjob-search-card\b[^"']*["']|data-entity-urn\s*=\s*["']urn:li:jobPosting:)[^>]*>/gi;
const JOB_ANCHOR_PATTERN =
  /<a\b[^>]*href\s*=\s*["']([^"']*(?:\/jobs\/view\/|\?[^"']*currentJobId=)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const JSON_LD_PATTERN =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const TITLE_PATTERN =
  /class\s*=\s*["'][^"']*\b(?:base-search-card__title|job-search-card__title)[^"']*["'][^>]*>([\s\S]*?)<\//i;
const SUBTITLE_PATTERN =
  /class\s*=\s*["'][^"']*\b(?:base-search-card__subtitle|job-search-card__subtitle)[^"']*["'][^>]*>([\s\S]*?)<\//i;
const LOCATION_PATTERN =
  /class\s*=\s*["'][^"']*\bjob-search-card__location\b[^"']*["'][^>]*>([\s\S]*?)<\//i;
const SNIPPET_PATTERN =
  /class\s*=\s*["'][^"']*\bjob-search-card__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\//i;
const TIME_PATTERN = /<time\b([^>]*)>([\s\S]*?)<\/time\s*>/i;
const TIME_DATETIME_PATTERN = /datetime\s*=\s*["']([^"']+)["']/i;
const WORKPLACE_PATTERN =
  /class\s*=\s*["'][^"']*\b(?:job-search-card__workplace-type|workplace-type)[^"']*["'][^>]*>([\s\S]*?)<\//i;
const URN_PATTERN = /urn:li:jobPosting:(\d{6,})/i;
const SKIP_TITLE_PATTERN =
  /^(see more|view job|apply|details?|sign in|join now)$/i;
const CHALLENGE_PATTERN =
  /authwall|checkpoint\/challenge|captcha|just a moment|unusual activity|security verification|access denied|enable javascript|bot detection|we.?ve detected unusual/i;
const EMPTY_RESULTS_PATTERN =
  /no matching jobs found|we couldn.?t find a match|0 results/i;
const LOGIN_PATH_PATTERN = /\/(?:login|uas\/login|checkpoint|authwall)\b/i;

export type LinkedInHtmlParseResult =
  | { kind: 'jobs'; jobs: LinkedInRawJob[] }
  | { kind: 'blocked'; reason: 'challenge' }
  | { kind: 'mismatch'; reason: string };

export function parseLinkedInSearchHtml(
  html: string,
  baseUrl = LINKEDIN_DEFAULT_BASE_URL,
): LinkedInHtmlParseResult {
  if (html.trim().length === 0) {
    return { kind: 'mismatch', reason: 'LinkedIn returned an empty document.' };
  }

  if (looksLikeChallenge(html)) {
    return { kind: 'blocked', reason: 'challenge' };
  }

  const fromJsonLd = extractJobsFromJsonLd(html, baseUrl);
  const fromCards = extractJobsFromCards(html, baseUrl);
  const fromAnchors = extractJobsFromAnchors(html, baseUrl);
  const jobs = mergeJobs(fromJsonLd, fromCards, fromAnchors);

  if (jobs.length > 0) {
    return { kind: 'jobs', jobs };
  }

  if (
    EMPTY_RESULTS_PATTERN.test(html) ||
    html.includes('/jobs/search') ||
    html.includes('/jobs/view/')
  ) {
    return { kind: 'jobs', jobs: [] };
  }

  return {
    kind: 'mismatch',
    reason: 'LinkedIn HTML did not contain parseable job listings.',
  };
}

export function looksLikeLinkedInLoginUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    return LOGIN_PATH_PATTERN.test(new URL(url).pathname);
  } catch {
    return LOGIN_PATH_PATTERN.test(url);
  }
}

function looksLikeChallenge(html: string): boolean {
  if (!CHALLENGE_PATTERN.test(html)) {
    return false;
  }

  return !URN_PATTERN.test(html) && !/\/jobs\/view\/\d{6,}/i.test(html);
}

function extractJobsFromCards(html: string, baseUrl: string): LinkedInRawJob[] {
  const opens = [...html.matchAll(new RegExp(CARD_OPEN_PATTERN.source, 'gi'))];
  if (opens.length === 0) {
    return [];
  }

  const jobs: LinkedInRawJob[] = [];

  for (let index = 0; index < opens.length; index += 1) {
    const match = opens[index];
    if (!match || match.index === undefined) {
      continue;
    }

    const nextIndex = opens[index + 1]?.index;
    const cardHtml = html.slice(match.index, nextIndex ?? match.index + 8_000);
    const job = jobFromCard(cardHtml, match[0] ?? '', baseUrl);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

function extractJobsFromAnchors(
  html: string,
  baseUrl: string,
): LinkedInRawJob[] {
  const jobs: LinkedInRawJob[] = [];
  const anchorRegex = new RegExp(JOB_ANCHOR_PATTERN.source, 'gi');

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const inner = match[2] ?? '';
    if (!href) {
      continue;
    }

    const innerTitle = decodeHtmlFragment(inner);
    const job = jobFromWindow(inner, href, '', baseUrl, {
      title: usableAnchorTitle(innerTitle),
    });
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

function extractJobsFromJsonLd(
  html: string,
  baseUrl: string,
): LinkedInRawJob[] {
  const jobs: LinkedInRawJob[] = [];
  const scriptRegex = new RegExp(JSON_LD_PATTERN.source, 'gi');

  for (const match of html.matchAll(scriptRegex)) {
    const raw = match[1];
    if (!raw) {
      continue;
    }

    try {
      collectJsonLdJobs(JSON.parse(decodeJsonLd(raw)), jobs, baseUrl);
    } catch {
      continue;
    }
  }

  return jobs;
}

function collectJsonLdJobs(
  value: unknown,
  jobs: LinkedInRawJob[],
  baseUrl: string,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdJobs(item, jobs, baseUrl);
    }
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  const type = record['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
    const url = readJsonString(record.url) ?? readJsonString(record['@id']);
    const job = jobFromWindow(
      '',
      url ?? '',
      '',
      baseUrl,
      {
        title: readJsonString(record.title),
        companyName: organizationName(record.hiringOrganization),
        location: placeName(record.jobLocation),
        description: readJsonString(record.description),
        publishedAt: readJsonString(record.datePosted),
      },
    );
    if (job) {
      jobs.push(job);
    }
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      collectJsonLdJobs(nested, jobs, baseUrl);
    }
  }
}

function jobFromCard(
  cardHtml: string,
  openTag: string,
  baseUrl: string,
): LinkedInRawJob | null {
  const href = firstListingHref(cardHtml);
  const urnId = openTag.match(URN_PATTERN)?.[1] ?? cardHtml.match(URN_PATTERN)?.[1];
  return jobFromWindow(cardHtml, href ?? '', openTag, baseUrl, {
    externalJobId: urnId,
    title: firstCapture(TITLE_PATTERN, cardHtml),
    companyName: firstCapture(SUBTITLE_PATTERN, cardHtml),
    location: firstCapture(LOCATION_PATTERN, cardHtml),
    description: firstCapture(SNIPPET_PATTERN, cardHtml),
    publishedAt: readTime(cardHtml),
    workModel: firstCapture(WORKPLACE_PATTERN, cardHtml) ?? inferWorkModel(cardHtml),
  });
}

function jobFromWindow(
  windowHtml: string,
  href: string,
  openTag: string,
  baseUrl: string,
  extras: Partial<LinkedInRawJob> = {},
): LinkedInRawJob | null {
  const fromHref = extractLinkedInJobId(href);
  const fromWindow = extractLinkedInJobId(windowHtml) ?? extractLinkedInJobId(openTag);
  const externalJobId =
    readString(extras.externalJobId) ?? fromHref ?? fromWindow ?? null;
  if (!externalJobId) {
    return null;
  }

  const canonicalUrl =
    canonicalizeLinkedInJobUrl(href, baseUrl) ??
    canonicalizeLinkedInJobUrl(externalJobId, baseUrl);
  if (!canonicalUrl) {
    return null;
  }

  const title = readString(extras.title);
  if (title && SKIP_TITLE_PATTERN.test(title)) {
    return {
      externalJobId,
      canonicalUrl,
      title: undefined,
      companyName: readString(extras.companyName),
      location: readString(extras.location),
      workModel: readString(extras.workModel),
      description: readString(extras.description),
      publishedAt: readString(extras.publishedAt),
    };
  }

  return {
    externalJobId,
    canonicalUrl,
    title,
    companyName: readString(extras.companyName),
    location: readString(extras.location),
    workModel: readString(extras.workModel),
    description: readString(extras.description),
    publishedAt: readString(extras.publishedAt),
  };
}

function firstListingHref(html: string): string | undefined {
  const match = new RegExp(JOB_ANCHOR_PATTERN.source, 'i').exec(html);
  return match?.[1];
}

function readTime(html: string): string | undefined {
  const match = html.match(TIME_PATTERN);
  if (!match) {
    return undefined;
  }

  const datetime = match[1]?.match(TIME_DATETIME_PATTERN)?.[1]?.trim();
  if (datetime) {
    return datetime;
  }

  const inner = decodeHtmlFragment(match[2] ?? '');
  return inner.length > 0 ? inner : undefined;
}

function usableAnchorTitle(value: string): string | undefined {
  if (value.length === 0 || value.length > 200 || SKIP_TITLE_PATTERN.test(value)) {
    return undefined;
  }

  return value;
}

function inferWorkModel(html: string): string | undefined {
  const location = firstCapture(LOCATION_PATTERN, html)?.toLowerCase();
  if (location === 'remote') {
    return 'remote';
  }

  return undefined;
}

function mergeJobs(
  ...groups: readonly LinkedInRawJob[][]
): LinkedInRawJob[] {
  const merged = new Map<string, LinkedInRawJob>();

  for (const group of groups) {
    for (const job of group) {
      const id = readString(job.externalJobId);
      if (!id) {
        continue;
      }

      const current = merged.get(id);
      merged.set(id, current ? fillJob(current, job) : job);
    }
  }

  return [...merged.values()];
}

function fillJob(
  current: LinkedInRawJob,
  incoming: LinkedInRawJob,
): LinkedInRawJob {
  return {
    externalJobId: current.externalJobId ?? incoming.externalJobId,
    canonicalUrl: current.canonicalUrl ?? incoming.canonicalUrl,
    title: current.title ?? incoming.title,
    companyName: current.companyName ?? incoming.companyName,
    location: current.location ?? incoming.location,
    workModel: current.workModel ?? incoming.workModel,
    description: current.description ?? incoming.description,
    publishedAt: current.publishedAt ?? incoming.publishedAt,
    experienceLevel: current.experienceLevel ?? incoming.experienceLevel,
  };
}

function firstCapture(pattern: RegExp, html: string): string | undefined {
  const match = html.match(pattern);
  const captured = match?.[1];
  const decoded = captured ? decodeHtmlFragment(captured) : '';
  return decoded.length > 0 ? decoded : undefined;
}

function decodeJsonLd(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function decodeHtmlFragment(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readJsonString(value: unknown): string | undefined {
  return readString(value);
}

function organizationName(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return readString(value);
  }

  if (typeof value === 'object' && value !== null) {
    return readString((value as Record<string, unknown>).name);
  }

  return undefined;
}

function placeName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return placeName(value[0]);
  }

  if (typeof value === 'string') {
    return readString(value);
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const address = record.address;
    if (typeof address === 'object' && address !== null) {
      const addressRecord = address as Record<string, unknown>;
      return (
        readString(addressRecord.addressLocality) ??
        readString(addressRecord.name)
      );
    }

    return readString(record.name);
  }

  return undefined;
}
