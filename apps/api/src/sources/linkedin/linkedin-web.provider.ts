import { Injectable, Logger } from '@nestjs/common';

import {
  isSourceError,
  SourceAuthenticationError,
  SourceParseError,
  SourceRateLimitError,
  SourceUnavailableError,
} from '../source-errors.js';
import {
  logLinkedInDev,
  logLinkedInDiscoveryStart,
  previewLinkedInJobs,
} from './linkedin-dev-log.js';
import {
  createLinkedInFetchClient,
  isTimeoutError,
  type LinkedInHttpClient,
  type LinkedInHttpResponse,
} from './linkedin-http.client.js';
import {
  looksLikeLinkedInLoginUrl,
  parseLinkedInSearchHtml,
} from './linkedin-html.parser.js';
import { isLinkedInPaginationLoop, shouldStopLinkedInPagination } from './linkedin-pagination.js';
import type { LinkedInProvider } from './linkedin.provider.js';
import { buildLinkedInSearchUrl } from './linkedin-search-url.js';
import {
  LINKEDIN_CAPABILITIES,
  type LinkedInPaginationStopReason,
  type LinkedInProviderResult,
  type LinkedInRawJob,
  type LinkedInSearchInput,
} from './linkedin.types.js';
import {
  readLinkedInWebConfig,
  type LinkedInWebConfig,
} from './linkedin-web.config.js';

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
export class LinkedInWebProvider implements LinkedInProvider {
  readonly mode = 'live' as const;
  readonly capabilities = LINKEDIN_CAPABILITIES;
  private readonly logger = new Logger(LinkedInWebProvider.name);

  constructor(
    private readonly config: LinkedInWebConfig,
    private readonly http: LinkedInHttpClient = createLinkedInFetchClient(),
    private readonly clock: Clock = defaultClock,
  ) {}

  static fromEnv(env: { get(key: string): string | undefined }): LinkedInWebProvider {
    return new LinkedInWebProvider(readLinkedInWebConfig(env));
  }

  isEnabled(): boolean {
    return true;
  }

  async search(input: LinkedInSearchInput): Promise<LinkedInProviderResult> {
    const jobsById = new Map<string, LinkedInRawJob>();
    const maxPages = this.config.maxPages;
    let pagesFetched = 0;
    let stopReason: LinkedInPaginationStopReason | null = null;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = buildLinkedInSearchUrl(
        input,
        this.config.baseUrl,
        page,
        this.config.pageSize,
      );
      if (page === 1) {
        logLinkedInDiscoveryStart({
          mode: this.mode,
          requestUrl: url,
          savedSearchId: input.savedSearchId ?? null,
          keywords: input.keywords,
          locations: input.locations,
        });
      }

      await this.clock.sleep(this.config.delayMs);

      let pageJobs: readonly LinkedInRawJob[];
      let paginationLoop = false;
      try {
        const fetched = await this.fetchSearchPage(url, page);
        if (fetched.kind === 'blocked') {
          if (pagesFetched > 0) {
            stopReason = 'blocked_after_success';
            this.logger.warn({
              message: 'LinkedIn blocked a later page; keeping earlier results',
              source: 'linkedin',
              page,
              pagesFetched,
              accumulated: jobsById.size,
              stopReason,
              errorCategory: 'authentication',
            });
            break;
          }

          throw new SourceAuthenticationError(
            'linkedin',
            'LinkedIn presented a login wall or bot check. JobRadar does not bypass it.',
          );
        }

        pageJobs = fetched.jobs;
        paginationLoop = fetched.kind === 'pagination_loop';
      } catch (error) {
        if (pagesFetched > 0) {
          stopReason = 'blocked_after_success';
          this.logger.warn({
            message: 'LinkedIn failed a later page; keeping earlier results',
            source: 'linkedin',
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

      if (paginationLoop) {
        stopReason = 'pagination_loop';
        this.logger.warn({
          message: 'LinkedIn pagination looped back to start=0; keeping earlier results',
          source: 'linkedin',
          page,
          pagesFetched,
          accumulated: jobsById.size,
          stopReason,
        });
        break;
      }

      pagesFetched += 1;
      const sizeBefore = jobsById.size;

      for (const job of pageJobs) {
        const identity = linkedInJobIdentity(job);
        if (identity && !jobsById.has(identity)) {
          jobsById.set(identity, job);
        }
      }

      const newJobCount = jobsById.size - sizeBefore;

      if (pagesFetched > 1 && newJobCount === 0) {
        stopReason = 'no_new_jobs';
        this.logger.log({
          message: 'LinkedIn page added no new job ids; stopping pagination',
          source: 'linkedin',
          page,
          pagesFetched,
          accumulated: jobsById.size,
          stopReason,
        });
      } else {
        stopReason = shouldStopLinkedInPagination({
          page,
          maxPages,
          jobsOnPage: pageJobs,
          maxAgeDays: input.maxAgeDays,
        });
      }

      this.logger.log({
        message: 'LinkedIn search page fetched',
        source: 'linkedin',
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
    logLinkedInDev({
      message: 'LinkedIn live parse result',
      providerMode: this.mode,
      parsedJobCount: jobs.length,
      pagesFetched,
      jobsCollected: jobs.length,
      stopReason,
      sampleJobs: previewLinkedInJobs(jobs),
    });

    return {
      jobs,
      pagesFetched,
      jobsCollected: jobs.length,
      stopReason,
    };
  }

  private async fetchSearchPage(
    url: string,
    page: number,
  ): Promise<
    | { kind: 'jobs'; jobs: readonly LinkedInRawJob[] }
    | { kind: 'pagination_loop'; jobs: readonly LinkedInRawJob[] }
    | { kind: 'blocked' }
  > {
    const response = await this.getWithRetry(url);
    logLinkedInDev({
      message: 'LinkedIn live HTTP response',
      providerMode: this.mode,
      requestUrl: url,
      httpStatus: response.status,
      finalUrl: response.finalUrl ?? url,
      contentType: response.contentType,
      responseLength: response.body.length,
      page,
    });

    if (
      isBlockedHttpStatus(response.status) ||
      looksLikeLinkedInLoginUrl(response.finalUrl)
    ) {
      this.logger.warn({
        message: 'LinkedIn served a challenge or login wall',
        source: 'linkedin',
        errorCategory: 'authentication',
        page,
        httpStatus: response.status,
      });
      return { kind: 'blocked' };
    }

    throwIfFailedStatus(response.status);

    const parsed = parseLinkedInSearchHtml(response.body, this.config.baseUrl);
    if (parsed.kind === 'blocked') {
      logLinkedInDev({
        message: 'LinkedIn live parse result',
        providerMode: this.mode,
        parsedJobCount: 0,
        parseKind: parsed.kind,
        sampleJobs: [],
        page,
      });
      this.logger.warn({
        message: 'LinkedIn served a challenge or login wall',
        source: 'linkedin',
        errorCategory: 'authentication',
        page,
      });
      return { kind: 'blocked' };
    }

    if (parsed.kind === 'mismatch') {
      if (page > 1) {
        this.logger.warn({
          message: 'LinkedIn HTML parser mismatch on later page; stopping pagination',
          source: 'linkedin',
          errorCategory: 'parse',
          page,
        });
        return { kind: 'jobs', jobs: [] };
      }

      logLinkedInDev({
        message: 'LinkedIn live parse result',
        providerMode: this.mode,
        parsedJobCount: 0,
        parseKind: parsed.kind,
        sampleJobs: [],
        page,
      });
      this.logger.warn({
        message: 'LinkedIn HTML parser mismatch',
        source: 'linkedin',
        errorCategory: 'parse',
      });
      throw new SourceParseError('linkedin', parsed.reason);
    }

    if (isLinkedInPaginationLoop(url, response.finalUrl)) {
      this.logger.warn({
        message: 'LinkedIn redirected a later page back to start=0',
        source: 'linkedin',
        page,
        requestUrl: url,
        finalUrl: response.finalUrl ?? url,
        stopReason: 'pagination_loop',
      });
      return { kind: 'pagination_loop', jobs: [] };
    }

    return { kind: 'jobs', jobs: parsed.jobs };
  }

  private async getWithRetry(url: string): Promise<LinkedInHttpResponse> {
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
            'linkedin',
            `LinkedIn returned HTTP ${response.status}.`,
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
      throw new SourceUnavailableError('linkedin', 'LinkedIn request timed out.');
    }

    throw new SourceUnavailableError(
      'linkedin',
      lastError instanceof Error ? lastError.message : 'LinkedIn request failed.',
    );
  }
}

function isBlockedHttpStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 999;
}

function throwIfFailedStatus(status: number): void {
  if (status === 429) {
    throw new SourceRateLimitError('linkedin', 'LinkedIn rate-limited the request.');
  }

  if (status >= 500) {
    throw new SourceUnavailableError(
      'linkedin',
      `LinkedIn returned HTTP ${status}.`,
    );
  }

  if (status >= 400) {
    throw new SourceUnavailableError(
      'linkedin',
      `LinkedIn returned HTTP ${status}.`,
    );
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

function linkedInJobIdentity(job: LinkedInRawJob): string | null {
  if (typeof job.externalJobId === 'number' && Number.isFinite(job.externalJobId)) {
    return String(job.externalJobId);
  }

  if (typeof job.externalJobId === 'string' && job.externalJobId.trim().length > 0) {
    return job.externalJobId.trim();
  }

  return null;
}
