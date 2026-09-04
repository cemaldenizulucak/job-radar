import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../auth/auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt.verifier.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

describe('LocationsController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: {
            listCountries: async () => [{ code: 'TR', name: 'Türkiye' }],
            listSubdivisions: async (countryCode: string) =>
              countryCode === 'TR'
                ? [
                    { code: '34', name: 'İstanbul' },
                    { code: '35', name: 'İzmir' },
                    { code: '06', name: 'Ankara' },
                  ]
                : [],
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

  it('GET /v1/locations/countries returns 200 without authentication', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/locations/countries',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{ code: 'TR', name: 'Türkiye' }],
    });
  });

  it('GET /v1/locations/subdivisions?countryCode=TR returns 200 without authentication', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/locations/subdivisions',
    ).query({ countryCode: 'TR' });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        { code: '34', name: 'İstanbul' },
        { code: '35', name: 'İzmir' },
        { code: '06', name: 'Ankara' },
      ]),
    );
  });
});
