import type { WorkModel } from '../../common/domain.types.js';
import type { SourceAdapterCapabilities } from '../job-source.adapter.js';

export type LinkedInProviderMode = 'disabled' | 'mock' | 'live';

export const LINKEDIN_SOURCE_ID = 'linkedin' as const;

export const LINKEDIN_CAPABILITIES: SourceAdapterCapabilities = {
  supportsKeywordSearch: true,
  supportsLocation: true,
  supportsRemoteFilter: true,
  supportsExperienceLevel: false,
};

export type LinkedInSearchInput = {
  keywords: readonly string[];
  locations: readonly string[];
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  savedSearchId?: string;
  maxAgeDays?: number;
};

/** Normalized search input accepted by {@link LinkedInProvider.search}. */
export type JobSearchInput = LinkedInSearchInput;

export type LinkedInRawJob = {
  externalJobId?: unknown;
  canonicalUrl?: unknown;
  title?: unknown;
  companyName?: unknown;
  location?: unknown;
  workModel?: unknown;
  description?: unknown;
  publishedAt?: unknown;
  experienceLevel?: unknown;
};

export type LinkedInPaginationStopReason =
  | 'max_age'
  | 'no_results'
  | 'max_pages'
  | 'blocked_after_success'
  | 'pagination_loop'
  | 'no_new_jobs';

export type LinkedInProviderResult = {
  jobs: readonly LinkedInRawJob[];
  pagesFetched?: number;
  jobsCollected?: number;
  stopReason?: LinkedInPaginationStopReason | null;
};
