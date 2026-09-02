export const DEFAULT_JOB_NEW_WINDOW_HOURS = 24;

export function resolveJobNewWindowHours(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_JOB_NEW_WINDOW_HOURS;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_JOB_NEW_WINDOW_HOURS;
  }

  return parsed;
}

export function isJobNewForUser(
  firstEventAt: Date,
  now: Date,
  windowHours: number,
): boolean {
  const elapsedMs = now.getTime() - firstEventAt.getTime();
  if (Number.isNaN(elapsedMs)) {
    return false;
  }

  return elapsedMs >= 0 && elapsedMs <= windowHours * 60 * 60 * 1000;
}

export type JobNewnessMatch = {
  jobId: string;
  matchedAt: Date | null;
};

export function applyJobNewness<
  T extends { id: string; firstDiscoveredAt: Date; isNew: boolean; isSeen: boolean },
>(
  items: readonly T[],
  matches: readonly JobNewnessMatch[],
  now: Date,
  windowHours: number,
  seenJobIds: ReadonlySet<string> = new Set(),
): T[] {
  const firstMatchByJob = new Map<string, Date>();

  for (const match of matches) {
    if (!match.matchedAt) {
      continue;
    }

    const current = firstMatchByJob.get(match.jobId);
    if (!current || match.matchedAt < current) {
      firstMatchByJob.set(match.jobId, match.matchedAt);
    }
  }

  return items.map((item) => {
    const isSeen = seenJobIds.has(item.id);
    const firstEventAt = firstMatchByJob.get(item.id) ?? item.firstDiscoveredAt;
    return {
      ...item,
      isSeen,
      isNew: !isSeen && isJobNewForUser(firstEventAt, now, windowHours),
    };
  });
}
