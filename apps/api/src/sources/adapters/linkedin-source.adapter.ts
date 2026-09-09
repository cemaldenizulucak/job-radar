import { Inject, Injectable, Logger } from '@nestjs/common';

import type { SourceId } from '../../common/domain.types.js';
import type {
  JobSourceAdapter,
  SourceAdapterCapabilities,
  SourceJobRaw,
  SourceSearchQuery,
  SourceSearchResult,
} from '../job-source.adapter.js';
import { isLinkedInFixtureIdentity } from './linkedin-jobs.fixture.js';
import { describeLinkedInRawJob, logLinkedInDev } from '../linkedin/linkedin-dev-log.js';
import { createLinkedInProviderFromConfig } from '../linkedin/linkedin-provider.factory.js';
import type { LinkedInProvider } from '../linkedin/linkedin.provider.js';
import { mapLinkedInSearch } from '../linkedin/linkedin-search.mapper.js';
import { LINKEDIN_PROVIDER } from '../linkedin/linkedin.tokens.js';
import type { LinkedInProviderResult, LinkedInRawJob } from '../linkedin/linkedin.types.js';
import {
  linkedInNormalizeRejectionReasons,
  normalizeLinkedInJob,
  type LinkedInNormalizedJob,
} from '../linkedin/linkedin.normalizer.js';
import { SourceParseError } from '../source-errors.js';

export {
  createLinkedInProviderFromConfig,
  resolveLinkedInProviderMode,
} from '../linkedin/linkedin-provider.factory.js';

export function createLinkedInSourceAdapter(env: {
  get(key: string): string | undefined;
}): LinkedInSourceAdapter {
  return new LinkedInSourceAdapter(createLinkedInProviderFromConfig(env));
}

/**
 * LinkedIn source adapter. Fixtures are inserted only when
 * LINKEDIN_PROVIDER=mock. Disabled mode contributes zero jobs and does not
 * abort discovery. Live reads public job-search HTML and fails closed.
 */
@Injectable()
export class LinkedInSourceAdapter implements JobSourceAdapter {
  readonly sourceId: SourceId = 'linkedin';
  readonly displayName = 'LinkedIn';
  private readonly logger = new Logger(LinkedInSourceAdapter.name);

  constructor(
    @Inject(LINKEDIN_PROVIDER)
    private readonly provider: LinkedInProvider,
  ) {}

  get capabilities(): SourceAdapterCapabilities {
    return this.provider.capabilities;
  }

  get providerMode(): string {
    return this.provider.mode;
  }

  isEnabled(): boolean {
    return this.provider.isEnabled();
  }

  async search(query: SourceSearchQuery): Promise<SourceSearchResult> {
    if (!this.provider.isEnabled()) {
      return {
        sourceId: this.sourceId,
        jobs: [],
        pagesFetched: 0,
        jobsCollected: 0,
        stopReason: null,
      };
    }

    const startedAt = Date.now();
    const input = {
      ...mapLinkedInSearch(query, this.provider.capabilities),
      savedSearchId: query.savedSearchId,
    };
    const rawResult = await this.provider.search(input);
    const rawJobs = readProviderJobs(rawResult);
    const jobs: SourceJobRaw[] = [];
    const firstRaw = rawJobs[0];
    if (isRawJobRecord(firstRaw)) {
      logLinkedInDev({
        message: 'LinkedIn first raw job sample',
        sample: describeLinkedInRawJob(firstRaw),
      });
    }

    for (const raw of rawJobs) {
      if (!isRawJobRecord(raw)) {
        this.logger.warn({
          message: 'Dropped malformed LinkedIn job',
          source: this.sourceId,
          errorCategory: 'parse',
          reasons: ['raw job is not an object'],
        });
        continue;
      }

      const normalized = normalizeLinkedInJob(raw);
      if (!normalized) {
        const reasons = linkedInNormalizeRejectionReasons(raw);
        this.logger.warn({
          message: 'Dropped malformed LinkedIn job',
          source: this.sourceId,
          errorCategory: 'parse',
          reasons,
        });
        logLinkedInDev({
          message: 'LinkedIn normalization rejected a job',
          reasons,
          sample: describeLinkedInRawJob(raw),
        });
        continue;
      }

      const sourceJob = toSourceJobRaw(normalized);
      if (
        this.provider.mode === 'live' &&
        isLinkedInFixtureIdentity({
          sourceJobId: sourceJob.sourceJobId,
          canonicalUrl: sourceJob.canonicalUrl,
        })
      ) {
        this.logger.warn({
          message: 'Dropped LinkedIn mock fixture in live mode',
          source: this.sourceId,
          sourceJobId: sourceJob.sourceJobId,
        });
        continue;
      }

      jobs.push(sourceJob);
    }

    this.logger.log({
      message: 'LinkedIn search completed',
      source: this.sourceId,
      durationMs: Date.now() - startedAt,
      fetched: rawJobs.length,
      normalized: jobs.length,
      pagesFetched: rawResult.pagesFetched ?? null,
      jobsCollected: rawResult.jobsCollected ?? jobs.length,
      stopReason: rawResult.stopReason ?? null,
    });

    return {
      sourceId: this.sourceId,
      jobs,
      pagesFetched: rawResult.pagesFetched,
      jobsCollected: rawResult.jobsCollected ?? jobs.length,
      stopReason: rawResult.stopReason ?? null,
      providerMode: this.provider.mode,
    };
  }
}

function isRawJobRecord(value: unknown): value is LinkedInRawJob {
  return typeof value === 'object' && value !== null;
}

function readProviderJobs(result: LinkedInProviderResult): readonly unknown[] {
  if (!result || !Array.isArray(result.jobs)) {
    throw new SourceParseError(
      'linkedin',
      'LinkedIn provider returned a malformed result envelope.',
    );
  }

  return result.jobs;
}

function toSourceJobRaw(job: LinkedInNormalizedJob): SourceJobRaw {
  return {
    sourceJobId: job.sourceJobId,
    canonicalUrl: job.canonicalUrl,
    title: job.title,
    companyName: job.companyName,
    location: job.location ?? undefined,
    workModel: job.workModel ?? undefined,
    description: job.description ?? undefined,
    publishedAt: job.publishedAt ?? undefined,
    experienceLevel: job.experienceLevel ?? undefined,
    technologies: job.technologies,
  };
}
