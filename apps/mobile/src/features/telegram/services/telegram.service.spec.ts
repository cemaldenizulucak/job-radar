import { afterEach, describe, expect, it, vi } from 'vitest';

import { telegramCopy } from '../copy';
import {
  createTelegramLinkCode,
  disconnectTelegram,
  getTelegramStatus,
} from './telegram.service';

const { apiGet, apiPost, apiDelete, ApiClientError } = vi.hoisted(() => {
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
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    ApiClientError,
  };
});

vi.mock('@/lib/api-client', () => ({
  ApiClientError,
  apiGet,
  apiPost,
  apiDelete,
}));

describe('telegram service', () => {
  afterEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  it('parses status without requiring a chat id', async () => {
    apiGet.mockResolvedValue({
      connected: true,
      displayName: '@ad***e',
      connectedAt: '2026-01-01T00:00:00.000Z',
      botUsername: 'JobRadarBot',
    });

    await expect(getTelegramStatus()).resolves.toEqual({
      connected: true,
      displayName: '@ad***e',
      connectedAt: '2026-01-01T00:00:00.000Z',
      botUsername: 'JobRadarBot',
    });
    expect(apiGet).toHaveBeenCalledWith('/v1/telegram/status');
  });

  it('creates a link code and disconnects without a userId body', async () => {
    apiPost.mockResolvedValue({
      code: 'JR-1234567890',
      expiresAt: '2026-01-01T00:10:00.000Z',
      botUsername: 'JobRadarBot',
    });
    apiDelete.mockResolvedValue({ ok: true });

    await expect(createTelegramLinkCode()).resolves.toMatchObject({
      code: 'JR-1234567890',
    });
    expect(apiPost).toHaveBeenCalledWith('/v1/telegram/link-code', {});

    await disconnectTelegram();
    expect(apiDelete).toHaveBeenCalledWith('/v1/telegram/connection');
  });

  it('maps API errors', async () => {
    apiGet.mockRejectedValue(new ApiClientError('nope', 500));
    await expect(getTelegramStatus()).rejects.toThrow('nope');
    expect(telegramCopy.sectionTitle).toBe('Telegram Bildirimleri');
  });
});
