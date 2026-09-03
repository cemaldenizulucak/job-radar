import type { SourceId } from '../common/domain.types.js';
import { isVisibleInMatchedJobFeed } from '../jobs/job-feed-visibility.js';
import type { JobSearchMatch } from '../matching/matching.types.js';

import {
  NEW_JOBS_DIGEST_TYPE,
  type CreateDiscoveryNotificationsInput,
  type DiscoveryNotificationDraft,
  type InsertedJobForNotification,
  type PersistedJobForNotification,
} from './notifications.types.js';

const SOURCE_ORDER: readonly SourceId[] = ['linkedin', 'kariyer_net'];

export function newJobsTitle(count: number): string {
  return count === 1 ? '1 yeni ilan bulundu' : `${count} yeni ilan bulundu`;
}

export function sourceCountMessage(
  jobs: readonly InsertedJobForNotification[],
): string {
  const counts = new Map<SourceId, number>();

  for (const job of jobs) {
    counts.set(job.sourceId, (counts.get(job.sourceId) ?? 0) + 1);
  }

  return SOURCE_ORDER.flatMap((sourceId) => {
    const count = counts.get(sourceId) ?? 0;
    if (count === 0) {
      return [];
    }

    return [`${count} ${sourceLabel(sourceId)}`];
  }).join(', ');
}

export function selectVisibleNewMatches(
  matches: readonly JobSearchMatch[],
  jobs: readonly PersistedJobForNotification[],
  maxAgeDays: number,
  now: Date = new Date(),
): {
  matches: JobSearchMatch[];
  jobs: InsertedJobForNotification[];
} {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const visibleMatches: JobSearchMatch[] = [];
  const visibleJobs = new Map<string, InsertedJobForNotification>();

  for (const match of matches) {
    const job = jobsById.get(match.jobId);
    if (!job || !isVisibleInMatchedJobFeed(job, maxAgeDays, now)) {
      continue;
    }

    visibleMatches.push(match);
    if (!visibleJobs.has(job.id)) {
      visibleJobs.set(job.id, { id: job.id, sourceId: job.sourceId });
    }
  }

  return {
    matches: visibleMatches,
    jobs: [...visibleJobs.values()],
  };
}

export function buildDiscoveryNotificationDrafts(
  input: CreateDiscoveryNotificationsInput,
): DiscoveryNotificationDraft[] {
  const jobsById = new Map(
    input.jobs.map((job) => [job.id, job] as const),
  );
  const jobsByUser = new Map<string, Map<string, InsertedJobForNotification>>();
  const searchesByUser = new Map<string, Set<string>>();

  for (const match of input.matches) {
    const job = jobsById.get(match.jobId);
    const userId = input.searchOwners.get(match.savedSearchId);
    if (!job || !userId) {
      continue;
    }

    const forUser = jobsByUser.get(userId) ?? new Map();
    forUser.set(job.id, job);
    jobsByUser.set(userId, forUser);

    const searches = searchesByUser.get(userId) ?? new Set();
    searches.add(match.savedSearchId);
    searchesByUser.set(userId, searches);
  }

  const drafts: DiscoveryNotificationDraft[] = [];

  for (const [userId, jobs] of jobsByUser) {
    const uniqueJobs = [...jobs.values()];
    if (uniqueJobs.length === 0) {
      continue;
    }

    const searchIds = [...(searchesByUser.get(userId) ?? [])];
    drafts.push({
      userId,
      title: newJobsTitle(uniqueJobs.length),
      message: sourceCountMessage(uniqueJobs),
      type: NEW_JOBS_DIGEST_TYPE,
      discoveryRunId: input.runId,
      savedSearchId: searchIds.length === 1 ? (searchIds[0] ?? null) : null,
      newJobCount: uniqueJobs.length,
    });
  }

  return drafts;
}

function sourceLabel(sourceId: SourceId): string {
  return sourceId === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}
