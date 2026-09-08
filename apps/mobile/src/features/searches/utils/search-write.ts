import type { SavedSearch, SavedSearchWriteInput, SearchDiscoveryStatus } from '../types/search.types';

export type { SearchDiscoveryStatus };

export type SearchDiscoveryResult = {
  status: SearchDiscoveryStatus;
  jobsFetched: number;
  matchesCreated: number;
};

export const PARTIAL_DISCOVERY_MESSAGE =
  'Arama kaydedildi. Bazı kaynaklar şu anda taranamadı.';

export const DELETE_SAVED_SEARCH_TITLE = 'Bu kayıtlı arama silinsin mi?';

export const DELETE_SAVED_SEARCH_MESSAGE =
  'Kayıtlı arama kaldırılacak. İş ilanları silinmez. Bu aramaya ait eşleşmeler sekmesinde görünmez.';

export function isDiscoveryPending(status: SearchDiscoveryStatus): boolean {
  return status === 'pending';
}

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
    !sameOptional(previous.countryCode, next.countryCode) ||
    !sameOptional(previous.subdivisionCode, next.subdivisionCode) ||
    !sameNormalizedList(previous.subdivisionCodes ?? [], next.subdivisionCodes) ||
    !sameNormalizedList(previous.subdivisionNames ?? [], next.subdivisionNames) ||
    !sameNormalizedList(previous.workTypes, next.workTypes) ||
    !sameNormalizedList(previous.experienceLevels, next.experienceLevels) ||
    !sameNormalizedList(previous.sources, next.sources)
  );
}

function sameOptional(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return (left ?? '').trim().toUpperCase() === (right ?? '').trim().toUpperCase();
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
