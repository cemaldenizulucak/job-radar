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

export function hasProfileCountry(
  profile: ProfileLocation | null | undefined,
): boolean {
  return Boolean(trimLocation(profile?.country));
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

function completeExplicitLocation(
  raw: string,
  profileCountry: string | null,
): string {
  if (raw.includes(',')) {
    return raw;
  }

  if (
    profileCountry &&
    !raw.toLocaleLowerCase('tr').includes(profileCountry.toLocaleLowerCase('tr'))
  ) {
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
