import { Injectable } from '@nestjs/common';

import { KARIYER_NET_FIXTURE_JOBS } from './fixtures/kariyer-net-jobs.fixture.js';
import { logKariyerNetDiscoveryStart } from './kariyer-net-dev-log.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import type {
  KariyerNetProviderResult,
  KariyerNetSearchInput,
} from './kariyer-net.types.js';
import { KARIYER_NET_CAPABILITIES } from './kariyer-net.types.js';

/**
 * Development-only Kariyer.net provider. Serves in-repo fixtures. No network.
 */
@Injectable()
export class KariyerNetMockProvider implements KariyerNetProvider {
  readonly mode = 'mock' as const;
  readonly capabilities = KARIYER_NET_CAPABILITIES;

  isEnabled(): boolean {
    return true;
  }

  async search(input: KariyerNetSearchInput): Promise<KariyerNetProviderResult> {
    logKariyerNetDiscoveryStart({
      mode: this.mode,
      requestUrl: null,
      savedSearchId: input.savedSearchId ?? null,
      keywords: input.keywords,
      locations: input.locations,
    });

    return {
      jobs: KARIYER_NET_FIXTURE_JOBS,
      pagesFetched: 1,
      jobsCollected: KARIYER_NET_FIXTURE_JOBS.length,
      stopReason: null,
    };
  }
}
