import type { SourceId } from '../common/domain.types.js';

import {
  NEW_JOBS_DIGEST_TYPE,
  type CreateDiscoveryNotificationsInput,
  type DiscoveryNotificationDraft,
  type InsertedJobForNotification,
} from './notifications.types.js';

const SOURCE_ORDER: readonly SourceId[] = ['linkedin', 'kariyer_net'];

export function newJobsTitle(count: number): string {
  return count === 1 ? '1 new job found' : `${count} new jobs found`;
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

export function buildDiscoveryNotificationDrafts(
  input: CreateDiscoveryNotificationsInput,
): DiscoveryNotificationDraft[] {
  const jobsById = new Map(
    input.jobs.map((job) => [job.id, job] as const),
  );
  const jobsByUser = new Map<string, Map<string, InsertedJobForNotification>>();

  for (const match of input.matches) {
    const job = jobsById.get(match.jobId);
    const userId = input.searchOwners.get(match.savedSearchId);
    if (!job || !userId) {
      continue;
    }

    const forUser = jobsByUser.get(userId) ?? new Map();
    forUser.set(job.id, job);
    jobsByUser.set(userId, forUser);
  }

  const drafts: DiscoveryNotificationDraft[] = [];

  for (const [userId, jobs] of jobsByUser) {
    const uniqueJobs = [...jobs.values()];
    if (uniqueJobs.length === 0) {
      continue;
    }

    drafts.push({
      userId,
      title: newJobsTitle(uniqueJobs.length),
      message: sourceCountMessage(uniqueJobs),
      type: NEW_JOBS_DIGEST_TYPE,
    });
  }

  return drafts;
}

function sourceLabel(sourceId: SourceId): string {
  return sourceId === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}
