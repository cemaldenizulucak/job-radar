import {
  coalesceSubdivisionNames,
  sanitizeLocationList,
  sanitizeLocationToken,
  type StructuredSearchLocation,
} from '../common/search-location.js';
import { normalizeForSearch } from '../common/normalize-text.js';
import { toProfessionFieldQueryVariant } from '../matching/profession-forms.js';
import type { SavedSearch } from '../searches/searches.types.js';

export const DEFAULT_MAX_QUERIES_PER_SEARCH_SOURCE = 8;
export const DEFAULT_TIME_BUDGET_MS_PER_SEARCH_SOURCE = 40_000;

export type ScanKind = 'first' | 'periodic' | 'user';

export type QueryPhraseOrigin = 'user' | 'profession_variant';

export type SourceQueryPhrase = {
  text: string;
  origin: QueryPhraseOrigin;
};

export type SourceQueryUnit = {
  keyword: string;
  location: string | null;
  origin: QueryPhraseOrigin;
};

export type QueryUnitSelection = {
  selected: SourceQueryUnit[];
  deferred: SourceQueryUnit[];
  nextIndex: number;
  truncated: boolean;
};

/**
 * Comma-separated user phrases are alternatives. Profession-sized phrases
 * stay intact. Field-form variants are extra alternatives, never AND'd.
 */
export function collectSourceQueryPhrases(
  keywords: readonly string[],
): SourceQueryPhrase[] {
  const user: SourceQueryPhrase[] = [];
  const variants: SourceQueryPhrase[] = [];
  const seen = new Set<string>();

  const push = (
    bucket: SourceQueryPhrase[],
    text: string,
    origin: QueryPhraseOrigin,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const key = normalizeForSearch(trimmed);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    bucket.push({ text: trimmed, origin });
  };

  for (const keyword of keywords) {
    for (const part of keyword.split(',')) {
      const phrase = part.trim();
      if (!phrase) {
        continue;
      }

      push(user, phrase, 'user');
      const variant = toProfessionFieldQueryVariant(phrase);
      if (variant) {
        push(variants, variant, 'profession_variant');
      }
    }
  }

  return [...user, ...variants];
}

/**
 * Selected cities are alternatives. Country-only searches keep the country
 * token so sources that accept it can use it; Kariyer.net already skips
 * country slugs.
 */
export function collectSourceQueryLocations(
  search: StructuredSearchLocation,
): string[] {
  const cities = coalesceSubdivisionNames(search);
  if (cities.length > 0) {
    return cities;
  }

  const country = sanitizeLocationToken(search.countryName);
  if (country) {
    return [country];
  }

  return uniqueCityTokens(sanitizeLocationList(search.locations));
}

export function buildSourceQueryUnits(
  search: Pick<SavedSearch, 'keywords'> & StructuredSearchLocation,
): SourceQueryUnit[] {
  const phrases = collectSourceQueryPhrases(search.keywords);
  const locations = collectSourceQueryLocations(search);
  const units: SourceQueryUnit[] = [];

  if (phrases.length === 0) {
    return units;
  }

  const locationSlots = locations.length > 0 ? locations : [null];

  for (const phrase of phrases) {
    for (const location of locationSlots) {
      units.push({
        keyword: phrase.text,
        location,
        origin: phrase.origin,
      });
    }
  }

  return units;
}

export function sourceQueryPlanFingerprint(
  search: Pick<
    SavedSearch,
    'keywords' | 'sourceIds' | 'technologies' | 'experienceLevels'
  > &
    StructuredSearchLocation,
): string {
  const phrases = collectSourceQueryPhrases(search.keywords)
    .map((phrase) => normalizeForSearch(phrase.text))
    .join('\n');
  const locations = collectSourceQueryLocations(search)
    .map((location) => normalizeForSearch(location))
    .join('\n');

  return [
    phrases,
    locations,
    search.sourceIds.join(','),
    search.technologies.map((item) => normalizeForSearch(item)).join('\n'),
    search.experienceLevels.map((item) => normalizeForSearch(item)).join('\n'),
  ].join('::');
}

export function selectQueryUnits(
  units: readonly SourceQueryUnit[],
  options: { startIndex?: number; maxQueries: number },
): QueryUnitSelection {
  const startIndex =
    units.length === 0
      ? 0
      : ((options.startIndex ?? 0) % units.length + units.length) % units.length;
  const maxQueries = Math.max(0, options.maxQueries);

  if (units.length === 0 || maxQueries === 0) {
    return {
      selected: [],
      deferred: [...units],
      nextIndex: 0,
      truncated: units.length > 0,
    };
  }

  const selected: SourceQueryUnit[] = [];
  for (let offset = 0; offset < units.length && selected.length < maxQueries; offset += 1) {
    const unit = units[(startIndex + offset) % units.length];
    if (unit) {
      selected.push(unit);
    }
  }

  const truncated = selected.length < units.length || maxQueries < units.length;
  const nextIndex = truncated
    ? (startIndex + selected.length) % units.length
    : 0;
  const selectedKeys = new Set(selected.map(queryUnitKey));
  const deferred = truncated
    ? units.filter((unit) => !selectedKeys.has(queryUnitKey(unit)))
    : [];

  return { selected, deferred, nextIndex, truncated };
}

/**
 * Advance the scan cursor by units that actually ran. Time-budget leftovers
 * must resume at the first unattempted unit, not at the planner's wrap index.
 */
export function nextQueryStartIndex(input: {
  unitCount: number;
  startIndex: number;
  attempted: number;
  leftoverCount: number;
}): number {
  if (input.unitCount === 0) {
    return 0;
  }

  if (input.leftoverCount <= 0 && input.attempted <= 0) {
    return ((input.startIndex % input.unitCount) + input.unitCount) % input.unitCount;
  }

  return (input.startIndex + input.attempted) % input.unitCount;
}

export function queryUnitKey(unit: SourceQueryUnit): string {
  return `${normalizeForSearch(unit.keyword)}::${unit.location ? normalizeForSearch(unit.location) : ''}`;
}

export function resolveScanKind(input: {
  trigger: 'scheduled' | 'user';
  lastDiscoveredAt?: string | null;
}): ScanKind {
  if (input.trigger === 'user') {
    return input.lastDiscoveredAt ? 'user' : 'first';
  }

  return input.lastDiscoveredAt ? 'periodic' : 'first';
}

function uniqueCityTokens(locations: readonly string[]): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];

  for (const location of locations) {
    const city = sanitizeLocationToken(location.split(',')[0] ?? location);
    if (!city) {
      continue;
    }

    const key = normalizeForSearch(city);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cities.push(city);
  }

  return cities;
}
