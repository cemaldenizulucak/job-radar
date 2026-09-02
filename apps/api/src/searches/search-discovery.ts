import { normalizeText } from '../common/normalize-text.js';
import type { SavedSearch } from './searches.types.js';

export function discoveryRelevantFieldsChanged(
  previous: SavedSearch,
  next: SavedSearch,
): boolean {
  return (
    !sameNormalizedList(previous.keywords, next.keywords) ||
    !sameNormalizedList(previous.technologies, next.technologies) ||
    !sameNormalizedList(previous.locations, next.locations) ||
    !sameNormalizedList(previous.workTypes, next.workTypes) ||
    !sameNormalizedList(previous.experienceLevels, next.experienceLevels) ||
    !sameNormalizedList(previous.sourceIds, next.sourceIds)
  );
}

export function shouldTriggerSavedSearchDiscovery(
  previous: SavedSearch | null,
  next: SavedSearch,
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

function sameNormalizedList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].map(normalizeText).sort();
  const sortedRight = [...right].map(normalizeText).sort();

  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
