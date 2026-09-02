import { Injectable } from '@nestjs/common';

import { logLinkedInDiscoveryStart } from './linkedin-dev-log.js';
import type { LinkedInProvider } from './linkedin.provider.js';
import type {
  LinkedInProviderResult,
  LinkedInSearchInput,
} from './linkedin.types.js';
import { LINKEDIN_CAPABILITIES } from './linkedin.types.js';

/**
 * Default LinkedIn mode. Zero jobs, does not fail discovery.
 */
@Injectable()
export class LinkedInDisabledProvider implements LinkedInProvider {
  readonly mode = 'disabled' as const;
  readonly capabilities = LINKEDIN_CAPABILITIES;

  isEnabled(): boolean {
    return false;
  }

  async search(input: LinkedInSearchInput): Promise<LinkedInProviderResult> {
    logLinkedInDiscoveryStart({
      mode: this.mode,
      requestUrl: null,
      savedSearchId: input.savedSearchId ?? null,
      keywords: input.keywords,
      locations: input.locations,
    });

    return {
      jobs: [],
      pagesFetched: 0,
      jobsCollected: 0,
      stopReason: null,
    };
  }
}
