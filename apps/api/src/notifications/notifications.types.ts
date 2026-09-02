import type { SourceId } from '../common/domain.types.js';

export const NEW_JOBS_DIGEST_TYPE = 'JOB_DISCOVERY';

export type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type InsertedJobForNotification = {
  id: string;
  sourceId: SourceId;
};

export type DiscoveryNotificationDraft = {
  userId: string;
  title: string;
  message: string;
  type: typeof NEW_JOBS_DIGEST_TYPE;
};

export type CreateDiscoveryNotificationsInput = {
  runId: string;
  jobs: readonly InsertedJobForNotification[];
  searchOwners: ReadonlyMap<string, string>;
  matches: readonly { jobId: string; savedSearchId: string }[];
};
