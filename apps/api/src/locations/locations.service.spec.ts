import { LocationCatalogProvider } from './location-catalog.provider.js';
import { LocationsService } from './locations.service.js';

describe('LocationsService', () => {
  it('caches countries so the provider is called once', async () => {
    const provider = {
      fetchCountries: vi.fn().mockResolvedValue([
        { iso2: 'TR', name: 'Turkey', native: 'Türkiye' },
      ]),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    await expect(service.listCountries()).resolves.toEqual([
      { code: 'TR', name: 'Türkiye' },
    ]);
    await expect(service.listCountries()).resolves.toEqual([
      { code: 'TR', name: 'Türkiye' },
    ]);
    expect(provider.fetchCountries).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the country catalog fails', async () => {
    const provider = {
      fetchCountries: vi.fn().mockRejectedValue(new Error('network')),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;

    await expect(new LocationsService(provider).listCountries()).resolves.toEqual(
      [],
    );
  });

  it('caches subdivisions per country so the provider is called once per country', async () => {
    const provider = {
      fetchCountries: vi.fn(),
      fetchStates: vi.fn(async (countryCode: string) =>
        countryCode === 'TR'
          ? [
              {
                country_code: 'TR',
                iso2: '34',
                name: 'Istanbul',
                native: 'İstanbul',
              },
            ]
          : [
              {
                country_code: 'DE',
                iso2: 'BE',
                name: 'Berlin',
                native: 'Berlin',
              },
            ],
      ),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    await expect(service.listSubdivisions('TR')).resolves.toEqual([
      { code: '34', name: 'İstanbul' },
    ]);
    await expect(service.listSubdivisions('TR')).resolves.toEqual([
      { code: '34', name: 'İstanbul' },
    ]);
    await expect(service.listSubdivisions('DE')).resolves.toEqual([
      { code: 'BE', name: 'Berlin' },
    ]);
    expect(provider.fetchStates).toHaveBeenCalledTimes(2);
    expect(service.getCachedSubdivisionNames('TR')).toEqual(['İstanbul']);
  });

  it('returns an empty subdivision list when the provider fails', async () => {
    const provider = {
      fetchCountries: vi.fn(),
      fetchStates: vi.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as LocationCatalogProvider;

    await expect(
      new LocationsService(provider).listSubdivisions('TR'),
    ).resolves.toEqual([]);
  });
});
