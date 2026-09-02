import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SourceAuthenticationError,
  SourceParseError,
  SourceUnavailableError,
} from '../source-errors.js';
import type { KariyerNetHttpClient } from './kariyer-net-http.client.js';
import type { KariyerNetWebConfig } from './kariyer-net-web.config.js';
import { KariyerNetWebProvider } from './kariyer-net-web.provider.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'html');

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function config(): KariyerNetWebConfig {
  return {
    baseUrl: 'https://www.kariyer.net',
    timeoutMs: 50,
    delayMs: 0,
    maxRetries: 1,
    maxJobsPerSearch: 25,
    maxPages: 2,
    userAgent: 'JobRadar-Test/1.0',
    debugHtml: false,
  };
}

function httpClient(
  impl: KariyerNetHttpClient['get'],
): KariyerNetHttpClient {
  return { get: impl };
}

const emptyInput = {
  keywords: ['frontend'],
  locations: ['Istanbul'],
  workTypes: [],
  experienceLevels: [],
};

function listingHtmlWithJobs(count: number): string {
  const cards = Array.from({ length: count }, (_, index) => {
    const id = `429100000${index + 1}`;
    return `
        <div data-test="ad-card" class="job-list-card-item">
          <a
            href="/is-ilani/ornek-teknoloji-frontend-developer-${id}"
            data-test="ad-card-item"
          >
            <span data-test="ad-card-title">Frontend Developer ${index + 1}</span>
            <span data-test="subtitle">Ornek Teknoloji</span>
            <span data-test="location">Istanbul</span>
          </a>
        </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
  <body>
    <div data-test="list-items" class="list-items">${cards}
    </div>
  </body>
</html>`;
}

describe('KariyerNetWebProvider', () => {
  it('parses a public search page through the injected HTTP client', async () => {
    const urls: string[] = [];
    const provider = new KariyerNetWebProvider(
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

    expect(urls[0]).toBe(
      'https://www.kariyer.net/is-ilanlari/istanbul?kw=frontend',
    );
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '4291111111',
      '4292222222',
    ]);
  });

  it('is idempotent for the same listing HTML', async () => {
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: fixture('search-listing.html'),
      })),
    );

    const first = await provider.search(emptyInput);
    const second = await provider.search(emptyInput);

    expect(second.jobs.map((job) => job.externalJobId)).toEqual(
      first.jobs.map((job) => job.externalJobId),
    );
  });

  it('throws SourceAuthenticationError when Kariyer.net blocks the request', async () => {
    const provider = new KariyerNetWebProvider(
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
    const provider = new KariyerNetWebProvider(
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
    const provider = new KariyerNetWebProvider(
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
    const provider = new KariyerNetWebProvider(
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

  it('fetches sequential pages until an empty page', async () => {
    const urls: string[] = [];
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async (request) => {
        urls.push(request.url);
        if (request.url.includes('cp=2')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: fixture('search-empty.html'),
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

    expect(urls).toEqual([
      'https://www.kariyer.net/is-ilanlari/istanbul?kw=frontend',
      'https://www.kariyer.net/is-ilanlari/istanbul?kw=frontend&cp=2',
    ]);
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '4291111111',
      '4292222222',
    ]);
    expect(result.pagesFetched).toBe(2);
    expect(result.jobsCollected).toBe(2);
    expect(result.stopReason).toBe('no_results');
  });

  it('keeps page 1 jobs when page 2 is blocked', async () => {
    const urls: string[] = [];
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async (request) => {
        urls.push(request.url);
        if (request.url.includes('cp=2')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: fixture('search-challenge.html'),
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(4),
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls).toEqual([
      'https://www.kariyer.net/is-ilanlari/istanbul?kw=frontend',
      'https://www.kariyer.net/is-ilanlari/istanbul?kw=frontend&cp=2',
    ]);
    expect(result.jobs).toHaveLength(4);
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '4291000001',
      '4291000002',
      '4291000003',
      '4291000004',
    ]);
    expect(result.pagesFetched).toBe(1);
    expect(result.jobsCollected).toBe(4);
    expect(result.stopReason).toBe('blocked_after_success');
  });
});
