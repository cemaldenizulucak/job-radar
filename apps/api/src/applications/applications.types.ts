import type { ApplicationStatus, SourceId } from '../common/domain.types.js';

export type ApplicationRecord = {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  title: string;
  companyName: string;
  sourceId: SourceId;
  canonicalUrl: string;
};
