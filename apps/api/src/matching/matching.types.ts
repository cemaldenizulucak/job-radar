import type { SourceId, WorkModel } from '../common/domain.types.js';
import type { JobRoleFamily } from './search-terms.js';

export type MatchableJob = {
  id: string;
  sourceId: SourceId;
  title: string;
  companyName: string;
  description: string | null;
  location: string | null;
  workModel: WorkModel | null;
  experienceLevel: string | null;
  technologies: readonly string[];
};

export type JobSearchMatch = {
  jobId: string;
  savedSearchId: string;
};

export type MatchFieldResult = 'pass' | 'fail' | 'unknown' | 'skipped';

export type KeywordMatchKind = 'direct' | 'alias' | 'related';

export type MatchEvidenceField = 'title' | 'description' | 'technologies';

export type MatchKind = 'direct' | 'skill';

export type MatchEvidence = {
  term: string;
  matchedText: string;
  field: MatchEvidenceField;
  snippet: string | null;
  kind: 'title' | 'skill';
};

export type MatchDecision = {
  title: string;
  sourceId: SourceId;
  savedSearchId: string;
  matched: boolean;
  score: number;
  threshold: number;
  reasons: readonly string[];
  keyword: MatchFieldResult;
  keywordKind: KeywordMatchKind | null;
  matchKind: MatchKind | null;
  evidence: readonly MatchEvidence[];
  roleFamily: JobRoleFamily;
  roleMatch: KeywordMatchKind | null;
  titleMatch: MatchFieldResult;
  descriptionMatch: MatchFieldResult;
  location: MatchFieldResult;
  technology: MatchFieldResult;
  experience: MatchFieldResult;
  workModel: MatchFieldResult;
  searchTerms: readonly { raw: string; kind: 'role' | 'technology' }[];
  technologyTerms: readonly string[];
};
