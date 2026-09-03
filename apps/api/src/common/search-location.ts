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
  country: string | null;
};

export function trimLocation(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
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

export function resolveEffectiveSearchLocation(
  savedSearchLocations: readonly string[],
  profile: ProfileLocation | null | undefined,
): ResolvedSearchLocation {
  const explicit = savedSearchLocations
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
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
      country,
    };
  }

  if (country) {
    return {
      locations: [country],
      label: country,
      source: 'profile_country',
      city: null,
      country,
    };
  }

  if (city) {
    return {
      locations: [city],
      label: city,
      source: 'profile_city',
      city,
      country: null,
    };
  }

  return {
    locations: [],
    label: null,
    source: 'none',
    city: null,
    country: null,
  };
}

export function jobLocationMatchResult(
  jobLocation: string | null | undefined,
  resolved: ResolvedSearchLocation,
): 'pass' | 'fail' | 'skipped' | 'unknown' {
  if (resolved.source === 'none' || resolved.locations.length === 0) {
    return 'skipped';
  }

  if (!trimLocation(jobLocation)) {
    return 'unknown';
  }

  const jobText = jobLocation ?? '';

  if (resolved.city) {
    if (locationTextIncludes(jobText, resolved.city)) {
      return 'pass';
    }

    if (
      resolved.country &&
      isCountryOnlyJobLocation(jobText, resolved.country)
    ) {
      return 'pass';
    }

    return 'fail';
  }

  if (resolved.country) {
    return locationTextIncludes(jobText, resolved.country) ? 'pass' : 'fail';
  }

  const matched = resolved.locations.some((location) =>
    locationTextIncludes(jobText, location),
  );
  return matched ? 'pass' : 'fail';
}

export function locationTextIncludes(haystack: string, needle: string): boolean {
  const hay = normalizeForSearch(haystack);
  const need = normalizeForSearch(needle);
  return Boolean(need) && hay.includes(need);
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

function isCountryOnlyJobLocation(jobLocation: string, country: string): boolean {
  if (!locationTextIncludes(jobLocation, country)) {
    return false;
  }

  const remainder = normalizeForSearch(jobLocation)
    .split(normalizeForSearch(country))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return remainder.length === 0;
}
