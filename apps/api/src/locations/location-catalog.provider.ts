import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_COUNTRIES_URL = 'https://api.restcountries.com/countries/v5';
export const DEFAULT_STATES_URL =
  'https://cdn.jsdelivr.net/npm/@countrystatecity/countries-browser/dist/data/states/{code}.json';

const FETCH_TIMEOUT_MS = 12_000;
const REST_COUNTRIES_PAGE_SIZE = 100;
const REST_COUNTRIES_MAX_PAGES = 5;
const REST_COUNTRIES_FIELDS = 'codes.alpha_2,names.common,names.translations';

@Injectable()
export class LocationCatalogProvider {
  constructor(private readonly config: ConfigService) {}

  async fetchCountries(): Promise<unknown | null> {
    const apiKey = this.restCountriesApiKey();
    if (!apiKey) {
      return null;
    }

    const baseUrl = this.countriesUrl();
    if (!shouldPaginateRestCountries(baseUrl)) {
      return fetchJson(baseUrl, apiKey);
    }

    const collected: Record<string, unknown>[] = [];
    for (let page = 0; page < REST_COUNTRIES_MAX_PAGES; page += 1) {
      const offset = page * REST_COUNTRIES_PAGE_SIZE;
      const payload = await fetchJson(
        withRestCountriesPage(baseUrl, REST_COUNTRIES_PAGE_SIZE, offset),
        apiKey,
      );
      const rows = catalogRows(payload);
      collected.push(...rows);
      if (rows.length < REST_COUNTRIES_PAGE_SIZE) {
        break;
      }
    }

    return collected;
  }

  fetchStates(countryCode: string): Promise<unknown> {
    return fetchJson(this.statesUrl(countryCode));
  }

  private restCountriesApiKey(): string | null {
    const key = this.config.get<string>('REST_COUNTRIES_API_KEY')?.trim();
    return key && key.length > 0 ? key : null;
  }

  private countriesUrl(): string {
    const override = this.config.get<string>('LOCATION_COUNTRIES_URL')?.trim();
    if (!override || isDeprecatedRestCountriesUrl(override)) {
      return DEFAULT_COUNTRIES_URL;
    }

    return override;
  }

  private statesUrl(countryCode: string): string {
    const template =
      this.config.get<string>('LOCATION_STATES_URL')?.trim() ||
      DEFAULT_STATES_URL;
    return template.replaceAll('{code}', countryCode.trim().toUpperCase());
  }
}

export function isDeprecatedRestCountriesUrl(url: string): boolean {
  return (
    /restcountries\.com\/v3\.1/i.test(url) || /\/v3\.1(?:\/|\?|$)/i.test(url)
  );
}

function shouldPaginateRestCountries(url: string): boolean {
  try {
    return new URL(url).hostname === 'api.restcountries.com';
  } catch {
    return false;
  }
}

function withRestCountriesPage(
  base: string,
  limit: number,
  offset: number,
): string {
  const url = new URL(base);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (!url.searchParams.has('response_fields')) {
    url.searchParams.set('response_fields', REST_COUNTRIES_FIELDS);
  }
  return url.toString();
}

function catalogRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data.filter(isRecord);
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items.filter(isRecord);
  }

  if (Array.isArray(payload.countries)) {
    return payload.countries.filter(isRecord);
  }

  if (Array.isArray(payload.items)) {
    return payload.items.filter(isRecord);
  }

  return [];
}

async function fetchJson(url: string, apiKey?: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Location catalog request failed (${response.status}).`);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
