import type { LocationCountry, LocationSubdivision } from './locations.types.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class LocationCache {
  private countries: CacheEntry<readonly LocationCountry[]> | null = null;
  private readonly subdivisions = new Map<
    string,
    CacheEntry<readonly LocationSubdivision[]>
  >();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  getCountries(): readonly LocationCountry[] | null {
    return readFresh(this.countries);
  }

  setCountries(value: readonly LocationCountry[]): void {
    this.countries = { value, expiresAt: Date.now() + this.ttlMs };
  }

  getSubdivisions(countryCode: string): readonly LocationSubdivision[] | null {
    return readFresh(this.subdivisions.get(countryCode.trim().toUpperCase()));
  }

  setSubdivisions(
    countryCode: string,
    value: readonly LocationSubdivision[],
  ): void {
    this.subdivisions.set(countryCode.trim().toUpperCase(), {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

function readFresh<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}
