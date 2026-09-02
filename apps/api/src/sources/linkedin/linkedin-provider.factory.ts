import { SourceConfigurationError } from '../source-errors.js';
import { LinkedInDisabledProvider } from './linkedin-disabled.provider.js';
import { LinkedInMockProvider } from './linkedin-mock.provider.js';
import type { LinkedInProvider } from './linkedin.provider.js';
import type { LinkedInProviderMode } from './linkedin.types.js';
import { LinkedInWebProvider } from './linkedin-web.provider.js';

export function resolveLinkedInProviderMode(
  raw: string | undefined,
): LinkedInProviderMode {
  const normalized = raw?.trim().toLowerCase();

  if (
    normalized === undefined ||
    normalized.length === 0 ||
    normalized === 'disabled'
  ) {
    return 'disabled';
  }

  if (normalized === 'mock') {
    return 'mock';
  }

  if (normalized === 'live') {
    return 'live';
  }

  throw new SourceConfigurationError(
    'linkedin',
    `Invalid LINKEDIN_PROVIDER="${raw?.trim()}". Use disabled, mock, or live.`,
  );
}

export function createLinkedInProvider(
  mode: LinkedInProviderMode,
  liveProvider?: LinkedInProvider,
): LinkedInProvider {
  if (mode === 'disabled') {
    return new LinkedInDisabledProvider();
  }

  if (mode === 'mock') {
    return new LinkedInMockProvider();
  }

  if (liveProvider && liveProvider.mode === 'live') {
    return liveProvider;
  }

  return LinkedInWebProvider.fromEnv({ get: () => undefined });
}

export function createLinkedInProviderFromConfig(env: {
  get(key: string): string | undefined;
}): LinkedInProvider {
  const mode = resolveLinkedInProviderMode(env.get('LINKEDIN_PROVIDER'));
  if (mode === 'live') {
    return LinkedInWebProvider.fromEnv(env);
  }

  return createLinkedInProvider(mode);
}
