import type { SearchLocationOrigin } from '@/lib/search-location';

export type SearchSourceId = 'linkedin' | 'kariyer_net';

export type WorkType = 'remote' | 'hybrid' | 'onsite';

export type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
  workTypes: readonly WorkType[];
  experienceLevels: readonly string[];
  sources: readonly SearchSourceId[];
  effectiveLocation: string | null;
  locationSource: SearchLocationOrigin;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchWriteInput = {
  name: string;
  isActive: boolean;
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
  workTypes: readonly WorkType[];
  experienceLevels: readonly string[];
  sources: readonly SearchSourceId[];
};
