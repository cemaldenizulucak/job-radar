import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../auth/auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt.verifier.js';
import { LocationCatalogProvider } from './location-catalog.provider.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

describe('LocationsController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        LocationsService,
        {
          provide: LocationCatalogProvider,
          useValue: {
            fetchCountries: vi.fn().mockResolvedValue(null),
            fetchStates: vi.fn().mockRejectedValue(new Error('unused')),
          },
        },
        {
          provide: SupabaseJwtVerifier,
          useValue: { verifyAccessToken: vi.fn() },
        },
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('is marked public so AuthGuard skips JWT', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, LocationsController)).toBe(true);
  });

  it('GET /v1/locations/countries returns the fallback catalog without authentication', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/locations/countries',
    );

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(200);

    const codes = response.body.items.map(
      (item: { code: string }) => item.code,
    );
    expect(new Set(codes).size).toBe(codes.length);

    const turkey = response.body.items.find(
      (item: { code: string; name: string }) => item.code === 'TR',
    );
    expect(turkey).toEqual({ code: 'TR', name: 'Türkiye' });
  });

  it('GET /v1/locations/subdivisions?countryCode=TR returns 81 provinces without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/locations/subdivisions')
      .query({ countryCode: 'TR' });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(81);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        { code: '34', name: 'İstanbul' },
        { code: '35', name: 'İzmir' },
        { code: '36', name: 'Kars' },
        { code: '52', name: 'Ordu' },
      ]),
    );
  });
});
