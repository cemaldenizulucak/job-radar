import type { SearchLocationOrigin } from '@/lib/search-location';

export type SearchSourceId = 'linkedin' | 'kariyer_net';

export type WorkType = 'remote' | 'hybrid' | 'onsite';

export type SearchDiscoveryStatus =
  | 'pending'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped';

export type SearchDiscoveryResult = {
  status: SearchDiscoveryStatus;
  jobsFetched: number;
  matchesCreated: number;
};

export type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
  countryCode: string | null;
  countryName: string | null;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  subdivisionCodes?: readonly string[];
  subdivisionNames?: readonly string[];
  workTypes: readonly WorkType[];
  experienceLevels: readonly string[];
  sources: readonly SearchSourceId[];
  effectiveLocation: string | null;
  locationSource: SearchLocationOrigin;
  discovery?: SearchDiscoveryResult;
  lastDiscoveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchWriteInput = {
  name: string;
  isActive: boolean;
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
  countryCode: string | null;
  countryName: string | null;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  subdivisionCodes: readonly string[];
  subdivisionNames: readonly string[];
  workTypes: readonly WorkType[];
  experienceLevels: readonly string[];
  sources: readonly SearchSourceId[];
};
