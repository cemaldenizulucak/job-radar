import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_COUNTRIES_URL =
  'https://restcountries.com/v3.1/all?fields=cca2,name';
export const DEFAULT_STATES_URL =
  'https://cdn.jsdelivr.net/npm/@countrystatecity/countries-browser/dist/data/states/{code}.json';

const FETCH_TIMEOUT_MS = 12_000;

@Injectable()
export class LocationCatalogProvider {
  constructor(private readonly config: ConfigService) {}

  fetchCountries(): Promise<unknown> {
    return fetchJson(this.countriesUrl());
  }

  fetchStates(countryCode: string): Promise<unknown> {
    return fetchJson(this.statesUrl(countryCode));
  }

  private countriesUrl(): string {
    return (
      this.config.get<string>('LOCATION_COUNTRIES_URL')?.trim() ||
      DEFAULT_COUNTRIES_URL
    );
  }

  private statesUrl(countryCode: string): string {
    const template =
      this.config.get<string>('LOCATION_STATES_URL')?.trim() ||
      DEFAULT_STATES_URL;
    return template.replaceAll('{code}', countryCode.trim().toUpperCase());
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Location catalog request failed (${response.status}).`);
  }

  return response.json();
}
