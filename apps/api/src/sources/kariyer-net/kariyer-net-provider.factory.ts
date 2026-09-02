import { SourceConfigurationError } from '../source-errors.js';
import { KariyerNetMockProvider } from './kariyer-net-mock.provider.js';
import { KariyerNetUnconfiguredLiveProvider } from './kariyer-net-unconfigured-live.provider.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import type { KariyerNetProviderMode } from './kariyer-net.types.js';
import { KariyerNetWebProvider } from './kariyer-net-web.provider.js';

export function resolveKariyerNetProviderMode(
  raw: string | undefined,
): KariyerNetProviderMode {
  const normalized = raw?.trim().toLowerCase();

  if (normalized === undefined || normalized.length === 0 || normalized === 'mock') {
    return 'mock';
  }

  if (normalized === 'live') {
    return 'live';
  }

  throw new SourceConfigurationError(
    'kariyer_net',
    `Invalid KARIYER_NET_PROVIDER="${raw?.trim()}". Use mock or live.`,
  );
}

/**
 * Builds the Kariyer.net provider for the configured mode.
 * Live uses the public listing-page provider. Never falls back to mock data
 * when mode is live.
 */
export function createKariyerNetProvider(
  mode: KariyerNetProviderMode,
  liveProvider?: KariyerNetProvider,
): KariyerNetProvider {
  if (mode === 'mock') {
    return new KariyerNetMockProvider();
  }

  if (liveProvider && liveProvider.mode === 'live') {
    return liveProvider;
  }

  return new KariyerNetUnconfiguredLiveProvider();
}

export function createKariyerNetProviderFromConfig(env: {
  get(key: string): string | undefined;
}): KariyerNetProvider {
  const mode = resolveKariyerNetProviderMode(env.get('KARIYER_NET_PROVIDER'));
  if (mode === 'live') {
    return KariyerNetWebProvider.fromEnv(env);
  }

  return createKariyerNetProvider(mode);
}
