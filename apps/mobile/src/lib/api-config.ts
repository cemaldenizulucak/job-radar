import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { resolveApiBaseUrl } from './api-base-url';

export { resolveApiBaseUrl } from './api-base-url';
export type { ApiBaseUrlInput } from './api-base-url';

let hasLoggedApiBaseUrl = false;

export function getApiBaseUrl(): string {
  const baseUrl = resolveApiBaseUrl({
    envUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    extraUrl: readExtraApiBaseUrl(),
    platform: Platform.OS,
    isPhysicalDevice: Device.isDevice === true,
    metroHost: readMetroHost(),
  });

  if (typeof __DEV__ !== 'undefined' && __DEV__ && !hasLoggedApiBaseUrl) {
    hasLoggedApiBaseUrl = true;
    console.info(`API base URL: ${baseUrl}`);
  }

  return baseUrl;
}

export function logDevApiRequestFailure(input: {
  endpoint: string;
  error: unknown;
}): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const errorName = input.error instanceof Error ? input.error.name : 'Error';
  const message =
    input.error instanceof Error && input.error.message.trim().length > 0
      ? input.error.message
      : 'Request failed';

  console.warn(
    [
      'API request failed',
      `API base URL: ${getApiBaseUrl()}`,
      `endpoint: ${input.endpoint}`,
      `error: ${errorName}`,
      `message: ${message}`,
    ].join('\n'),
  );
}

function readExtraApiBaseUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: unknown } | undefined;
  return typeof extra?.apiBaseUrl === 'string' ? extra.apiBaseUrl : null;
}

function readMetroHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  return typeof hostUri === 'string' ? hostUri : null;
}
