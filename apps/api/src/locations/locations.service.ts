import { Injectable, Logger } from '@nestjs/common';

import { FALLBACK_COUNTRIES } from './iso-country-catalog.js';
import { LocationCache } from './location-cache.js';
import { LocationCatalogProvider } from './location-catalog.provider.js';
import {
  mergeCountryCatalogs,
  normalizeCountries,
  normalizeSubdivisions,
  sortLocationItems,
} from './location-normalize.js';
import type {
  LocationCountry,
  LocationSubdivision,
} from './locations.types.js';
import { TURKEY_PROVINCES } from './turkey-subdivision-catalog.js';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);
  private readonly cache = new LocationCache();

  constructor(private readonly provider: LocationCatalogProvider) {}

  async listCountries(): Promise<LocationCountry[]> {
    const cached = this.cache.getCountries();
    if (cached) {
      return [...cached];
    }

    const fallback = sortLocationItems(FALLBACK_COUNTRIES);

    try {
      const remote = await this.provider.fetchCountries();
      if (remote == null) {
        this.cache.setCountries(fallback);
        return [...fallback];
      }

      const merged = mergeCountryCatalogs(
        FALLBACK_COUNTRIES,
        normalizeCountries(remote),
      );
      const items = merged.length > 0 ? merged : fallback;
      this.cache.setCountries(items);
      return [...items];
    } catch (error) {
      this.logger.warn({
        message: 'Country provider failed; using built-in fallback catalog',
        error: error instanceof Error ? error.message : 'unknown',
      });
      this.cache.setCountries(fallback);
      return [...fallback];
    }
  }

  getCachedSubdivisionNames(countryCode: string): readonly string[] | null {
    const cached = this.cache.getSubdivisions(countryCode);
    return cached ? cached.map((item) => item.name) : null;
  }

  async primeSubdivisionCaches(
    countryCodes: readonly string[],
  ): Promise<void> {
    const unique = [
      ...new Set(
        countryCodes
          .map((code) => code.trim().toUpperCase())
          .filter((code) => code.length > 0),
      ),
    ];

    await Promise.all(unique.map((code) => this.listSubdivisions(code)));
  }

  async listSubdivisions(countryCode: string): Promise<LocationSubdivision[]> {
    const code = countryCode.trim().toUpperCase();
    if (!code) {
      return [];
    }

    const cached = this.cache.getSubdivisions(code);
    if (cached) {
      return [...cached];
    }

    if (code === 'TR') {
      const items = sortLocationItems(TURKEY_PROVINCES);
      this.cache.setSubdivisions(code, items);
      return [...items];
    }

    try {
      const catalog = await this.provider.fetchStates(code);
      const items = normalizeSubdivisions(catalog, code);
      this.cache.setSubdivisions(code, items);
      return items;
    } catch (error) {
      this.logger.warn({
        message: 'Subdivision catalog unavailable; returning empty list',
        countryCode: code,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return [];
    }
  }
}
