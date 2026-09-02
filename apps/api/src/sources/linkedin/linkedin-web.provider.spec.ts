import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SourceAuthenticationError,
  SourceParseError,
  SourceUnavailableError,
} from '../source-errors.js';
import type { LinkedInHttpClient } from './linkedin-http.client.js';
import type { LinkedInWebConfig } from './linkedin-web.config.js';
import { LinkedInWebProvider } from './linkedin-web.provider.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'html');

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function config(): LinkedInWebConfig {
  return {
    baseUrl: 'https://www.linkedin.com',
    timeoutMs: 50,
    delayMs: 0,
    maxRetries: 1,
    maxPages: 2,
    pageSize: 25,
    userAgent: 'JobRadar-Test/1.0',
  };
}

function httpClient(impl: LinkedInHttpClient['get']): LinkedInHttpClient {
  return { get: impl };
}

const emptyInput = {
  keywords: ['frontend'],
  locations: ['Istanbul'],
  workTypes: [],
  experienceLevels: [],
  maxAgeDays: 30,
};

describe('LinkedInWebProvider', () => {
  it('parses a public search page through the injected HTTP client', async () => {
    const urls: string[] = [];
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async (request) => {
        urls.push(request.url);
        expect(request.userAgent).toBe('JobRadar-Test/1.0');
        return {
          status: 200,
          contentType: 'text/html',
          body: fixture('search-listing.html'),
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls[0]).toContain('https://www.linkedin.com/jobs/search/');
    expect(urls[0]).toContain('keywords=frontend');
    expect(urls[0]).toContain('f_TPR=r2592000');
    expect(urls[0]).toContain('sortBy=DD');
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '3789011111',
      '3789022222',
    ]);
  });

  it('throws SourceAuthenticationError when LinkedIn blocks the first page', async () => {
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async () => ({
        status: 403,
        contentType: 'text/html',
        body: 'forbidden',
      })),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceAuthenticationError,
    );
  });

  it('throws SourceAuthenticationError on a challenge page', async () => {
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: fixture('search-challenge.html'),
      })),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceAuthenticationError,
    );
  });

  it('throws SourceParseError on malformed HTML', async () => {
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: fixture('search-malformed.html'),
      })),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceParseError,
    );
  });

  it('throws SourceUnavailableError after a timeout retry', async () => {
    let attempts = 0;
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async () => {
        attempts += 1;
        const error = new Error('The operation was aborted');
        error.name = 'TimeoutError';
        throw error;
      }),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
    expect(attempts).toBe(2);
  });

  it('keeps page 1 jobs when page 2 is blocked', async () => {
    const urls: string[] = [];
    const provider = new LinkedInWebProvider(
      config(),
      httpClient(async (request) => {
        urls.push(request.url);
        if (request.url.includes('start=25')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: fixture('search-challenge.html'),
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: fixture('search-listing.html'),
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls).toHaveLength(2);
    expect(result.jobs).toHaveLength(2);
    expect(result.pagesFetched).toBe(1);
    expect(result.jobsCollected).toBe(2);
    expect(result.stopReason).toBe('blocked_after_success');
  });

  it('deduplicates the same LinkedIn job id across pages', async () => {
    const provider = new LinkedInWebProvider(
      { ...config(), maxPages: 2 },
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: fixture('search-listing.html'),
      })),
    );

    const result = await provider.search(emptyInput);

    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '3789011111',
      '3789022222',
    ]);
    expect(result.stopReason).toBe('no_new_jobs');
  });

  it('stops immediately when start=25 redirects to start=0', async () => {
    const urls: string[] = [];
    const provider = new LinkedInWebProvider(
      { ...config(), maxPages: 3 },
      httpClient(async (request) => {
        urls.push(request.url);
        const isLaterPage = request.url.includes('start=');
        return {
          status: 200,
          contentType: 'text/html',
          body: fixture('search-listing.html'),
          finalUrl: isLaterPage
            ? 'https://www.linkedin.com/jobs/search/?keywords=frontend&location=Istanbul&f_TPR=r2592000&sortBy=DD&start=0'
            : request.url,
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('start=25');
    expect(urls.some((url) => url.includes('start=50'))).toBe(false);
    expect(result.jobs).toHaveLength(2);
    expect(result.pagesFetched).toBe(1);
    expect(result.stopReason).toBe('pagination_loop');
  });

  it('stops when a later page has no new LinkedIn job ids', async () => {
    const urls: string[] = [];
    const provider = new LinkedInWebProvider(
      { ...config(), maxPages: 3 },
      httpClient(async (request) => {
        urls.push(request.url);
        return {
          status: 200,
          contentType: 'text/html',
          body: fixture('search-listing.html'),
          finalUrl: request.url,
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls).toHaveLength(2);
    expect(urls.some((url) => url.includes('start=50'))).toBe(false);
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '3789011111',
      '3789022222',
    ]);
    expect(result.stopReason).toBe('no_new_jobs');
  });
});
