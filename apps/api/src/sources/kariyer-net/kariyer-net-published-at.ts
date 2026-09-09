import { logKariyerNetDev } from './kariyer-net-dev-log.js';

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const RELATIVE_DAYS_PATTERN = /^(\d+)\s*gun(?:\s+once)?$/;
const RELATIVE_HOURS_PATTERN = /^(\d+)\s*saat(?:\s+once)?$/;
const MAX_RELATIVE_DAYS = 3650;
const MAX_RELATIVE_HOURS = 8760;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Converts Kariyer.net listing dates to ISO-8601 UTC.
 * Returns null when the value is empty or not confidently parseable.
 * Never returns the original human-readable string.
 */
export function parseKariyerNetPublishedAt(
  value: unknown,
  now: Date = new Date(),
): string | null {
  const raw = readPublishedAtInput(value);
  if (raw === null) {
    return null;
  }

  const absolute = parseAbsoluteTimestamp(raw);
  if (absolute) {
    return absolute;
  }

  const relative = parseRelativeTimestamp(raw, now);
  if (relative) {
    return relative;
  }

  logKariyerNetDev({
    message: 'Kariyer.net publishedAt not parseable; leaving null',
    rawPreview: raw.slice(0, 80),
  });
  return null;
}

function readPublishedAtInput(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAbsoluteTimestamp(value: string): string | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return new Date(milliseconds).toISOString();
}

function parseRelativeTimestamp(value: string, now: Date): string | null {
  if (isUpdateTimestampLabel(value)) {
    return null;
  }

  const normalized = normalizeRelativeDate(value);
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === 'bugun') {
    return now.toISOString();
  }

  if (normalized === 'dun') {
    return new Date(now.getTime() - MS_PER_DAY).toISOString();
  }

  const days = normalized.match(RELATIVE_DAYS_PATTERN);
  if (days?.[1]) {
    const count = Number.parseInt(days[1], 10);
    if (!Number.isFinite(count) || count > MAX_RELATIVE_DAYS) {
      return null;
    }

    return new Date(now.getTime() - count * MS_PER_DAY).toISOString();
  }

  const hours = normalized.match(RELATIVE_HOURS_PATTERN);
  if (hours?.[1]) {
    const count = Number.parseInt(hours[1], 10);
    if (!Number.isFinite(count) || count > MAX_RELATIVE_HOURS) {
      return null;
    }

    return new Date(now.getTime() - count * MS_PER_HOUR).toISOString();
  }

  return null;
}

function isUpdateTimestampLabel(value: string): boolean {
  const folded = value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');

  return (
    /\bguncellendi\b/.test(folded) ||
    /\bupdated?\b/.test(folded) ||
    /\bson guncelleme\b/.test(folded)
  );
}

function normalizeRelativeDate(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/^updates?\b/g, ' ')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
