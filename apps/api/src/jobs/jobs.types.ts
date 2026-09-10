import type { ApplicationStatus, SourceId, WorkModel } from '../common/domain.types.js';
import type { MatchStatus } from '../matching/match-status.js';

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

export type JobDetailFetchState = {
  description: string | null;
  detailFetchAttempts: number;
  detailFetchAttemptedAt: string | null;
};

export type CatalogListingRecord = NormalizedJob & {
  id: string;
};

export type JobListQuery = {
  userId: string;
  sourceId?: SourceId | 'all';
  savedSearchId?: string;
  matchStatus?: MatchStatus;
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
  isFavorite: boolean;
  matchStatus?: MatchStatus;
};

export type JobDetail = JobListItem & {
  description: string | null;
  experienceLevel: string | null;
  technologies: readonly string[];
  matchedSearches: readonly MatchedSearchSummary[];
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

export type MatchEvidenceField = 'title' | 'description' | 'technologies';

export type MatchKind = 'direct' | 'skill';

export type MatchEvidenceSummary = {
  term: string;
  matchedText: string;
  field: MatchEvidenceField;
  snippet: string | null;
  kind: 'title' | 'skill';
  basis?: 'education_field';
};

export type MatchedSearchSummary = {
  id: string;
  name: string;
  matchKind: MatchKind | null;
  terms: readonly string[];
  evidence: readonly MatchEvidenceSummary[];
  matchStatus?: MatchStatus;
};

export type JobTabs = {
  allCount: number;
  sources: readonly { id: SourceId | 'all'; label: string; count: number }[];
  savedSearches: readonly { id: string; name: string; count: number }[];
};

export type JobListResult = {
  items: readonly JobListItem[];
  nextCursor: string | null;
  lastDiscoveryAt: string | null;
  totalCount: number;
  savedSearchCounts: readonly { id: string; count: number }[];
  verifiedMatchCount: number;
  unverifiedMatchCount: number;
};
