export const DEFAULT_JOB_SOURCE_MAX_AGE_DAYS = 30;
export const DEFAULT_JOB_INACTIVE_AFTER_DAYS = 7;
export const DEFAULT_DISCOVERY_INTERVAL_HOURS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function readPositiveIntEnv(
  raw: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function sourceMaxAgeCutoff(
  maxAgeDays: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - maxAgeDays * MS_PER_DAY);
}

export function inactiveNotSeenCutoff(
  inactiveAfterDays: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - inactiveAfterDays * MS_PER_DAY);
}

/**
 * Missing or unparseable publishedAt is UNKNOWN: keep the job.
 * Only discard when the date is confidently older than the window.
 */
export function isWithinSourceMaxAge(
  publishedAt: string | null | undefined,
  maxAgeDays: number,
  now: Date = new Date(),
): boolean {
  if (!publishedAt || publishedAt.trim().length === 0) {
    return true;
  }

  const milliseconds = Date.parse(publishedAt);
  if (!Number.isFinite(milliseconds)) {
    return true;
  }

  return milliseconds >= sourceMaxAgeCutoff(maxAgeDays, now).getTime();
}
