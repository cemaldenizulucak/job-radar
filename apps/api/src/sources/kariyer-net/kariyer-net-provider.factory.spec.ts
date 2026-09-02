import { SourceConfigurationError } from '../source-errors.js';
import { KariyerNetMockProvider } from './kariyer-net-mock.provider.js';
import {
  createKariyerNetProvider,
  createKariyerNetProviderFromConfig,
  resolveKariyerNetProviderMode,
} from './kariyer-net-provider.factory.js';
import { KariyerNetUnconfiguredLiveProvider } from './kariyer-net-unconfigured-live.provider.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import { KARIYER_NET_CAPABILITIES } from './kariyer-net.types.js';
import { KariyerNetWebProvider } from './kariyer-net-web.provider.js';

const emptyInput = {
  keywords: [],
  locations: [],
  workTypes: [],
  experienceLevels: [],
};

describe('resolveKariyerNetProviderMode', () => {
  it('defaults to mock', () => {
    expect(resolveKariyerNetProviderMode(undefined)).toBe('mock');
    expect(resolveKariyerNetProviderMode('')).toBe('mock');
    expect(resolveKariyerNetProviderMode('MOCK')).toBe('mock');
  });

  it('reads live', () => {
    expect(resolveKariyerNetProviderMode('live')).toBe('live');
  });

  it('rejects unknown values', () => {
    expect(() => resolveKariyerNetProviderMode('scrape')).toThrow(
      SourceConfigurationError,
    );
  });
});

describe('createKariyerNetProvider', () => {
  it('uses the development mock provider in mock mode', async () => {
    const provider = createKariyerNetProvider('mock');

    expect(provider).toBeInstanceOf(KariyerNetMockProvider);
    expect(provider.mode).toBe('mock');
    expect(provider.capabilities).toEqual(KARIYER_NET_CAPABILITIES);
    expect(provider.capabilities.supportsRemoteFilter).toBe(false);
    expect(provider.capabilities.supportsExperienceLevel).toBe(false);

    const result = await provider.search(emptyInput);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      'kn-abc-frontend',
      'kn-pixel-react',
      'kn-orbit-angular',
    ]);
  });

  it('fails closed in live mode when no live provider is configured', async () => {
    const provider = createKariyerNetProvider('live');

    expect(provider).toBeInstanceOf(KariyerNetUnconfiguredLiveProvider);
    expect(provider).not.toBeInstanceOf(KariyerNetMockProvider);
    expect(provider.mode).toBe('live');

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceConfigurationError,
    );
    await expect(provider.search(emptyInput)).rejects.toThrow(
      /live provider is not configured/i,
    );
  });

  it('uses the supplied live provider and does not fall back to mock', async () => {
    const live: KariyerNetProvider = {
      mode: 'live',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async () => ({
        jobs: [
          {
            externalJobId: 'live-1',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/live-1',
            title: 'Frontend Developer',
            companyName: 'Live Co',
          },
        ],
      }),
    };

    const provider = createKariyerNetProvider('live', live);
    const result = await provider.search(emptyInput);

    expect(provider).toBe(live);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.externalJobId).toBe('live-1');
  });
});

describe('createKariyerNetProviderFromConfig', () => {
  it('builds KariyerNetWebProvider when live is selected', () => {
    const provider = createKariyerNetProviderFromConfig({
      get: (key) => (key === 'KARIYER_NET_PROVIDER' ? 'live' : undefined),
    });

    expect(provider).toBeInstanceOf(KariyerNetWebProvider);
    expect(provider.mode).toBe('live');
    expect(provider).not.toBeInstanceOf(KariyerNetMockProvider);
  });
});
