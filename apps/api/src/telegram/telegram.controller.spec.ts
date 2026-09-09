import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest, AuthenticatedUser } from '../auth/auth.types.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt.verifier.js';
import { TelegramController } from './telegram.controller.js';
import { TelegramLinkService } from './telegram-link.service.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';

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

describe('TelegramController', () => {
  it('creates a link code for the JWT user and ignores a body userId', async () => {
    const createLinkCode = vi.fn(async (userId: string) => ({
      code: 'JR-1234567890',
      expiresAt: '2030-01-01T00:10:00.000Z',
      botUsername: 'JobRadarBot',
    }));
    const controller = new TelegramController(
      { createLinkCode } as unknown as TelegramLinkService,
      {} as TelegramWebhookService,
    );

    await controller.createLinkCode({ ...user, ...( { userId: 'attacker' } as object) });

    expect(createLinkCode).toHaveBeenCalledWith('user-1');
  });

  it('disconnects only the JWT user', async () => {
    const disconnect = vi.fn(async () => undefined);
    const controller = new TelegramController(
      { disconnect } as unknown as TelegramLinkService,
      {} as TelegramWebhookService,
    );

    await expect(controller.disconnect(user)).resolves.toEqual({ ok: true });
    expect(disconnect).toHaveBeenCalledWith('user-1');
  });

  it('forwards the Telegram secret header to the webhook service', async () => {
    const handleWebhook = vi.fn(async () => ({ ok: true as const }));
    const controller = new TelegramController(
      {} as TelegramLinkService,
      { handleWebhook } as unknown as TelegramWebhookService,
    );

    await controller.webhook('secret-token', { update_id: 1 });
    expect(handleWebhook).toHaveBeenCalledWith('secret-token', { update_id: 1 });
  });
});

describe('Telegram HTTP auth', () => {
  it('rejects unauthenticated link-code requests', async () => {
    const guard = new AuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { verifyAccessToken: vi.fn() } as unknown as SupabaseJwtVerifier,
    );

    await expect(
      guard.canActivate(createContext({ headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
