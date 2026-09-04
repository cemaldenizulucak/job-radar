import { LocationCatalogProvider } from './location-catalog.provider.js';
import { LocationsService } from './locations.service.js';
import type { LocationCountry, LocationSubdivision } from './locations.types.js';

function countryByCode(
  items: LocationCountry[],
  code: string,
): LocationCountry | undefined {
  return items.find((item) => item.code === code);
}

function subdivisionByCode(
  items: LocationSubdivision[],
  code: string,
): LocationSubdivision | undefined {
  return items.find((item) => item.code === code);
}

describe('LocationsService', () => {
  it('returns the fallback catalog with unique codes and Turkish TR when the provider is skipped', async () => {
    const provider = {
      fetchCountries: vi.fn().mockResolvedValue(null),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    const items = await service.listCountries();

    expect(items.length).toBeGreaterThan(200);
    expect(countryByCode(items, 'TR')).toEqual({
      code: 'TR',
      name: 'Türkiye',
    });
    expect(new Set(items.map((item) => item.code)).size).toBe(items.length);
    const names = items.map((item) => item.name);
    expect(names).toEqual(
      names.slice().sort((left, right) => left.localeCompare(right, 'tr')),
    );
    expect(provider.fetchCountries).toHaveBeenCalledTimes(1);
  });

  it('caches countries so the provider is called once', async () => {
    const provider = {
      fetchCountries: vi.fn().mockResolvedValue(null),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    await service.listCountries();
    await service.listCountries();
    expect(provider.fetchCountries).toHaveBeenCalledTimes(1);
  });

  it('keeps the fallback catalog when the country provider fails', async () => {
    const provider = {
      fetchCountries: vi.fn().mockRejectedValue(new Error('network')),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;

    const items = await new LocationsService(provider).listCountries();

    expect(items.length).toBeGreaterThan(200);
    expect(countryByCode(items, 'TR')).toEqual({
      code: 'TR',
      name: 'Türkiye',
    });
    expect(items).not.toEqual([]);
  });

  it('prefers fallback Turkish names over remote English names', async () => {
    const provider = {
      fetchCountries: vi.fn().mockResolvedValue([
        { iso2: 'TR', name: 'Turkey' },
        { iso2: 'ZZ', name: 'Zedland' },
      ]),
      fetchStates: vi.fn(),
    } as unknown as LocationCatalogProvider;

    const items = await new LocationsService(provider).listCountries();

    expect(countryByCode(items, 'TR')).toEqual({
      code: 'TR',
      name: 'Türkiye',
    });
    expect(countryByCode(items, 'ZZ')).toEqual({
      code: 'ZZ',
      name: 'Zedland',
    });
  });

  it('returns the 81-province TR catalog without calling the external provider', async () => {
    const provider = {
      fetchCountries: vi.fn(),
      fetchStates: vi.fn().mockResolvedValue([
        {
          country_code: 'TR',
          iso2: '36',
          name: 'Wrong',
        },
      ]),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    const items = await service.listSubdivisions('TR');
    await service.listSubdivisions('tr');

    expect(items).toHaveLength(81);
    expect(subdivisionByCode(items, '34')).toEqual({
      code: '34',
      name: 'İstanbul',
    });
    expect(subdivisionByCode(items, '35')).toEqual({
      code: '35',
      name: 'İzmir',
    });
    expect(subdivisionByCode(items, '36')).toEqual({
      code: '36',
      name: 'Kars',
    });
    expect(subdivisionByCode(items, '52')).toEqual({
      code: '52',
      name: 'Ordu',
    });
    expect(provider.fetchStates).not.toHaveBeenCalled();
    expect(service.getCachedSubdivisionNames('TR')).toHaveLength(81);
  });

  it('still fetches subdivisions from the provider for non-TR countries', async () => {
    const provider = {
      fetchCountries: vi.fn(),
      fetchStates: vi.fn().mockResolvedValue([
        {
          country_code: 'DE',
          iso2: 'BE',
          name: 'Berlin',
          native: 'Berlin',
        },
      ]),
    } as unknown as LocationCatalogProvider;
    const service = new LocationsService(provider);

    await expect(service.listSubdivisions('DE')).resolves.toEqual([
      { code: 'BE', name: 'Berlin' },
    ]);
    await expect(service.listSubdivisions('DE')).resolves.toEqual([
      { code: 'BE', name: 'Berlin' },
    ]);
    expect(provider.fetchStates).toHaveBeenCalledTimes(1);
  });

  it('returns an empty subdivision list when a non-TR provider fails', async () => {
    const provider = {
      fetchCountries: vi.fn(),
      fetchStates: vi.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as LocationCatalogProvider;

    await expect(
      new LocationsService(provider).listSubdivisions('DE'),
    ).resolves.toEqual([]);
  });
});
