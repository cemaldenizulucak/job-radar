import { SourceConfigurationError } from '../source-errors.js';
import { LinkedInDisabledProvider } from './linkedin-disabled.provider.js';
import { LinkedInMockProvider } from './linkedin-mock.provider.js';
import {
  createLinkedInProvider,
  createLinkedInProviderFromConfig,
  resolveLinkedInProviderMode,
} from './linkedin-provider.factory.js';
import { LINKEDIN_CAPABILITIES } from './linkedin.types.js';
import { LinkedInWebProvider } from './linkedin-web.provider.js';

const emptyInput = {
  keywords: [],
  locations: [],
  workTypes: [],
  experienceLevels: [],
};

describe('resolveLinkedInProviderMode', () => {
  it('defaults to disabled', () => {
    expect(resolveLinkedInProviderMode(undefined)).toBe('disabled');
  });

  it('rejects unknown values', () => {
    expect(() => resolveLinkedInProviderMode('scrape')).toThrow(
      SourceConfigurationError,
    );
  });
});

describe('createLinkedInProvider', () => {
  it('uses the disabled provider by default', async () => {
    const provider = createLinkedInProvider('disabled');

    expect(provider).toBeInstanceOf(LinkedInDisabledProvider);
    expect(provider.isEnabled()).toBe(false);
    await expect(provider.search(emptyInput)).resolves.toEqual({
      jobs: [],
      pagesFetched: 0,
      jobsCollected: 0,
      stopReason: null,
    });
  });

  it('uses the development mock provider in mock mode', async () => {
    const provider = createLinkedInProvider('mock');

    expect(provider).toBeInstanceOf(LinkedInMockProvider);
    expect(provider.capabilities).toEqual(LINKEDIN_CAPABILITIES);
    const result = await provider.search(emptyInput);
    expect(result.jobs).toHaveLength(3);
  });
});

describe('createLinkedInProviderFromConfig', () => {
  it('builds LinkedInWebProvider when live is selected', () => {
    const provider = createLinkedInProviderFromConfig({
      get: (key) => (key === 'LINKEDIN_PROVIDER' ? 'live' : undefined),
    });

    expect(provider).toBeInstanceOf(LinkedInWebProvider);
    expect(provider.mode).toBe('live');
    expect(provider).not.toBeInstanceOf(LinkedInMockProvider);
  });
});
