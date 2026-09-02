import { Injectable } from '@nestjs/common';

import { SourceConfigurationError } from '../source-errors.js';
import { logKariyerNetDiscoveryStart } from './kariyer-net-dev-log.js';
import { buildKariyerNetSearchUrl } from './kariyer-net-search-url.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import type {
  KariyerNetProviderResult,
  KariyerNetSearchInput,
} from './kariyer-net.types.js';
import { KARIYER_NET_CAPABILITIES } from './kariyer-net.types.js';

const LIVE_NOT_CONFIGURED_MESSAGE =
  'Kariyer.net live provider is not configured. An approved access method is required; HTML scraping and unofficial APIs are not implemented.';

/**
 * Fail-closed live stand-in. Never returns mock fixtures.
 */
@Injectable()
export class KariyerNetUnconfiguredLiveProvider implements KariyerNetProvider {
  readonly mode = 'live' as const;
  readonly capabilities = KARIYER_NET_CAPABILITIES;

  isEnabled(): boolean {
    return true;
  }

  async search(input: KariyerNetSearchInput): Promise<KariyerNetProviderResult> {
    logKariyerNetDiscoveryStart({
      mode: this.mode,
      requestUrl: buildKariyerNetSearchUrl(input),
      savedSearchId: input.savedSearchId ?? null,
      keywords: input.keywords,
      locations: input.locations,
    });

    throw new SourceConfigurationError('kariyer_net', LIVE_NOT_CONFIGURED_MESSAGE);
  }
}
