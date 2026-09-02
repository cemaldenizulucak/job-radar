import { Injectable } from '@nestjs/common';

import { LINKEDIN_FIXTURE_JOBS } from '../adapters/linkedin-jobs.fixture.js';
import { logLinkedInDiscoveryStart } from './linkedin-dev-log.js';
import type { LinkedInProvider } from './linkedin.provider.js';
import type {
  LinkedInProviderResult,
  LinkedInRawJob,
  LinkedInSearchInput,
} from './linkedin.types.js';
import { LINKEDIN_CAPABILITIES } from './linkedin.types.js';

/**
 * Development-only LinkedIn provider. Serves in-repo fixtures. No network.
 */
@Injectable()
export class LinkedInMockProvider implements LinkedInProvider {
  readonly mode = 'mock' as const;
  readonly capabilities = LINKEDIN_CAPABILITIES;

  isEnabled(): boolean {
    return true;
  }

  async search(input: LinkedInSearchInput): Promise<LinkedInProviderResult> {
    logLinkedInDiscoveryStart({
      mode: this.mode,
      requestUrl: null,
      savedSearchId: input.savedSearchId ?? null,
      keywords: input.keywords,
      locations: input.locations,
    });

    const jobs: LinkedInRawJob[] = LINKEDIN_FIXTURE_JOBS.map((job) => ({
      externalJobId: job.sourceJobId,
      canonicalUrl: job.canonicalUrl,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      workModel: job.workModel,
      description: job.description,
      experienceLevel: job.experienceLevel,
    }));

    return {
      jobs,
      pagesFetched: 1,
      jobsCollected: jobs.length,
      stopReason: null,
    };
  }
}
