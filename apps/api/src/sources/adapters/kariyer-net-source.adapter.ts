import { Inject, Injectable, Logger } from '@nestjs/common';

import type { SourceId } from '../../common/domain.types.js';
import type {
  JobSourceAdapter,
  SourceAdapterCapabilities,
  SourceJobRaw,
  SourceSearchQuery,
  SourceSearchResult,
} from '../job-source.adapter.js';
import { describeKariyerNetRawJob, logKariyerNetDev } from '../kariyer-net/kariyer-net-dev-log.js';
import {
  kariyerNetNormalizeRejectionReasons,
  normalizeKariyerNetJob,
} from '../kariyer-net/kariyer-net.normalizer.js';
import type { KariyerNetNormalizedJob } from '../kariyer-net/kariyer-net.normalizer.js';
import type { KariyerNetProvider } from '../kariyer-net/kariyer-net.provider.js';
import { mapKariyerNetSearch } from '../kariyer-net/kariyer-net-search.mapper.js';
import { isKariyerNetFixtureIdentity } from '../kariyer-net/fixtures/kariyer-net-jobs.fixture.js';
import { KARIYER_NET_PROVIDER } from '../kariyer-net/kariyer-net.tokens.js';
import type { KariyerNetProviderResult, KariyerNetRawJob } from '../kariyer-net/kariyer-net.types.js';
import { SourceParseError } from '../source-errors.js';

@Injectable()
export class KariyerNetSourceAdapter implements JobSourceAdapter {
  readonly sourceId: SourceId = 'kariyer_net';
  readonly displayName = 'Kariyer.net';
  private readonly logger = new Logger(KariyerNetSourceAdapter.name);

  constructor(
    @Inject(KARIYER_NET_PROVIDER)
    private readonly provider: KariyerNetProvider,
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
    const startedAt = Date.now();
    const input = {
      ...mapKariyerNetSearch(query, this.provider.capabilities),
      savedSearchId: query.savedSearchId,
    };
    const rawResult = await this.provider.search(input);
    const rawJobs = readProviderJobs(rawResult);
    const jobs: SourceJobRaw[] = [];
    const firstRaw = rawJobs[0];
    if (isRawJobRecord(firstRaw)) {
      logKariyerNetDev({
        message: 'Kariyer.net first raw job sample',
        sample: describeKariyerNetRawJob(firstRaw),
      });
    }

    for (const raw of rawJobs) {
      if (!isRawJobRecord(raw)) {
        this.logger.warn({
          message: 'Dropped malformed Kariyer.net job',
          source: this.sourceId,
          errorCategory: 'parse',
          reasons: ['raw job is not an object'],
        });
        continue;
      }

      const normalized = normalizeKariyerNetJob(raw);
      if (!normalized) {
        const reasons = kariyerNetNormalizeRejectionReasons(raw);
        this.logger.warn({
          message: 'Dropped malformed Kariyer.net job',
          source: this.sourceId,
          errorCategory: 'parse',
          reasons,
        });
        logKariyerNetDev({
          message: 'Kariyer.net normalization rejected a job',
          reasons,
          sample: describeKariyerNetRawJob(raw),
        });
        continue;
      }

      const sourceJob = toSourceJobRaw(
        normalized,
        typeof raw.listPage === 'number' ? raw.listPage : undefined,
      );
      if (
        this.provider.mode === 'live' &&
        isKariyerNetFixtureIdentity({
          sourceJobId: sourceJob.sourceJobId,
          canonicalUrl: sourceJob.canonicalUrl,
        })
      ) {
        this.logger.warn({
          message: 'Dropped Kariyer.net mock fixture in live mode',
          source: this.sourceId,
          sourceJobId: sourceJob.sourceJobId,
        });
        continue;
      }

      jobs.push(sourceJob);
    }

    this.logger.log({
      message: 'Kariyer.net search completed',
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
      detailsFetched: rawResult.detailsFetched,
      detailsFailed: rawResult.detailsFailed,
      stopReason: rawResult.stopReason ?? null,
      providerMode: this.provider.mode,
    };
  }

  async enrichMissingDescriptions(
    jobs: readonly SourceJobRaw[],
  ): Promise<{
    jobs: SourceJobRaw[];
    detailsFetched: number;
    detailsFailed: number;
  }> {
    if (!this.provider.enrichMissingDescriptions) {
      return { jobs: [...jobs], detailsFetched: 0, detailsFailed: 0 };
    }

    const missing = jobs.filter((job) => !job.description?.trim());
    if (missing.length === 0) {
      return { jobs: [...jobs], detailsFetched: 0, detailsFailed: 0 };
    }

    const rawJobs: KariyerNetRawJob[] = missing.map((job) => ({
      externalJobId: job.sourceJobId,
      canonicalUrl: job.canonicalUrl,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      workModel: job.workModel,
      description: job.description,
      publishedAt: job.publishedAt,
      experienceLevel: job.experienceLevel,
      technologies: job.technologies,
    }));
    const enriched = await this.provider.enrichMissingDescriptions(rawJobs);
    const byId = new Map(
      enriched.jobs.map((job) => [
        typeof job.externalJobId === 'string' ? job.externalJobId : '',
        job,
      ]),
    );
    const merged = jobs.map((job) => {
      const detail = byId.get(job.sourceJobId);
      if (!detail) {
        return job;
      }

      const description =
        typeof detail.description === 'string' && detail.description.trim()
          ? detail.description.trim()
          : job.description;
      return description && description !== job.description
        ? { ...job, description }
        : job;
    });

    return {
      jobs: merged,
      detailsFetched: enriched.detailsFetched,
      detailsFailed: enriched.detailsFailed,
    };
  }
}

function isRawJobRecord(value: unknown): value is KariyerNetRawJob {
  return typeof value === 'object' && value !== null;
}

function readProviderJobs(result: KariyerNetProviderResult): readonly unknown[] {
  if (!result || !Array.isArray(result.jobs)) {
    throw new SourceParseError(
      'kariyer_net',
      'Kariyer.net provider returned a malformed result envelope.',
    );
  }

  return result.jobs;
}

function toSourceJobRaw(
  job: KariyerNetNormalizedJob,
  listPage?: number,
): SourceJobRaw {
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
    listPage,
    rawMetadata:
      job.employmentType === null
        ? undefined
        : { employmentType: job.employmentType },
  };
}
