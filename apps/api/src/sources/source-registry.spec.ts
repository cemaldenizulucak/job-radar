import { KariyerNetSourceAdapter } from './adapters/kariyer-net-source.adapter.js';
import { LinkedInSourceAdapter } from './adapters/linkedin-source.adapter.js';
import type { JobSourceAdapter, SourceSearchQuery } from './job-source.adapter.js';
import { MOCK_SOURCE_CAPABILITIES } from './job-source.adapter.js';
import { KariyerNetMockProvider } from './kariyer-net/kariyer-net-mock.provider.js';
import { LinkedInMockProvider } from './linkedin/linkedin-mock.provider.js';
import { SourceRegistry } from './source-registry.js';

const emptyQuery: SourceSearchQuery = {
  keywords: [],
  technologies: [],
  locations: [],
  workModels: [],
  experienceLevels: [],
};

describe('mock source adapters', () => {
  it('returns three hardcoded LinkedIn listings without network access', async () => {
    const adapter = new LinkedInSourceAdapter(new LinkedInMockProvider());
    const result = await adapter.search(emptyQuery);

    expect(adapter.isEnabled()).toBe(true);
    expect(adapter.capabilities.supportsKeywordSearch).toBe(true);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      'li-abc-frontend',
      'li-nova-react',
      'li-delta-angular',
    ]);
  });

  it('returns three hardcoded Kariyer.net listings without network access', async () => {
    const adapter = new KariyerNetSourceAdapter(new KariyerNetMockProvider());
    const result = await adapter.search(emptyQuery);

    expect(adapter.isEnabled()).toBe(true);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      'kn-abc-frontend',
      'kn-pixel-react',
      'kn-orbit-angular',
    ]);
  });

  it('includes the same logical ABC Technology role on both sources', async () => {
    const linkedIn = await new LinkedInSourceAdapter(
      new LinkedInMockProvider(),
    ).search(emptyQuery);
    const kariyer = await new KariyerNetSourceAdapter(
      new KariyerNetMockProvider(),
    ).search(emptyQuery);
    const linkedInAbc = linkedIn.jobs.find(
      (job) => job.sourceJobId === 'li-abc-frontend',
    );
    const kariyerAbc = kariyer.jobs.find(
      (job) => job.sourceJobId === 'kn-abc-frontend',
    );

    expect(linkedInAbc?.title).toBe('Frontend Developer');
    expect(kariyerAbc?.title).toBe('Frontend Developer');
    expect(linkedInAbc?.companyName).toBe('ABC Technology');
    expect(kariyerAbc?.companyName).toBe('ABC Technology');
    expect(linkedInAbc?.sourceJobId).not.toBe(kariyerAbc?.sourceJobId);
  });
});

describe('SourceRegistry', () => {
  it('lists enabled adapters independently of source-specific classes', () => {
    const disabled: JobSourceAdapter = {
      sourceId: 'linkedin',
      displayName: 'LinkedIn',
      capabilities: MOCK_SOURCE_CAPABILITIES,
      isEnabled: () => false,
      search: async () => ({ sourceId: 'linkedin', jobs: [] }),
    };
    const enabled: JobSourceAdapter = {
      sourceId: 'kariyer_net',
      displayName: 'Fake',
      capabilities: MOCK_SOURCE_CAPABILITIES,
      isEnabled: () => true,
      search: async () => ({ sourceId: 'kariyer_net', jobs: [] }),
    };

    const registry = new SourceRegistry([disabled, enabled]);

    expect(registry.listEnabled().map((adapter) => adapter.sourceId)).toEqual([
      'kariyer_net',
    ]);
  });
});
