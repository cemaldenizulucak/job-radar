import type { SourceId, WorkModel } from '../common/domain.types.js';

export type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  keywords: readonly string[];
  technologies: readonly string[];
  locations: readonly string[];
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
  workTypes: readonly WorkModel[];
  experienceLevels: readonly string[];
  sources: readonly SourceId[];
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchWriteResponse = {
  search: SavedSearchResponse;
  discovery: {
    status: 'completed' | 'partial' | 'failed' | 'skipped';
    jobsFetched: number;
    matchesCreated: number;
  };
};
