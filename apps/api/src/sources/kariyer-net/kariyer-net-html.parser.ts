import type { KariyerNetRawJob } from './kariyer-net.types.js';
import {
  canonicalizeKariyerNetJobUrl,
  resolveKariyerNetExternalId,
} from './kariyer-net-listing-id.js';
import { KARIYER_NET_DEFAULT_BASE_URL } from './kariyer-net-web.config.js';

const JOB_ANCHOR_PATTERN =
  /<a\b[^>]*href\s*=\s*["']([^"']*\/is-ilani\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const AD_CARD_OPEN_PATTERN =
  /<div\b[^>]*\bdata-test\s*=\s*["']ad-card["'][^>]*>/gi;
const JSON_LD_PATTERN =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const COMPANY_NEARBY_PATTERN =
  /data-company\s*=\s*["']([^"']+)["']|itemprop\s*=\s*["']hiringOrganization["'][^>]*>([\s\S]*?)<|class\s*=\s*["'][^"']*\bcompany\b[^"']*["'][^>]*>([\s\S]*?)</i;
const LOCATION_NEARBY_PATTERN =
  /data-location\s*=\s*["']([^"']+)["']|itemprop\s*=\s*["']jobLocation["'][^>]*>([\s\S]*?)<|class\s*=\s*["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)</i;
const WORK_MODEL_NEARBY_PATTERN =
  /data-work-model\s*=\s*["']([^"']+)["']|class\s*=\s*["'][^"']*\bwork-model\b[^"']*["'][^>]*>([\s\S]*?)</i;
const EMPLOYMENT_NEARBY_PATTERN =
  /data-employment-type\s*=\s*["']([^"']+)["']/i;
const PUBLISHED_NEARBY_PATTERN =
  /data-published-at\s*=\s*["']([^"']+)["']|itemprop\s*=\s*["']datePosted["'][^>]*content\s*=\s*["']([^"']+)["']/i;
const COMPANY_IMAGE_PATTERN =
  /<img\b[^>]*\bdata-test\s*=\s*["']company-image["'][^>]*>/i;

const SKIP_TITLE_PATTERN =
  /^(incele|detay|başvur|basvur|daha fazla|view|apply|details?)$/i;

const CHALLENGE_PATTERN =
  /güvenlik doğrulaması|guvenlik dogrulamasi|captcha|cf-challenge|just a moment|access denied|bot detection/i;
const EMPTY_RESULTS_PATTERN =
  /ilan bulunamad[ıi]|sonuç bulunamad[ıi]|sonuc bulunamadi|no jobs? found/i;

export type KariyerNetHtmlParseResult =
  | { kind: 'jobs'; jobs: KariyerNetRawJob[] }
  | { kind: 'blocked'; reason: 'challenge' }
  | { kind: 'mismatch'; reason: string };

export function parseKariyerNetSearchHtml(
  html: string,
  baseUrl = KARIYER_NET_DEFAULT_BASE_URL,
): KariyerNetHtmlParseResult {
  if (html.trim().length === 0) {
    return { kind: 'mismatch', reason: 'Kariyer.net returned an empty document.' };
  }

  const fromJsonLd = extractJobsFromJsonLd(html, baseUrl);
  const fromCards = extractJobsFromCards(html, baseUrl);
  const fromAnchors = extractJobsFromAnchors(html, baseUrl);
  const jobs = mergeJobs(fromJsonLd, fromCards, fromAnchors);

  if (jobs.length > 0) {
    return { kind: 'jobs', jobs };
  }

  if (looksLikeChallenge(html)) {
    return { kind: 'blocked', reason: 'challenge' };
  }

  if (
    EMPTY_RESULTS_PATTERN.test(html) ||
    html.includes('/is-ilanlari') ||
    html.includes('/is-ilani/')
  ) {
    return { kind: 'jobs', jobs: [] };
  }

  return {
    kind: 'mismatch',
    reason: 'Kariyer.net HTML did not contain parseable job listings.',
  };
}

function looksLikeChallenge(html: string): boolean {
  if (!CHALLENGE_PATTERN.test(html)) {
    return false;
  }

  return !html.includes('/is-ilani/');
}

function extractJobsFromCards(html: string, baseUrl: string): KariyerNetRawJob[] {
  const opens = [...html.matchAll(new RegExp(AD_CARD_OPEN_PATTERN.source, 'gi'))];
  if (opens.length === 0) {
    return [];
  }

  const jobs: KariyerNetRawJob[] = [];

  for (let index = 0; index < opens.length; index += 1) {
    const match = opens[index];
    if (!match || match.index === undefined) {
      continue;
    }

    const nextIndex = opens[index + 1]?.index;
    const cardHtml = html.slice(match.index, nextIndex ?? match.index + 12_000);
    const href = firstListingHref(cardHtml);
    const job = jobFromListingWindow(cardHtml, href, match[0] ?? '', baseUrl);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

function extractJobsFromAnchors(
  html: string,
  baseUrl: string,
): KariyerNetRawJob[] {
  const jobs: KariyerNetRawJob[] = [];
  const anchorRegex = new RegExp(JOB_ANCHOR_PATTERN.source, 'gi');

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const inner = match[2] ?? '';
    const fullMatch = match[0] ?? '';
    if (!href) {
      continue;
    }

    const matchIndex = match.index ?? 0;
    const windowStart = Math.max(0, matchIndex - 1_200);
    const windowEnd = Math.min(
      html.length,
      matchIndex + fullMatch.length + 800,
    );
    const nearby = html.slice(windowStart, windowEnd);
    const job = jobFromListingWindow(nearby, href, fullMatch, baseUrl, inner);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

function jobFromListingWindow(
  windowHtml: string,
  href: string | undefined,
  openingMarkup: string,
  baseUrl: string,
  anchorInner?: string,
): KariyerNetRawJob | null {
  const canonicalUrl = href
    ? canonicalizeKariyerNetJobUrl(href, baseUrl)
    : null;
  const externalJobId = canonicalUrl
    ? resolveKariyerNetExternalId(canonicalUrl)
    : null;
  if (!canonicalUrl || !externalJobId) {
    return null;
  }

  const title = readTitle(windowHtml, openingMarkup, anchorInner);
  if (!title || isSkipTitle(title)) {
    return null;
  }

  const companyName = readCompanyName(windowHtml, openingMarkup);
  const location = readLocation(windowHtml, openingMarkup);
  const workModel = readWorkModel(windowHtml, openingMarkup);
  const employmentType =
    extractDataTestContent(windowHtml, 'text') ??
    firstCapture(EMPLOYMENT_NEARBY_PATTERN, openingMarkup) ??
    readHtmlAttribute(openingMarkup, 'workTypeText');
  const publishedAt =
    extractDataTestContent(windowHtml, 'ad-date-item-date-other') ??
    firstCapture(PUBLISHED_NEARBY_PATTERN, windowHtml) ??
    readHtmlAttribute(openingMarkup, 'time');

  return omitUndefined({
    externalJobId,
    canonicalUrl,
    title,
    companyName,
    location,
    workModel,
    employmentType,
    publishedAt,
  });
}

function readTitle(
  windowHtml: string,
  openingMarkup: string,
  anchorInner: string | undefined,
): string | undefined {
  const nested =
    extractDataTestContent(windowHtml, 'ad-card-title') ??
    readHtmlAttribute(openingMarkup, 'positionName');
  if (nested) {
    return nested;
  }

  if (anchorInner === undefined) {
    return undefined;
  }

  if (hasDataTest(anchorInner, 'ad-card-title')) {
    return extractDataTestContent(anchorInner, 'ad-card-title');
  }

  const decoded = decodeHtmlFragment(anchorInner);
  return decoded.length > 0 ? decoded : undefined;
}

function readCompanyName(
  windowHtml: string,
  openingMarkup: string,
): string | undefined {
  return (
    extractDataTestContent(windowHtml, 'subtitle') ??
    firstCapture(COMPANY_NEARBY_PATTERN, windowHtml) ??
    firstCapture(COMPANY_NEARBY_PATTERN, openingMarkup) ??
    companyImageAlt(windowHtml)
  );
}

function readLocation(
  windowHtml: string,
  openingMarkup: string,
): string | undefined {
  const fromDom =
    extractDataTestContent(windowHtml, 'location') ??
    firstCapture(LOCATION_NEARBY_PATTERN, windowHtml);
  if (fromDom && fromDom !== '[object Object]') {
    return fromDom;
  }

  const fromAttr = readHtmlAttribute(openingMarkup, 'cityName');
  return fromAttr && fromAttr !== '[object Object]' ? fromAttr : undefined;
}

function readWorkModel(
  windowHtml: string,
  openingMarkup: string,
): string | undefined {
  return (
    extractDataTestContent(windowHtml, 'work-model') ??
    firstCapture(WORK_MODEL_NEARBY_PATTERN, windowHtml) ??
    readHtmlAttribute(openingMarkup, 'workModelText')
  );
}

function isSkipTitle(title: string): boolean {
  const normalized = title.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');
  return SKIP_TITLE_PATTERN.test(normalized);
}

function firstListingHref(html: string): string | undefined {
  const match = html.match(/href\s*=\s*["']([^"']*\/is-ilani\/[^"']+)["']/i);
  return match?.[1];
}

function extractJobsFromJsonLd(
  html: string,
  baseUrl: string,
): KariyerNetRawJob[] {
  const jobs: KariyerNetRawJob[] = [];
  const seen = new Set<string>();
  const scriptRegex = new RegExp(JSON_LD_PATTERN.source, 'gi');

  for (const match of html.matchAll(scriptRegex)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    for (const posting of flattenJobPostings(parsed)) {
      const job = jobFromJsonLd(posting, baseUrl);
      if (!job || typeof job.externalJobId !== 'string') {
        continue;
      }

      if (seen.has(job.externalJobId)) {
        continue;
      }

      seen.add(job.externalJobId);
      jobs.push(job);
    }
  }

  return jobs;
}

function flattenJobPostings(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJobPostings(item));
  }

  if (!isRecord(value)) {
    return [];
  }

  const types = readTypes(value['@type']);
  if (types.includes('JobPosting')) {
    return [value];
  }

  if (types.includes('ItemList') && Array.isArray(value.itemListElement)) {
    return value.itemListElement.flatMap((item) => flattenJobPostings(item));
  }

  if (value.item) {
    return flattenJobPostings(value.item);
  }

  if (Array.isArray(value['@graph'])) {
    return value['@graph'].flatMap((item) => flattenJobPostings(item));
  }

  return [];
}

function jobFromJsonLd(
  posting: Record<string, unknown>,
  baseUrl: string,
): KariyerNetRawJob | null {
  const urlValue =
    readString(posting.url) ??
    readString(posting.sameAs) ??
    readString(posting['@id']);
  const canonicalUrl = urlValue
    ? canonicalizeKariyerNetJobUrl(urlValue, baseUrl)
    : null;
  if (!canonicalUrl) {
    return null;
  }

  const explicitId =
    readStringOrNumber(posting.identifier) ??
    (isRecord(posting.identifier)
      ? readStringOrNumber(posting.identifier.value)
      : null);
  const externalJobId = explicitId ?? resolveKariyerNetExternalId(canonicalUrl);
  const title = readString(posting.title);
  if (!externalJobId || !title) {
    return null;
  }

  return omitUndefined({
    externalJobId,
    canonicalUrl,
    title,
    companyName: organizationName(posting.hiringOrganization),
    location: localityName(posting.jobLocation),
    workModel: readString(posting.jobLocationType),
    employmentType: readString(posting.employmentType),
    description: readString(posting.description),
    publishedAt: readString(posting.datePosted),
  });
}

function mergeJobs(
  ...groups: readonly (readonly KariyerNetRawJob[])[]
): KariyerNetRawJob[] {
  const merged = new Map<string, KariyerNetRawJob>();

  for (const job of groups.flat()) {
    const key = jobDedupeKey(job);
    if (!key) {
      continue;
    }

    const existing = merged.get(key);
    merged.set(key, existing ? fillMissingJob(existing, job) : job);
  }

  return [...merged.values()];
}

function jobDedupeKey(job: KariyerNetRawJob): string | null {
  if (typeof job.externalJobId === 'string' && job.externalJobId.trim().length > 0) {
    return `id:${job.externalJobId.trim()}`;
  }

  if (typeof job.canonicalUrl === 'string' && job.canonicalUrl.trim().length > 0) {
    return `url:${job.canonicalUrl.trim()}`;
  }

  return null;
}

function fillMissingJob(
  current: KariyerNetRawJob,
  incoming: KariyerNetRawJob,
): KariyerNetRawJob {
  return omitUndefined({
    externalJobId: current.externalJobId ?? incoming.externalJobId,
    canonicalUrl: current.canonicalUrl ?? incoming.canonicalUrl,
    title: current.title ?? incoming.title,
    companyName: current.companyName ?? incoming.companyName,
    location: current.location ?? incoming.location,
    workModel: current.workModel ?? incoming.workModel,
    employmentType: current.employmentType ?? incoming.employmentType,
    description: current.description ?? incoming.description,
    technologies: current.technologies ?? incoming.technologies,
    publishedAt: current.publishedAt ?? incoming.publishedAt,
    experienceLevel: current.experienceLevel ?? incoming.experienceLevel,
  });
}

function extractDataTestContent(
  html: string,
  testId: string,
): string | undefined {
  const escaped = escapeRegExp(testId);
  const open = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b[^>]*\\bdata-test\\s*=\\s*["']${escaped}["'][^>]*>`,
    'i',
  );
  const match = open.exec(html);
  if (!match?.[1] || match.index === undefined) {
    return undefined;
  }

  const start = match.index + match[0].length;
  const close = new RegExp(`</${escapeRegExp(match[1])}\\s*>`, 'i');
  const rest = html.slice(start);
  const closeMatch = close.exec(rest);
  const inner = closeMatch ? rest.slice(0, closeMatch.index) : rest.slice(0, 400);
  const decoded = decodeHtmlFragment(inner);
  return decoded.length > 0 ? decoded : undefined;
}

function hasDataTest(html: string, testId: string): boolean {
  return new RegExp(
    `\\bdata-test\\s*=\\s*["']${escapeRegExp(testId)}["']`,
    'i',
  ).test(html);
}

function companyImageAlt(html: string): string | undefined {
  const match = html.match(COMPANY_IMAGE_PATTERN);
  if (!match?.[0]) {
    return undefined;
  }

  return readHtmlAttribute(match[0], 'alt');
}

function firstCapture(pattern: RegExp, html: string): string | undefined {
  const match = html.match(pattern);
  if (!match) {
    return undefined;
  }

  const captured = match.slice(1).find((value) => value && value.trim().length > 0);
  const decoded = captured ? decodeHtmlFragment(captured) : '';
  return decoded.length > 0 ? decoded : undefined;
}

function readHtmlAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, 'i'),
  );
  const decoded = match?.[1] ? decodeHtmlFragment(match[1]) : '';
  return decoded.length > 0 ? decoded : undefined;
}

function looksLikeHtmlText(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function decodeHtmlFragment(value: string): string {
  const withoutTags = looksLikeHtmlText(value)
    ? value.replace(/<[^>]+>/g, ' ')
    : value;

  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function organizationName(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (isRecord(value)) {
    return readString(value.name);
  }

  return undefined;
}

function localityName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return localityName(value[0]);
  }

  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value.address)) {
    return (
      readString(value.address.addressLocality) ??
      readString(value.address.addressRegion)
    );
  }

  return readString(value.name);
}

function readTypes(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = decodeHtmlFragment(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringOrNumber(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return readString(value);
}

function omitUndefined(job: KariyerNetRawJob): KariyerNetRawJob {
  const result: KariyerNetRawJob = {};
  for (const [key, value] of Object.entries(job)) {
    if (value !== undefined) {
      result[key as keyof KariyerNetRawJob] = value;
    }
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
