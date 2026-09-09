import { z } from 'zod';

import { ApiClientError, apiDelete, apiGet, apiPost } from '@/lib/api-client';

import type { TelegramLinkCode, TelegramStatus } from '../types';
import {
  telegramLinkCodeSchema,
  telegramStatusSchema,
} from '../validation/telegram.schema';

export class TelegramServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramServiceError';
  }
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  try {
    return telegramStatusSchema.parse(await apiGet('/v1/telegram/status'));
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  try {
    return telegramLinkCodeSchema.parse(await apiPost('/v1/telegram/link-code', {}));
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function disconnectTelegram(): Promise<void> {
  try {
    await apiDelete('/v1/telegram/connection');
  } catch (error) {
    throw toServiceError(error);
  }
}

function toServiceError(error: unknown): TelegramServiceError {
  if (error instanceof TelegramServiceError) {
    return error;
  }
  if (error instanceof ApiClientError) {
    return new TelegramServiceError(error.message);
  }
  if (error instanceof z.ZodError) {
    return new TelegramServiceError('Telegram beklenmeyen bir yanıt verdi.');
  }
  return new TelegramServiceError('Telegram isteği başarısız oldu.');
}
