import type { SourceId } from '../common/domain.types.js';

export const NEW_JOBS_DIGEST_TYPE = 'JOB_DISCOVERY';

export type NotificationDiscoveryData = {
  discoveryRunId: string;
  savedSearchId: string | null;
  newJobCount: number;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data: NotificationDiscoveryData | null;
};

export type InsertedJobForNotification = {
  id: string;
  sourceId: SourceId;
};

export type PersistedJobForNotification = InsertedJobForNotification & {
  isActive: boolean;
  publishedAt: string | null;
};

export type DiscoveryNotificationDraft = {
  userId: string;
  title: string;
  message: string;
  type: typeof NEW_JOBS_DIGEST_TYPE;
  discoveryRunId: string;
  savedSearchId: string | null;
  newJobCount: number;
};

export type CreateDiscoveryNotificationsInput = {
  runId: string;
  jobs: readonly InsertedJobForNotification[];
  searchOwners: ReadonlyMap<string, string>;
  matches: readonly { jobId: string; savedSearchId: string }[];
};
