import { Injectable, Logger } from '@nestjs/common';

import { LocationCache } from './location-cache.js';
import { LocationCatalogProvider } from './location-catalog.provider.js';
import {
  normalizeCountries,
  normalizeSubdivisions,
} from './location-normalize.js';
import type {
  LocationCountry,
  LocationSubdivision,
} from './locations.types.js';

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

    try {
      const items = normalizeCountries(await this.provider.fetchCountries());
      this.cache.setCountries(items);
      return items;
    } catch (error) {
      this.logger.warn({
        message: 'Country catalog unavailable; returning empty list',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return [];
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
