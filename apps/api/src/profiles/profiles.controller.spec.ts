import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest, AuthenticatedUser } from '../auth/auth.types.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt.verifier.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

const user: AuthenticatedUser = { id: 'user-1', email: 'ada@example.com' };

function createContext(request: AuthenticatedRequest) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe('ProfilesController', () => {
  it('saves country and city for the authenticated JWT user', async () => {
    const update = vi.fn(async (userId: string) => ({
      userId,
      fullName: null,
      email: null,
      notificationsEnabled: true,
      timezone: null,
      country: 'Türkiye',
      city: 'İzmir',
    }));
    const controller = new ProfilesController({
      update,
    } as unknown as ProfilesService);

    await controller.update(user, {
      country: 'Türkiye',
      city: 'İzmir',
      userId: 'attacker',
    });

    expect(update).toHaveBeenCalledWith('user-1', {
      country: 'Türkiye',
      city: 'İzmir',
    });
  });

  it('allows a nullable city', async () => {
    const update = vi.fn(async (userId: string) => ({
      userId,
      fullName: null,
      email: null,
      notificationsEnabled: null,
      timezone: null,
      country: 'Türkiye',
      city: null,
    }));
    const controller = new ProfilesController({
      update,
    } as unknown as ProfilesService);

    await controller.update(user, { country: 'Türkiye', city: null });

    expect(update).toHaveBeenCalledWith('user-1', {
      country: 'Türkiye',
      city: null,
    });
  });
});

describe('PATCH /v1/profiles auth', () => {
  it('rejects unauthenticated requests', async () => {
    const guard = new AuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { verifyAccessToken: vi.fn() } as unknown as SupabaseJwtVerifier,
    );

    await expect(
      guard.canActivate(createContext({ headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
