import { SourceConfigurationError, SourceParseError } from '../source-errors.js';
import type { SourceSearchQuery } from '../job-source.adapter.js';
import {
  createLinkedInSourceAdapter,
  LinkedInSourceAdapter,
  resolveLinkedInProviderMode,
} from './linkedin-source.adapter.js';
import {
  LINKEDIN_FIXTURE_SOURCE_JOB_IDS,
} from './linkedin-jobs.fixture.js';
import { LinkedInDisabledProvider } from '../linkedin/linkedin-disabled.provider.js';
import { LinkedInMockProvider } from '../linkedin/linkedin-mock.provider.js';
import type { LinkedInProvider } from '../linkedin/linkedin.provider.js';
import {
  LINKEDIN_CAPABILITIES,
  type LinkedInProviderResult,
} from '../linkedin/linkedin.types.js';

const emptyQuery: SourceSearchQuery = {
  keywords: [],
  technologies: [],
  locations: [],
  workModels: [],
  experienceLevels: [],
};

describe('resolveLinkedInProviderMode', () => {
  it('defaults to disabled', () => {
    expect(resolveLinkedInProviderMode(undefined)).toBe('disabled');
    expect(resolveLinkedInProviderMode('')).toBe('disabled');
    expect(resolveLinkedInProviderMode('DISABLED')).toBe('disabled');
  });

  it('reads mock and live', () => {
    expect(resolveLinkedInProviderMode('mock')).toBe('mock');
    expect(resolveLinkedInProviderMode('MOCK')).toBe('mock');
    expect(resolveLinkedInProviderMode('live')).toBe('live');
  });

  it('rejects unknown values', () => {
    expect(() => resolveLinkedInProviderMode('scrape')).toThrow(
      SourceConfigurationError,
    );
  });
});

describe('LinkedInSourceAdapter', () => {
  it('returns fixture jobs only when mock is explicitly enabled', async () => {
    const adapter = new LinkedInSourceAdapter(new LinkedInMockProvider());
    const result = await adapter.search(emptyQuery);

    expect(adapter.isEnabled()).toBe(true);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      ...LINKEDIN_FIXTURE_SOURCE_JOB_IDS,
    ]);
  });

  it('contributes zero jobs when disabled and does not throw', async () => {
    const adapter = new LinkedInSourceAdapter(new LinkedInDisabledProvider());
    const result = await adapter.search(emptyQuery);

    expect(adapter.isEnabled()).toBe(false);
    expect(result.jobs).toEqual([]);
  });

  it('is disabled by default so fixtures are not inserted in live runs', async () => {
    const fromConfig = createLinkedInSourceAdapter({ get: () => undefined });

    expect(fromConfig.isEnabled()).toBe(false);
    await expect(fromConfig.search(emptyQuery)).resolves.toEqual({
      sourceId: 'linkedin',
      jobs: [],
      pagesFetched: 0,
      jobsCollected: 0,
      stopReason: null,
    });
  });

  it('passes saved search id and mapped keyword/location to the provider', async () => {
    let received: Parameters<LinkedInProvider['search']>[0] | undefined;
    const provider: LinkedInProvider = {
      mode: 'mock',
      capabilities: LINKEDIN_CAPABILITIES,
      isEnabled: () => true,
      search: async (input) => {
        received = input;
        return { jobs: [] };
      },
    };

    await new LinkedInSourceAdapter(provider).search({
      ...emptyQuery,
      keywords: ['frontend'],
      locations: ['Istanbul'],
      savedSearchId: 'search-1',
    });

    expect(received?.savedSearchId).toBe('search-1');
    expect(received?.keywords).toEqual(['frontend']);
    expect(received?.locations).toEqual(['Istanbul']);
  });

  it('throws SourceParseError when the provider envelope is malformed', async () => {
    const provider: LinkedInProvider = {
      mode: 'live',
      capabilities: LINKEDIN_CAPABILITIES,
      isEnabled: () => true,
      search: async () =>
        ({ jobs: null }) as unknown as LinkedInProviderResult,
    };

    await expect(
      new LinkedInSourceAdapter(provider).search(emptyQuery),
    ).rejects.toBeInstanceOf(SourceParseError);
  });

  it('does not mix mock fixture jobs into live mode', async () => {
    const provider: LinkedInProvider = {
      mode: 'live',
      capabilities: LINKEDIN_CAPABILITIES,
      isEnabled: () => true,
      search: async () => ({
        jobs: [
          {
            externalJobId: 'li-abc-frontend',
            canonicalUrl: 'https://www.linkedin.com/jobs/view/abc-frontend',
            title: 'Frontend Developer',
            companyName: 'ABC Technology',
          },
          {
            externalJobId: '3789011111',
            canonicalUrl: 'https://www.linkedin.com/jobs/view/3789011111',
            title: 'Front-End Developer',
            companyName: 'Acme',
          },
        ],
      }),
    };

    const result = await new LinkedInSourceAdapter(provider).search(emptyQuery);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.sourceJobId).toBe('3789011111');
  });
});
