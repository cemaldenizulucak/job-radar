import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_COUNTRIES_URL,
  isDeprecatedRestCountriesUrl,
  LocationCatalogProvider,
} from './location-catalog.provider.js';

function configWith(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('LocationCatalogProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats REST Countries v3.1 URLs as deprecated', () => {
    expect(
      isDeprecatedRestCountriesUrl(
        'https://restcountries.com/v3.1/all?fields=cca2,name',
      ),
    ).toBe(true);
    expect(isDeprecatedRestCountriesUrl(DEFAULT_COUNTRIES_URL)).toBe(false);
  });

  it('skips the network when REST_COUNTRIES_API_KEY is unset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new LocationCatalogProvider(configWith({})).fetchCountries(),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the network when REST_COUNTRIES_API_KEY is blank', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new LocationCatalogProvider(
        configWith({ REST_COUNTRIES_API_KEY: '   ' }),
      ).fetchCountries(),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the v5 endpoint with a Bearer token and does not put the key in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            codes: { alpha_2: 'TR' },
            names: { common: 'Turkey' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new LocationCatalogProvider(
      configWith({ REST_COUNTRIES_API_KEY: 'test-secret-key' }),
    ).fetchCountries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toContain('https://api.restcountries.com/countries/v5');
    expect(url).toContain('limit=100');
    expect(init.headers.Authorization).toBe('Bearer test-secret-key');
    expect(url).not.toContain('test-secret-key');
  });

  it('ignores a deprecated v3.1 override and still calls v5', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await new LocationCatalogProvider(
      configWith({
        REST_COUNTRIES_API_KEY: 'test-secret-key',
        LOCATION_COUNTRIES_URL:
          'https://restcountries.com/v3.1/all?fields=cca2,name',
      }),
    ).fetchCountries();

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('https://api.restcountries.com/countries/v5');
    expect(url).not.toContain('v3.1');
  });
});
