import type { JobListItem } from '../jobs/jobs.types.js';

export type FavoriteRecord = {
  id: string;
  userId: string;
  jobId: string;
  createdAt: string;
  job: JobListItem | null;
};
