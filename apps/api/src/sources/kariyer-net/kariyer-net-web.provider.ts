import { Injectable, Logger } from '@nestjs/common';

import {
  isAllowedJobSourceUrl,
  redirectKeepsJobSourceHost,
} from '../../common/job-source-url.js';
import { isUsableJobDescription } from '../../jobs/listing-description.js';
import type { SourceDetailFetchOutcome } from '../detail-fetch.types.js';
import {
  isSourceError,
  SourceAuthenticationError,
  SourceParseError,
  SourceRateLimitError,
  SourceUnavailableError,
} from '../source-errors.js';
import {
  createKariyerNetFetchClient,
  isTimeoutError,
  type KariyerNetHttpClient,
  type KariyerNetHttpResponse,
} from './kariyer-net-http.client.js';
import {
  logKariyerNetDev,
  logKariyerNetDiscoveryStart,
  previewKariyerNetJobs,
} from './kariyer-net-dev-log.js';
import {
  isKariyerNetDebugHtmlEnabled,
  writeKariyerNetDebugHtml,
} from './kariyer-net-debug-html.js';
import { parseKariyerNetSearchHtml } from './kariyer-net-html.parser.js';
import { classifyKariyerNetDetailResponse } from './kariyer-net-detail-result.js';
import {
  kariyerNetPageSignature,
  shouldStopKariyerNetPagination,
} from './kariyer-net-pagination.js';
import type { KariyerNetProvider } from './kariyer-net.provider.js';
import { buildKariyerNetSearchUrl } from './kariyer-net-search-url.js';
import {
  KARIYER_NET_CAPABILITIES,
  type KariyerNetPaginationStopReason,
  type KariyerNetProviderResult,
  type KariyerNetRawJob,
  type KariyerNetSearchInput,
} from './kariyer-net.types.js';
import {
  readKariyerNetWebConfig,
  type KariyerNetWebConfig,
} from './kariyer-net-web.config.js';

type Clock = {
  sleep(ms: number): Promise<void>;
};

const defaultClock: Clock = {
  sleep(ms) {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
};

@Injectable()
export class KariyerNetWebProvider implements KariyerNetProvider {
  readonly mode = 'live' as const;
  readonly capabilities = KARIYER_NET_CAPABILITIES;
  private readonly logger = new Logger(KariyerNetWebProvider.name);

  constructor(
    private readonly config: KariyerNetWebConfig,
    private readonly http: KariyerNetHttpClient = createKariyerNetFetchClient(),
    private readonly clock: Clock = defaultClock,
  ) {}

  static fromEnv(env: { get(key: string): string | undefined }): KariyerNetWebProvider {
    return new KariyerNetWebProvider(readKariyerNetWebConfig(env));
  }

  isEnabled(): boolean {
    return true;
  }

  async search(input: KariyerNetSearchInput): Promise<KariyerNetProviderResult> {
    const jobsById = new Map<string, KariyerNetRawJob>();
    const maxPages = this.config.maxPages;
    let pagesFetched = 0;
    let stopReason: KariyerNetPaginationStopReason | null = null;
    let previousPageSignature: string | null = null;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = buildKariyerNetSearchUrl(input, this.config.baseUrl, page);
      if (page === 1) {
        logKariyerNetDiscoveryStart({
          mode: this.mode,
          requestUrl: url,
          savedSearchId: input.savedSearchId ?? null,
          keywords: input.keywords,
          locations: input.locations,
        });
      }

      await this.clock.sleep(this.config.delayMs);

      let pageJobs: readonly KariyerNetRawJob[];
      try {
        const fetched = await this.fetchSearchPage(url, page);
        if (fetched.kind === 'blocked') {
          if (pagesFetched > 0) {
            stopReason = 'blocked_after_success';
            this.logger.warn({
              message: 'Kariyer.net blocked a later page; keeping earlier results',
              source: 'kariyer_net',
              page,
              pagesFetched,
              accumulated: jobsById.size,
              stopReason,
              errorCategory: 'challenge',
            });
            break;
          }

          throw new SourceAuthenticationError(
            'kariyer_net',
            'Kariyer.net presented a bot check or login wall. JobRadar does not bypass it.',
          );
        }

        pageJobs = fetched.jobs;
      } catch (error) {
        if (pagesFetched > 0) {
          stopReason = 'blocked_after_success';
          this.logger.warn({
            message: 'Kariyer.net failed a later page; keeping earlier results',
            source: 'kariyer_net',
            page,
            pagesFetched,
            accumulated: jobsById.size,
            stopReason,
            errorCategory: isSourceError(error) ? error.category : 'unknown',
          });
          break;
        }

        throw error;
      }

      pagesFetched += 1;

      for (const job of pageJobs) {
        const identity = kariyerJobIdentity(job);
        if (identity && !jobsById.has(identity)) {
          jobsById.set(identity, {
            ...job,
            listPage: page,
          });
        }
      }

      stopReason = shouldStopKariyerNetPagination({
        page,
        maxPages,
        jobsOnPage: pageJobs,
        previousPageSignature,
      });
      previousPageSignature = kariyerNetPageSignature(pageJobs);

      this.logger.log({
        message: 'Kariyer.net search page fetched',
        source: 'kariyer_net',
        page,
        jobsOnPage: pageJobs.length,
        accumulated: jobsById.size,
        stopReason,
      });

      if (stopReason) {
        break;
      }
    }

    const jobs = [...jobsById.values()];
    logKariyerNetDev({
      message: 'Kariyer.net live parse result',
      providerMode: this.mode,
      parsedJobCount: jobs.length,
      pagesFetched,
      jobsCollected: jobs.length,
      stopReason,
      sampleJobs: previewKariyerNetJobs(jobs),
    });

    return {
      jobs,
      pagesFetched,
      jobsCollected: jobs.length,
      stopReason,
    };
  }

  async enrichMissingDescriptions(
    jobs: readonly KariyerNetRawJob[],
  ): Promise<{
    jobs: readonly KariyerNetRawJob[];
    detailsFetched: number;
    detailsFailed: number;
    detailsRequested: number;
    descriptionsExtracted: number;
    outcomes: SourceDetailFetchOutcome[];
  }> {
    const enriched: KariyerNetRawJob[] = jobs.map((job) => ({ ...job }));
    const outcomes: SourceDetailFetchOutcome[] = [];

    for (const job of enriched) {
      if (hasText(job.description)) {
        continue;
      }

      if (outcomes.length >= this.config.maxDetailRequests) {
        break;
      }

      const sourceJobId = kariyerJobIdentity(job) ?? '';
      const url =
        typeof job.canonicalUrl === 'string' ? job.canonicalUrl.trim() : '';
      if (!url || !isAllowedJobSourceUrl(url)) {
        outcomes.push({
          sourceJobId,
          requestSucceeded: false,
          detailFetched: false,
          descriptionExtracted: false,
          errorCategory: 'invalid_url',
          httpStatus: null,
        });
        continue;
      }

      await this.clock.sleep(this.config.delayMs);

      try {
        const response = await this.getWithRetry(url);
        if (!redirectKeepsJobSourceHost(url, response.finalUrl)) {
          outcomes.push({
            sourceJobId,
            requestSucceeded: false,
            detailFetched: false,
            descriptionExtracted: false,
            errorCategory: 'redirect',
            httpStatus: response.status,
          });
          continue;
        }

        const classified = classifyKariyerNetDetailResponse({
          httpStatus: response.status,
          html: response.body,
          canonicalUrl: url,
          baseUrl: this.config.baseUrl,
        });
        if (!classified.detailFetched) {
          this.logger.warn({
            message: 'Kariyer.net listing detail was not usable',
            source: 'kariyer_net',
            errorCategory: classified.errorCategory,
            httpStatus: classified.httpStatus,
            requestSucceeded: classified.requestSucceeded,
            detailFetched: classified.detailFetched,
            descriptionExtracted: classified.descriptionExtracted,
          });
        }
        if (classified.description && isUsableJobDescription(classified.description)) {
          job.description = classified.description;
        }
        if (!hasText(job.publishedAt) && classified.publishedAt) {
          job.publishedAt = classified.publishedAt;
        }
        outcomes.push({
          sourceJobId,
          requestSucceeded: classified.requestSucceeded,
          detailFetched: classified.detailFetched,
          descriptionExtracted: classified.descriptionExtracted,
          errorCategory: classified.errorCategory,
          httpStatus: classified.httpStatus,
        });
      } catch (error) {
        const category =
          error instanceof SourceRateLimitError
            ? 'rate_limit'
            : error instanceof SourceUnavailableError
              ? 'unavailable'
              : 'unavailable';
        outcomes.push({
          sourceJobId,
          requestSucceeded: false,
          detailFetched: false,
          descriptionExtracted: false,
          errorCategory: category,
          httpStatus: null,
        });
      }
    }

    const detailsFetched = outcomes.filter((item) => item.detailFetched).length;
    const descriptionsExtracted = outcomes.filter(
      (item) => item.descriptionExtracted,
    ).length;
    const detailsFailed = outcomes.filter((item) => !item.detailFetched).length;

    return {
      jobs: enriched,
      detailsFetched,
      detailsFailed,
      detailsRequested: outcomes.length,
      descriptionsExtracted,
      outcomes,
    };
  }

  private async fetchSearchPage(
    url: string,
    page: number,
  ): Promise<
    | { kind: 'jobs'; jobs: readonly KariyerNetRawJob[] }
    | { kind: 'blocked' }
  > {
    const response = await this.getWithRetry(url);
    logKariyerNetDev({
      message: 'Kariyer.net live HTTP response',
      providerMode: this.mode,
      httpStatus: response.status,
      finalUrl: response.finalUrl ?? url,
      contentType: response.contentType,
      responseLength: response.body.length,
      page,
    });

    if (isBlockedHttpStatus(response.status)) {
      this.logger.warn({
        message: 'Kariyer.net served a challenge or login wall',
        source: 'kariyer_net',
        errorCategory: 'challenge',
        page,
        httpStatus: response.status,
      });
      return { kind: 'blocked' };
    }

    throwIfFailedStatus(response.status);

    if (page === 1 && this.config.debugHtml && isKariyerNetDebugHtmlEnabled()) {
      try {
        await writeKariyerNetDebugHtml(response.body);
      } catch (error) {
        this.logger.warn({
          message: 'Failed to write Kariyer.net debug HTML snapshot',
          source: 'kariyer_net',
          errorCategory: 'parse',
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    const parsed = parseKariyerNetSearchHtml(response.body, this.config.baseUrl);
    if (parsed.kind === 'blocked') {
      logKariyerNetDev({
        message: 'Kariyer.net live parse result',
        providerMode: this.mode,
        parsedJobCount: 0,
        parseKind: parsed.kind,
        sampleJobs: [],
        page,
      });
      this.logger.warn({
        message: 'Kariyer.net served a challenge or login wall',
        source: 'kariyer_net',
        errorCategory: 'challenge',
        page,
      });
      return { kind: 'blocked' };
    }

    if (parsed.kind === 'mismatch') {
      if (page > 1) {
        this.logger.warn({
          message: 'Kariyer.net HTML parser mismatch on later page; stopping pagination',
          source: 'kariyer_net',
          errorCategory: 'parse',
          page,
        });
        return { kind: 'jobs', jobs: [] };
      }

      logKariyerNetDev({
        message: 'Kariyer.net live parse result',
        providerMode: this.mode,
        parsedJobCount: 0,
        parseKind: parsed.kind,
        sampleJobs: [],
        page,
      });
      this.logger.warn({
        message: 'Kariyer.net HTML parser mismatch',
        source: 'kariyer_net',
        errorCategory: 'parse',
      });
      throw new SourceParseError('kariyer_net', parsed.reason);
    }

    return { kind: 'jobs', jobs: parsed.jobs };
  }

  private async getWithRetry(url: string): Promise<KariyerNetHttpResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      if (attempt > 0) {
        await this.clock.sleep(this.config.delayMs);
      }

      try {
        const response = await this.http.get({
          url,
          timeoutMs: this.config.timeoutMs,
          userAgent: this.config.userAgent,
        });

        if (response.status >= 500 && attempt < this.config.maxRetries) {
          lastError = new SourceUnavailableError(
            'kariyer_net',
            `Kariyer.net returned HTTP ${response.status}.`,
          );
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (!isTimeoutError(error) && attempt >= this.config.maxRetries) {
          break;
        }

        if (!isTimeoutError(error) && !isRetryableNetworkError(error)) {
          break;
        }
      }
    }

    if (isTimeoutError(lastError)) {
      throw new SourceUnavailableError(
        'kariyer_net',
        'Kariyer.net request timed out.',
      );
    }

    throw new SourceUnavailableError(
      'kariyer_net',
      lastError instanceof Error
        ? lastError.message
        : 'Kariyer.net request failed.',
    );
  }
}

function isBlockedHttpStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function throwIfFailedStatus(status: number): void {
  if (status === 429) {
    throw new SourceRateLimitError(
      'kariyer_net',
      'Kariyer.net rate-limited the request.',
    );
  }

  if (status >= 500) {
    throw new SourceUnavailableError(
      'kariyer_net',
      `Kariyer.net returned HTTP ${status}.`,
    );
  }

  if (status >= 400) {
    throw new SourceUnavailableError(
      'kariyer_net',
      `Kariyer.net returned HTTP ${status}.`,
    );
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

function kariyerJobIdentity(job: KariyerNetRawJob): string | null {
  if (typeof job.externalJobId === 'string' && job.externalJobId.trim().length > 0) {
    return job.externalJobId.trim();
  }

  if (typeof job.canonicalUrl === 'string' && job.canonicalUrl.trim().length > 0) {
    return job.canonicalUrl.trim();
  }

  return null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
