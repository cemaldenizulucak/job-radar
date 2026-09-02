import type { ApplicationStatus, SourceId, WorkModel } from '../common/domain.types.js';

export type JobListing = {
  id: string;
  sourceId: SourceId;
  externalId: string | null;
  canonicalUrl: string;
  title: string;
  companyName: string;
  description: string | null;
  location: string | null;
  workModel: WorkModel | null;
  experienceLevel: string | null;
  technologies: readonly string[];
  publishedAt: Date | null;
  firstDiscoveredAt: Date;
  lastSeenAt: Date;
};

export type NormalizedJob = {
  sourceId: SourceId;
  sourceJobId: string;
  canonicalUrl: string;
  title: string;
  companyName: string;
  titleNormalized: string;
  companyNormalized: string;
  description: string | null;
  location: string | null;
  workModel: WorkModel | null;
  experienceLevel: string | null;
  technologies: readonly string[];
  publishedAt: string | null;
  isActive: boolean;
};

export type JobListQuery = {
  userId: string;
  sourceId?: SourceId | 'all';
  savedSearchId?: string;
  matchedOnly?: boolean;
  includeInactive?: boolean;
  cursor?: string;
  limit?: number;
};

export type JobListItem = {
  id: string;
  sourceId: SourceId;
  title: string;
  companyName: string;
  location: string | null;
  workModel: WorkModel | null;
  publishedAt: Date | null;
  firstDiscoveredAt: Date;
  canonicalUrl: string;
  matchedSearchIds: readonly string[];
  duplicateGroupSize: number;
  isMatched: boolean;
  isNew: boolean;
  isSeen: boolean;
};

export type JobDetail = JobListItem & {
  description: string | null;
  experienceLevel: string | null;
  technologies: readonly string[];
  matchedSearches: readonly { id: string; name: string }[];
  duplicateJobs: readonly {
    id: string;
    sourceId: SourceId;
    title: string;
    companyName: string;
    canonicalUrl: string;
  }[];
  isFavorite: boolean;
  applicationStatus: ApplicationStatus | null;
  applicationId: string | null;
};

export type JobTabs = {
  allCount: number;
  sources: readonly { id: SourceId | 'all'; label: string; count: number }[];
  savedSearches: readonly { id: string; name: string; count: number }[];
};

export type JobListResult = {
  items: readonly JobListItem[];
  nextCursor: string | null;
};
