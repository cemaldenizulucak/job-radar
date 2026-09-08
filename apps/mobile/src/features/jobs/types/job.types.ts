export type JobSourceId = 'linkedin' | 'kariyer_net';

export type WorkModel = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type JobApplicationStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED';

export type JobListItem = {
  id: string;
  sourceId: JobSourceId;
  title: string;
  companyName: string;
  location: string | null;
  workModel: WorkModel | null;
  publishedAt: string | null;
  firstDiscoveredAt: string;
  canonicalUrl: string;
  matchedSearchIds: readonly string[];
  duplicateGroupSize: number;
  isMatched: boolean;
  isNew: boolean;
  isSeen: boolean;
  isFavorite: boolean;
};

export type DuplicateJobLink = {
  id: string;
  sourceId: JobSourceId;
  title: string;
  companyName: string;
  canonicalUrl: string;
};

export type MatchedSearchEvidence = {
  term: string;
  matchedText: string;
  field: 'title' | 'description' | 'technologies';
  snippet: string | null;
  kind: 'title' | 'skill';
  basis?: 'education_field';
};

export type MatchedSearch = {
  id: string;
  name: string;
  matchKind: 'direct' | 'skill' | null;
  terms: readonly string[];
  evidence: readonly MatchedSearchEvidence[];
};

export type JobDetail = JobListItem & {
  description: string | null;
  experienceLevel: string | null;
  technologies: readonly string[];
  matchedSearches: readonly MatchedSearch[];
  duplicateJobs: readonly DuplicateJobLink[];
  isFavorite: boolean;
  applicationStatus: JobApplicationStatus | null;
  applicationId: string | null;
};

export type JobListResponse = {
  items: JobListItem[];
  nextCursor: string | null;
};
