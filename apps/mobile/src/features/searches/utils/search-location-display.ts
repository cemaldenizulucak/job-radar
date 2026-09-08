import { formatLocationLabel } from '@/lib/search-location';

import type { SavedSearch } from '../types/search.types';
import { coalesceSubdivisionNames } from '../validation/search.schema';

export function searchLocationDisplay(search: SavedSearch): {
  label: string | null;
  fromProfile: boolean;
} {
  const cities = coalesceSubdivisionNames(search);
  if (cities.length > 1) {
    const cityLabel = cities.join(', ');
    return {
      label: search.countryName
        ? `${cityLabel}, ${search.countryName}`
        : cityLabel,
      fromProfile: false,
    };
  }

  const structured = formatLocationLabel(
    cities[0] ?? search.subdivisionName,
    search.countryName,
  );
  if (structured) {
    return { label: structured, fromProfile: false };
  }

  if (search.locationSource === 'search') {
    return {
      label: search.effectiveLocation ?? search.locations.join(', ') ?? null,
      fromProfile: false,
    };
  }

  if (search.locationSource === 'profile') {
    return {
      label: search.effectiveLocation,
      fromProfile: true,
    };
  }

  if (search.locations.length > 0) {
    return {
      label: search.locations.join(', '),
      fromProfile: false,
    };
  }

  return {
    label: search.effectiveLocation,
    fromProfile: Boolean(search.effectiveLocation),
  };
}

export function profileDefaultLocationLabel(
  profile: { city: string | null; country: string | null } | null,
): string | null {
  if (!profile) {
    return null;
  }

  return formatLocationLabel(profile.city, profile.country);
}
