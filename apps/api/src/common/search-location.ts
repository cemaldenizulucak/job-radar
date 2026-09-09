import { normalizeForSearch } from './normalize-text.js';

export type ProfileLocation = {
  country: string | null;
  city: string | null;
};

export type LocationSource =
  | 'search'
  | 'profile_city'
  | 'profile_country'
  | 'none';

export type SearchLocationOrigin = 'search' | 'profile' | 'none';

export type ResolvedSearchLocation = {
  locations: readonly string[];
  label: string | null;
  source: LocationSource;
  city: string | null;
  cities: readonly string[];
  country: string | null;
};

const BLANK_LOCATION_NORMALIZED = new Set([
  'all',
  'any',
  'anywhere',
  'hepsi',
  'n a',
  'na',
  'none',
  'null',
  'tumu',
  'undefined',
]);

export function trimLocation(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Empty, whitespace, and UI sentinels ("Tümü", "all") are not location filters. */
export function sanitizeLocationToken(
  value: string | null | undefined,
): string | null {
  const trimmed = trimLocation(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed === '-' || trimmed === '*' || trimmed === '—') {
    return null;
  }

  const normalized = normalizeForSearch(trimmed);
  if (!normalized || BLANK_LOCATION_NORMALIZED.has(normalized)) {
    return null;
  }

  return trimmed;
}

export function sanitizeCountryCode(
  value: string | null | undefined,
): string | null {
  const token = sanitizeLocationToken(value);
  if (!token) {
    return null;
  }

  const upper = token.toUpperCase();
  if (upper === 'ALL' || upper === 'ANY' || upper === 'NONE') {
    return null;
  }

  return upper;
}

export function sanitizeLocationList(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values) {
    return [];
  }

  return uniqueLocations(values.map((value) => sanitizeLocationToken(value)));
}

export function hasExplicitSearchLocationFilter(
  search: StructuredSearchLocation,
): boolean {
  return (
    sanitizeCountryCode(search.countryCode) !== null ||
    sanitizeLocationToken(search.subdivisionCode) !== null ||
    sanitizeLocationToken(search.countryName) !== null ||
    sanitizeLocationToken(search.subdivisionName) !== null ||
    coalesceSubdivisionCodes(search).length > 0 ||
    coalesceSubdivisionNames(search).length > 0 ||
    sanitizeLocationList(search.locations).length > 0
  );
}

export function formatLocationLabel(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const cityLabel = trimLocation(city);
  const countryLabel = trimLocation(country);
  if (cityLabel && countryLabel) {
    return `${cityLabel}, ${countryLabel}`;
  }

  return cityLabel ?? countryLabel;
}

export function toSearchLocationOrigin(
  source: LocationSource,
): SearchLocationOrigin {
  if (source === 'none') {
    return 'none';
  }

  if (source === 'search') {
    return 'search';
  }

  return 'profile';
}

export type StructuredSearchLocation = {
  locations: readonly string[];
  countryCode?: string | null;
  countryName?: string | null;
  subdivisionCode?: string | null;
  subdivisionName?: string | null;
  subdivisionCodes?: readonly string[] | null;
  subdivisionNames?: readonly string[] | null;
};

export function coalesceSubdivisionNames(
  search: StructuredSearchLocation,
): string[] {
  const fromArray = sanitizeLocationList(search.subdivisionNames);
  if (fromArray.length > 0) {
    return fromArray;
  }

  const single = sanitizeLocationToken(search.subdivisionName);
  return single ? [single] : [];
}

export function coalesceSubdivisionCodes(
  search: StructuredSearchLocation,
): string[] {
  const fromArray = sanitizeLocationList(search.subdivisionCodes);
  if (fromArray.length > 0) {
    return fromArray;
  }

  const single = sanitizeLocationToken(search.subdivisionCode);
  return single ? [single] : [];
}

export function deriveSavedSearchLocations(input: {
  countryName?: string | null;
  subdivisionName?: string | null;
  subdivisionNames?: readonly string[] | null;
  locations?: readonly string[];
}): string[] {
  const country = sanitizeLocationToken(input.countryName);
  const cities = coalesceSubdivisionNames({
    locations: [],
    subdivisionName: input.subdivisionName,
    subdivisionNames: input.subdivisionNames,
  });

  if (cities.length > 0 && country) {
    return uniqueLocations([
      ...cities,
      ...cities.map((city) => `${city}, ${country}`),
    ]);
  }

  if (cities.length > 0) {
    return [...cities];
  }

  if (country) {
    return [country];
  }

  return sanitizeLocationList(input.locations);
}

/**
 * Selected cities are fetch alternatives. Discovery fans them out because
 * Kariyer.net and LinkedIn public search accept one location at a time.
 */
export function adapterLocationsForFetch(
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

export function resolveSavedSearchLocation(
  search: StructuredSearchLocation,
  subdivisionAliases: readonly string[] = [],
): ResolvedSearchLocation {
  const country = sanitizeLocationToken(search.countryName);
  const cities = coalesceSubdivisionNames(search);
  const city = cities[0] ?? null;
  const legacy = sanitizeLocationList(search.locations);

  if (!country && cities.length === 0 && legacy.length === 0) {
    return emptyResolvedLocation();
  }

  if (cities.length > 0) {
    const locations = uniqueLocations([
      ...cities,
      ...cities.map((name) => (country ? `${name}, ${country}` : name)),
    ]);
    const label =
      cities.length === 1
        ? formatLocationLabel(city, country) ?? city
        : cities.join(', ');

    return {
      locations,
      label,
      source: 'search',
      city,
      cities,
      country,
    };
  }

  if (country) {
    return {
      locations: uniqueLocations([country, ...subdivisionAliases]),
      label: country,
      source: 'search',
      city: null,
      cities: [],
      country,
    };
  }

  return resolveLegacySearchLocations(legacy);
}

export function resolveEffectiveSearchLocation(
  savedSearchLocations: readonly string[],
  profile: ProfileLocation | null | undefined,
): ResolvedSearchLocation {
  const explicit = sanitizeLocationList(savedSearchLocations);
  const country = trimLocation(profile?.country);
  const city = trimLocation(profile?.city);

  if (explicit.length > 0) {
    const locations = explicit.map((location) =>
      completeExplicitLocation(location, country),
    );
    const primary = locations[0] ?? null;
    const parsed = parseCityCountry(primary);

    return {
      locations,
      label: locations.join(', '),
      source: 'search',
      city: parsed.city,
      cities: parsed.city ? [parsed.city] : [],
      country: parsed.country ?? country,
    };
  }

  if (city && country) {
    const label = formatLocationLabel(city, country);
    return {
      locations: label ? [label] : [],
      label,
      source: 'profile_city',
      city,
      cities: [city],
      country,
    };
  }

  if (country) {
    return {
      locations: [country],
      label: country,
      source: 'profile_country',
      city: null,
      cities: [],
      country,
    };
  }

  if (city) {
    return {
      locations: [city],
      label: city,
      source: 'profile_city',
      city,
      cities: [city],
      country: null,
    };
  }

  return emptyResolvedLocation();
}

export function jobLocationMatchResult(
  jobLocation: string | null | undefined,
  resolved: ResolvedSearchLocation,
  options?: {
    workModel?: string | null;
    countryCityAliases?: readonly string[];
  },
): 'pass' | 'fail' | 'skipped' | 'unknown' {
  if (resolved.source === 'none' || resolved.locations.length === 0) {
    return 'skipped';
  }

  const jobText = jobLocation ?? '';
  const cities =
    resolved.cities.length > 0
      ? resolved.cities
      : resolved.city
        ? [resolved.city]
        : [];

  if (cities.length > 0) {
    if (!trimLocation(jobLocation) && options?.workModel !== 'remote') {
      return 'fail';
    }

    if (cities.some((city) => locationTextIncludes(jobText, city))) {
      return 'pass';
    }

    if (
      isCountryWorkableRemote(jobText, options?.workModel, resolved, options?.countryCityAliases)
    ) {
      return 'pass';
    }

    return 'fail';
  }

  if (!trimLocation(jobLocation)) {
    return 'fail';
  }

  if (resolved.country) {
    if (locationTextIncludes(jobText, resolved.country)) {
      return 'pass';
    }

    const aliasHit = resolved.locations.some(
      (location) =>
        location !== resolved.country &&
        locationTextIncludes(jobText, location),
    );
    return aliasHit ? 'pass' : 'fail';
  }

  const matched = resolved.locations.some((location) =>
    locationTextIncludes(jobText, location),
  );
  return matched ? 'pass' : 'fail';
}

export function locationTextIncludes(haystack: string, needle: string): boolean {
  const hay = normalizeForSearch(haystack);
  const need = normalizeForSearch(needle);
  if (!need || !hay) {
    return false;
  }

  if (hay === need) {
    return true;
  }

  const hayTokens = hay.split(' ').filter((token) => token.length > 0);
  const needTokens = need.split(' ').filter((token) => token.length > 0);
  if (needTokens.length === 0) {
    return false;
  }

  if (needTokens.length === 1) {
    return hayTokens.includes(needTokens[0] ?? '');
  }

  return ` ${hay} `.includes(` ${need} `);
}

const REMOTE_LOCATION_LABELS = new Set([
  'remote',
  'uzaktan',
  'anywhere',
  'worldwide',
  'work from home',
  'home office',
  'remote turkey',
  'remote turkiye',
  'turkiye remote',
  'turkey remote',
]);

const COUNTRY_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  turkey: ['turkey', 'turkiye', 'tr'],
  turkiye: ['turkey', 'turkiye', 'tr'],
};

function isRemoteLocationLabel(value: string): boolean {
  const normalized = normalizeForSearch(value);
  if (!normalized) {
    return false;
  }

  if (REMOTE_LOCATION_LABELS.has(normalized)) {
    return true;
  }

  return (
    locationTextIncludes(value, 'remote') || locationTextIncludes(value, 'uzaktan')
  );
}

function countryNamesToMatch(country: string | null): string[] {
  const trimmed = trimLocation(country);
  if (!trimmed) {
    return [];
  }

  const aliases = COUNTRY_NAME_ALIASES[normalizeForSearch(trimmed)] ?? [trimmed];
  return [...new Set([trimmed, ...aliases])];
}

function isCountryWorkableRemote(
  jobLocation: string,
  workModel: string | null | undefined,
  resolved: ResolvedSearchLocation,
  countryCityAliases: readonly string[] = [],
): boolean {
  if (workModel !== 'remote') {
    return false;
  }

  if (isRemoteLocationLabel(jobLocation)) {
    return true;
  }

  if (!trimLocation(jobLocation)) {
    return false;
  }

  if (
    countryNamesToMatch(resolved.country).some((name) =>
      locationTextIncludes(jobLocation, name),
    )
  ) {
    return true;
  }

  return countryCityAliases.some((alias) => locationTextIncludes(jobLocation, alias));
}

function emptyResolvedLocation(): ResolvedSearchLocation {
  return {
    locations: [],
    label: null,
    source: 'none',
    city: null,
    cities: [],
    country: null,
  };
}

function resolveLegacySearchLocations(
  locations: readonly string[],
): ResolvedSearchLocation {
  return resolveEffectiveSearchLocation(locations, null);
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

function uniqueLocations(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = sanitizeLocationToken(value);
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function completeExplicitLocation(
  raw: string,
  profileCountry: string | null,
): string {
  if (raw.includes(',')) {
    return raw;
  }

  if (profileCountry && !locationTextIncludes(raw, profileCountry)) {
    return `${raw}, ${profileCountry}`;
  }

  return raw;
}

function parseCityCountry(label: string | null): {
  city: string | null;
  country: string | null;
} {
  if (!label) {
    return { city: null, country: null };
  }

  const separator = label.indexOf(',');
  if (separator === -1) {
    return { city: label, country: null };
  }

  return {
    city: trimLocation(label.slice(0, separator)),
    country: trimLocation(label.slice(separator + 1)),
  };
}

