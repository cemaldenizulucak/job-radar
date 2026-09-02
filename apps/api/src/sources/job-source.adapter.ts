import type { SourceId, WorkModel } from '../common/domain.types.js';

export type SourceAdapterCapabilities = {
  supportsKeywordSearch: boolean;
  supportsLocation: boolean;
  supportsRemoteFilter: boolean;
  supportsExperienceLevel: boolean;
};

export type SourceJobAvailability = 'open' | 'closed' | 'unknown';

export type SourceSearchQuery = {
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
  workModels: readonly WorkModel[];
  experienceLevels: readonly string[];
  savedSearchId?: string;
  maxAgeDays?: number;
};

export type SourceJobRaw = {
  sourceJobId: string;
  canonicalUrl: string;
  title: string;
  companyName: string;
  location?: string;
  workModel?: WorkModel;
  description?: string;
  publishedAt?: string;
  experienceLevel?: string;
  technologies?: readonly string[];
  availability?: SourceJobAvailability;
  rawMetadata?: Readonly<Record<string, string>>;
};

export type SourceSearchResult = {
  sourceId: SourceId;
  jobs: readonly SourceJobRaw[];
  pagesFetched?: number;
  jobsCollected?: number;
  stopReason?: string | null;
};

export interface JobSourceAdapter {
  readonly sourceId: SourceId;
  readonly displayName: string;
  readonly capabilities: SourceAdapterCapabilities;
  isEnabled(): boolean;
  search(query: SourceSearchQuery): Promise<SourceSearchResult>;
}

export const MOCK_SOURCE_CAPABILITIES: SourceAdapterCapabilities = {
  supportsKeywordSearch: true,
  supportsLocation: true,
  supportsRemoteFilter: true,
  supportsExperienceLevel: true,
};
