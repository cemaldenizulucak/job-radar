import type { SavedSearch, SavedSearchWriteInput } from '../types/search.types';

export type SearchDiscoveryStatus =
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped';

export type SearchDiscoveryResult = {
  status: SearchDiscoveryStatus;
  jobsFetched: number;
  matchesCreated: number;
};

export const PARTIAL_DISCOVERY_MESSAGE =
  'Search saved. Some sources could not be scanned right now.';

export const DELETE_SAVED_SEARCH_TITLE = 'Delete this saved search?';

export const DELETE_SAVED_SEARCH_MESSAGE =
  'This saved search will be removed. Job listings themselves are not deleted from the database. Matches for this search will no longer appear in its tab.';

export function isDiscoveryWarning(status: SearchDiscoveryStatus): boolean {
  return status === 'partial' || status === 'failed';
}

export function selectedSearchIdAfterDelete(
  selectedId: string | 'all',
  deletedId: string,
): string | 'all' {
  return selectedId === deletedId ? 'all' : selectedId;
}

export function shouldRefreshAfterSearchWrite(
  previous: SavedSearch | null,
  next: SavedSearchWriteInput,
): boolean {
  if (!next.isActive) {
    return false;
  }

  if (!previous) {
    return true;
  }

  if (!previous.isActive) {
    return true;
  }

  return discoveryRelevantFieldsChanged(previous, next);
}

function discoveryRelevantFieldsChanged(
  previous: SavedSearch,
  next: SavedSearchWriteInput,
): boolean {
  return (
    !sameNormalizedList(previous.keywords, next.keywords) ||
    !sameNormalizedList(previous.technologies, next.technologies) ||
    !sameNormalizedList(previous.locations, next.locations) ||
    !sameNormalizedList(previous.workTypes, next.workTypes) ||
    !sameNormalizedList(previous.experienceLevels, next.experienceLevels) ||
    !sameNormalizedList(previous.sources, next.sources)
  );
}

function sameNormalizedList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].map(normalizeCompareValue).sort();
  const sortedRight = [...right].map(normalizeCompareValue).sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function normalizeCompareValue(value: string): string {
  return value.trim().toLowerCase();
}

export function createSubmitLock() {
  let locked = false;

  return {
    tryAcquire(): boolean {
      if (locked) {
        return false;
      }

      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
  };
}
