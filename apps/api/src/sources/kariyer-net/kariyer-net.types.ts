import type { WorkModel } from '../../common/domain.types.js';
import type { SourceAdapterCapabilities } from '../job-source.adapter.js';

export type KariyerNetProviderMode = 'mock' | 'live';

export const KARIYER_NET_SOURCE_ID = 'kariyer_net' as const;

/**
 * Conservative capabilities until an approved Kariyer.net access method exists.
 * Remote and experience filters are not assumed; JobRadar matching applies them.
 */
export const KARIYER_NET_CAPABILITIES: SourceAdapterCapabilities = {
  supportsKeywordSearch: true,
  supportsLocation: true,
  supportsRemoteFilter: false,
  supportsExperienceLevel: false,
};

export type KariyerNetSearchInput = {
  keywords: readonly string[];
  locations: readonly string[];
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  savedSearchId?: string;
  maxAgeDays?: number;
};

/** Normalized search input accepted by {@link KariyerNetProvider.search}. */
export type JobSearchInput = KariyerNetSearchInput;

export type KariyerNetRawJob = {
  externalJobId?: unknown;
  canonicalUrl?: unknown;
  title?: unknown;
  companyName?: unknown;
  location?: unknown;
  workModel?: unknown;
  employmentType?: unknown;
  description?: unknown;
  technologies?: unknown;
  publishedAt?: unknown;
  experienceLevel?: unknown;
};

export type KariyerNetPaginationStopReason =
  | 'no_results'
  | 'max_pages'
  | 'blocked_after_success'
  | 'pagination_loop';

export type KariyerNetProviderResult = {
  jobs: readonly KariyerNetRawJob[];
  pagesFetched?: number;
  jobsCollected?: number;
  detailsFetched?: number;
  detailsFailed?: number;
  stopReason?: KariyerNetPaginationStopReason | null;
};
