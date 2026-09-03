const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export type ApiBaseUrlInput = {
  envUrl?: string | null;
  extraUrl?: string | null;
  platform: string;
  isPhysicalDevice: boolean;
  metroHost?: string | null;
};

export function resolveApiBaseUrl(input: ApiBaseUrlInput): string {
  const envUrl = trimBaseUrl(input.envUrl);
  const extraUrl = trimBaseUrl(input.extraUrl);
  const preferred =
    firstNonLoopback([envUrl, extraUrl]) ?? envUrl ?? extraUrl ?? DEFAULT_API_BASE_URL;

  if (shouldRewriteLoopbackForPhysicalDevice(input.platform) && input.isPhysicalDevice) {
    if (!isLoopbackUrl(preferred)) {
      return preferred;
    }

    const lanHost = lanHostname(input.metroHost);
    if (lanHost) {
      return replaceHostname(preferred, lanHost);
    }
  }

  return preferred;
}

function shouldRewriteLoopbackForPhysicalDevice(platform: string): boolean {
  return platform === 'android' || platform === 'ios';
}

function trimBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function firstNonLoopback(values: (string | null)[]): string | null {
  return values.find((value): value is string => value !== null && !isLoopbackUrl(value)) ?? null;
}

function isLoopbackUrl(value: string): boolean {
  const hostname = hostnameOf(value);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function lanHostname(value: string | null | undefined): string | null {
  const hostname = hostnameOf(value ?? '');
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  return hostname;
}

function hostnameOf(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const withProtocol = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

function replaceHostname(baseUrl: string, hostname: string): string {
  try {
    const url = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`);
    url.hostname = hostname;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return baseUrl;
  }
}
