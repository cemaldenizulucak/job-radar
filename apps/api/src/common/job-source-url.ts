import { isIP } from 'node:net';

const ALLOWED_REGISTRABLE_DOMAINS = ['kariyer.net', 'linkedin.com'] as const;

export function isAllowedJobSourceUrl(raw: string): boolean {
  try {
    assertAllowedJobSourceUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function assertAllowedJobSourceUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Listing URL is invalid.');
  }

  const url = new URL(trimmed);
  if (url.protocol !== 'https:') {
    throw new Error('Listing URL must use https.');
  }

  if (url.username || url.password) {
    throw new Error('Listing URL must not include credentials.');
  }

  if (url.port && url.port !== '443') {
    throw new Error('Listing URL host is not allowed.');
  }

  const host = normalizeHostname(url.hostname);
  if (
    !host ||
    isIP(host) !== 0 ||
    hostnameIsBlocked(host) ||
    !isAllowedJobSourceHost(host)
  ) {
    throw new Error('Listing URL host is not allowed.');
  }

  return url;
}

export function redirectKeepsJobSourceHost(
  requested: string,
  finalUrl: string | undefined,
): boolean {
  if (!finalUrl) {
    return true;
  }

  try {
    const from = assertAllowedJobSourceUrl(requested);
    const to = assertAllowedJobSourceUrl(finalUrl);
    return normalizeHostname(from.hostname) === normalizeHostname(to.hostname);
  } catch {
    return false;
  }
}

export function isAllowedJobSourceHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return ALLOWED_REGISTRABLE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function hostnameIsBlocked(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}
