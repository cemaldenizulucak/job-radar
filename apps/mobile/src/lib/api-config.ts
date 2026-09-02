const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const baseUrl =
    configured && configured.length > 0 ? configured : DEFAULT_API_BASE_URL;

  return baseUrl.replace(/\/+$/, '');
}
