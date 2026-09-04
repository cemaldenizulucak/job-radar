import type { SourceId, WorkModel } from '../common/domain.types.js';
import type { SearchLocationOrigin } from '../common/search-location.js';
import type { ImmediateDiscoveryResult } from '../discovery/discovery.types.js';

export type { SearchLocationOrigin };

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
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  sourceIds: readonly SourceId[];
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
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  sources: readonly SourceId[];
};

export type SavedSearchResponse = {
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
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  sources: readonly SourceId[];
  effectiveLocation: string | null;
  locationSource: SearchLocationOrigin;
  discovery?: ImmediateDiscoveryResult;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchWriteResponse = {
  search: SavedSearchResponse;
  discovery: ImmediateDiscoveryResult;
};
