import { KariyerNetSourceAdapter } from '../adapters/kariyer-net-source.adapter.js';
import type { SourceSearchQuery } from '../job-source.adapter.js';
import { SourceConfigurationError, SourceParseError } from '../source-errors.js';
import { KariyerNetMockProvider } from './kariyer-net-mock.provider.js';
import { createKariyerNetProvider } from './kariyer-net-provider.factory.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import { KARIYER_NET_CAPABILITIES } from './kariyer-net.types.js';
import type { KariyerNetProviderResult } from './kariyer-net.types.js';

const emptyQuery: SourceSearchQuery = {
  keywords: [],
  technologies: [],
  locations: [],
  workModels: [],
  experienceLevels: [],
};

function adapter(provider: KariyerNetProvider = new KariyerNetMockProvider()) {
  return new KariyerNetSourceAdapter(provider);
}

describe('KariyerNetSourceAdapter', () => {
  it('exposes conservative Kariyer.net capabilities', () => {
    const source = adapter();

    expect(source.sourceId).toBe('kariyer_net');
    expect(source.isEnabled()).toBe(true);
    expect(source.capabilities).toEqual(KARIYER_NET_CAPABILITIES);
    expect(source.capabilities.supportsKeywordSearch).toBe(true);
    expect(source.capabilities.supportsLocation).toBe(true);
    expect(source.capabilities.supportsRemoteFilter).toBe(false);
    expect(source.capabilities.supportsExperienceLevel).toBe(false);
  });

  it('passes saved search id and mapped keyword/location to the provider', async () => {
    let received: Parameters<KariyerNetProvider['search']>[0] | undefined;
    const provider: KariyerNetProvider = {
      mode: 'mock',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async (input) => {
        received = input;
        return { jobs: [] };
      },
    };

    await adapter(provider).search({
      ...emptyQuery,
      keywords: ['frontend'],
      locations: ['Istanbul'],
      savedSearchId: 'search-1',
    });

    expect(received?.savedSearchId).toBe('search-1');
    expect(received?.keywords).toEqual(['frontend']);
    expect(received?.locations).toEqual(['Istanbul']);
  });

  it('returns fixture jobs from the mock provider without network access', async () => {
    const result = await adapter().search(emptyQuery);

    expect(result.sourceId).toBe('kariyer_net');
    expect(result.jobs).toHaveLength(3);
    expect(result.pagesFetched).toBe(1);
    expect(result.jobsCollected).toBe(3);
    expect(result.stopReason).toBeNull();
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      'kn-abc-frontend',
      'kn-pixel-react',
      'kn-orbit-angular',
    ]);
  });

  it('drops malformed provider jobs and keeps valid ones', async () => {
    const provider: KariyerNetProvider = {
      mode: 'live',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async () =>
        ({
          jobs: [
            { title: 'Missing identity' },
            null,
            {
              externalJobId: 'kn-ok',
              canonicalUrl: 'https://www.kariyer.net/is-ilani/ok',
              title: 'Frontend Developer',
              companyName: 'OK Co',
            },
          ],
        }) as unknown as KariyerNetProviderResult,
    };

    const result = await adapter(provider).search(emptyQuery);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.sourceJobId).toBe('kn-ok');
  });

  it('drops a listing that is missing companyName because NormalizedJob requires it', async () => {
    const provider: KariyerNetProvider = {
      mode: 'live',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async () => ({
        jobs: [
          {
            externalJobId: '4291111111',
            canonicalUrl:
              'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111',
            title: 'Frontend Developer',
          },
        ],
      }),
    };

    const result = await adapter(provider).search(emptyQuery);

    expect(result.jobs).toHaveLength(0);
  });

  it('throws SourceParseError when the provider envelope is malformed', async () => {
    const provider: KariyerNetProvider = {
      mode: 'live',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async () =>
        ({ jobs: null }) as unknown as KariyerNetProviderResult,
    };

    await expect(adapter(provider).search(emptyQuery)).rejects.toBeInstanceOf(
      SourceParseError,
    );
  });

  it('does not mix mock fixture jobs into live mode', async () => {
    const provider: KariyerNetProvider = {
      mode: 'live',
      capabilities: KARIYER_NET_CAPABILITIES,
      isEnabled: () => true,
      search: async () => ({
        jobs: [
          {
            externalJobId: 'kn-abc-frontend',
            canonicalUrl: 'https://www.kariyer.net/is-ilani/abc-frontend',
            title: 'Frontend Developer',
            companyName: 'ABC Technology',
          },
          {
            externalJobId: '4526749',
            canonicalUrl:
              'https://www.kariyer.net/is-ilani/camlica-front-end-gelistirici-4526749',
            title: 'Front-End Geliştirici',
            companyName: 'Camlica',
          },
        ],
      }),
    };

    const result = await adapter(provider).search(emptyQuery);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.sourceJobId).toBe('4526749');
  });

  it('throws SourceConfigurationError in live mode without a provider', async () => {
    await expect(
      adapter(createKariyerNetProvider('live')).search(emptyQuery),
    ).rejects.toBeInstanceOf(SourceConfigurationError);
  });
});
