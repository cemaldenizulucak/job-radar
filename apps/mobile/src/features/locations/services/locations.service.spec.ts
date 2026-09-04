import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  listCountries,
  listSubdivisions,
  logLocationCatalogFailure,
  resetLocationCatalogCache,
} from './locations.service';

const { apiGetPublic, ApiClientError } = vi.hoisted(() => {
  class ApiClientError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
      this.name = 'ApiClientError';
    }
  }

  return {
    apiGetPublic: vi.fn(),
    ApiClientError,
  };
});

vi.mock('@/lib/api-client', () => ({
  ApiClientError,
  apiGetPublic,
}));

describe('locations.service', () => {
  afterEach(() => {
    resetLocationCatalogCache();
    apiGetPublic.mockReset();
    vi.restoreAllMocks();
  });

  it('loads the public country catalog', async () => {
    apiGetPublic.mockResolvedValue({
      items: [{ code: 'TR', name: 'Türkiye' }],
    });

    await expect(listCountries()).resolves.toEqual([
      { code: 'TR', name: 'Türkiye' },
    ]);
    expect(apiGetPublic).toHaveBeenCalledWith('/v1/locations/countries');
  });

  it('loads TR subdivisions from the public catalog', async () => {
    apiGetPublic.mockResolvedValue({
      items: [
        { code: '34', name: 'İstanbul' },
        { code: '35', name: 'İzmir' },
        { code: '06', name: 'Ankara' },
      ],
    });

    await expect(listSubdivisions('TR')).resolves.toEqual([
      { code: '34', name: 'İstanbul' },
      { code: '35', name: 'İzmir' },
      { code: '06', name: 'Ankara' },
    ]);
    expect(apiGetPublic).toHaveBeenCalledWith(
      '/v1/locations/subdivisions?countryCode=TR',
    );
  });

  it('logs 401/5xx catalog failures instead of swallowing them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    apiGetPublic.mockRejectedValue(new ApiClientError('Authentication required.', 401));

    await expect(listCountries()).rejects.toBeInstanceOf(ApiClientError);
    expect(warn).toHaveBeenCalledWith(
      'Locations catalog request failed',
      expect.objectContaining({
        endpoint: '/v1/locations/countries',
        status: 401,
      }),
    );
  });

  it('logs the endpoint and status for catalog failures', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logLocationCatalogFailure(
      '/v1/locations/subdivisions?countryCode=TR',
      new ApiClientError('Server error', 503),
    );

    expect(warn).toHaveBeenCalledWith(
      'Locations catalog request failed',
      expect.objectContaining({
        endpoint: '/v1/locations/subdivisions?countryCode=TR',
        status: 503,
      }),
    );
  });
});
