import { ApiClientError, apiDelete, apiPost } from '@/lib/api-client';

export type RegisterPushTokenInput = {
  expoPushToken: string;
  platform: string;
};

export type UnregisterPushTokenInput = {
  expoPushToken: string;
};

export class PushTokenServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushTokenServiceError';
  }
}

function toServiceError(error: unknown): PushTokenServiceError {
  if (error instanceof PushTokenServiceError) {
    return error;
  }

  if (error instanceof ApiClientError) {
    return new PushTokenServiceError(error.message);
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new PushTokenServiceError(error.message);
  }

  return new PushTokenServiceError('Push bildirimi kaydedilemedi.');
}

export async function registerPushToken(
  input: RegisterPushTokenInput,
): Promise<void> {
  try {
    await apiPost('/v1/push-tokens', input);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function unregisterPushToken(
  input: UnregisterPushTokenInput,
): Promise<void> {
  try {
    await apiDelete('/v1/push-tokens', input);
  } catch (error) {
    throw toServiceError(error);
  }
}
