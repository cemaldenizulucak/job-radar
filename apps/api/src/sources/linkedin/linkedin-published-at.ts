const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const RELATIVE_UNIT_PATTERN =
  /^(\d+)\s+(minute|hour|day|week|month)s?(?:\s+ago)?$/;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Converts LinkedIn listing dates to ISO-8601 UTC.
 * Returns null when the value is empty or not confidently parseable.
 * Never invents a date.
 */
export function parseLinkedInPublishedAt(
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

  return parseRelativeTimestamp(raw, now);
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
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  if (
    normalized === 'just now' ||
    normalized === 'today' ||
    normalized === 'moments ago'
  ) {
    return now.toISOString();
  }

  if (normalized === 'yesterday') {
    return new Date(now.getTime() - MS_PER_DAY).toISOString();
  }

  const match = normalized.match(RELATIVE_UNIT_PATTERN);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const count = Number.parseInt(match[1], 10);
  if (!Number.isFinite(count) || count < 0 || count > 3650) {
    return null;
  }

  const unitMs = unitMilliseconds(match[2]);
  if (!unitMs) {
    return null;
  }

  return new Date(now.getTime() - count * unitMs).toISOString();
}

function unitMilliseconds(unit: string): number | null {
  switch (unit) {
    case 'minute':
      return MS_PER_MINUTE;
    case 'hour':
      return MS_PER_HOUR;
    case 'day':
      return MS_PER_DAY;
    case 'week':
      return 7 * MS_PER_DAY;
    case 'month':
      return 30 * MS_PER_DAY;
    default:
      return null;
  }
}
