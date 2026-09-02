import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

function createContext(request: AuthenticatedRequest) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe('AuthGuard', () => {
  it('allows public handlers without verifying a token', async () => {
    const verifyAccessToken = vi.fn();
    const guard = new AuthGuard(
      { getAllAndOverride: () => true } as unknown as Reflector,
      { verifyAccessToken } as unknown as SupabaseJwtVerifier,
    );

    await expect(
      guard.canActivate(
        createContext({ headers: {} }) as never,
      ),
    ).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects missing bearer tokens', async () => {
    const guard = new AuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { verifyAccessToken: vi.fn() } as unknown as SupabaseJwtVerifier,
    );

    await expect(
      guard.canActivate(createContext({ headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the verified user to the request', async () => {
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer token' },
    };
    const guard = new AuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      {
        verifyAccessToken: async () => ({ id: 'user-1', email: null }),
      } as unknown as SupabaseJwtVerifier,
    );

    await expect(guard.canActivate(createContext(request) as never)).resolves.toBe(
      true,
    );
    expect(request.user).toEqual({ id: 'user-1', email: null });
  });
});
