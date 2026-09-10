import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SourceChallengeError,
  SourceParseError,
  SourceRateLimitError,
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
    maxDetailRequests: 4,
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

  it('throws SourceChallengeError when Kariyer.net blocks the request', async () => {
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async () => ({
        status: 403,
        contentType: 'text/html',
        body: 'forbidden',
      })),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceChallengeError,
    );
    await expect(provider.search(emptyInput)).rejects.toMatchObject({
      category: 'challenge',
    });
  });

  it('throws SourceChallengeError on a challenge page', async () => {
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: fixture('search-challenge.html'),
      })),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceChallengeError,
    );
    await expect(provider.search(emptyInput)).rejects.toMatchObject({
      category: 'challenge',
    });
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

  it('honors Retry-After on HTTP 429 instead of a fixed retry', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 1 },
      httpClient(async () => {
        attempts += 1;
        if (attempts === 1) {
          return {
            status: 429,
            contentType: 'text/html',
            body: 'slow down',
            retryAfterSeconds: 7,
          };
        }
        return {
          status: 200,
          contentType: 'text/html',
          body: fixture('search-listing.html'),
        };
      }),
      {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    const result = await provider.search(emptyInput);

    expect(attempts).toBe(2);
    expect(sleeps).toContain(7000);
    expect(result.jobs).toHaveLength(2);
  });

  it('does not retry HTTP 429 when Retry-After is missing', async () => {
    let attempts = 0;
    const provider = new KariyerNetWebProvider(
      config(),
      httpClient(async () => {
        attempts += 1;
        return {
          status: 429,
          contentType: 'text/html',
          body: 'slow down',
        };
      }),
    );

    await expect(provider.search(emptyInput)).rejects.toBeInstanceOf(
      SourceRateLimitError,
    );
    expect(attempts).toBe(1);
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

  it('keeps fetching after a page that includes an old listing', async () => {
    const urls: string[] = [];
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 2 },
      httpClient(async (request) => {
        urls.push(request.url);
        if (request.url.includes('cp=2')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: listingHtmlWithJobs(1).replace(
              'Frontend Developer 1',
              'Later Page Developer',
            ).replace('4291000001', '4291000099'),
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(1).replace(
            '</a>',
            '<span data-test="ad-date-item-date-other">90 gün</span></a>',
          ),
        };
      }),
    );

    const result = await provider.search(emptyInput);

    expect(urls).toHaveLength(2);
    expect(result.jobs.map((job) => job.externalJobId)).toEqual([
      '4291000001',
      '4291000099',
    ]);
    expect(result.stopReason).toBe('max_pages');
  });

  it('stops when page 2 repeats page 1 identities', async () => {
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 3 },
      httpClient(async () => ({
        status: 200,
        contentType: 'text/html',
        body: listingHtmlWithJobs(2),
      })),
    );

    const result = await provider.search(emptyInput);

    expect(result.pagesFetched).toBe(2);
    expect(result.stopReason).toBe('pagination_loop');
    expect(result.jobs).toHaveLength(2);
  });

  it('fills a missing description from a detail page and keeps list jobs if detail fails', async () => {
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 1, maxDetailRequests: 2 },
      httpClient(async (request) => {
        if (request.url.includes('/is-ilani/')) {
          if (request.url.includes('4291000002')) {
            return { status: 500, contentType: 'text/html', body: 'nope' };
          }

          return {
            status: 200,
            contentType: 'text/html',
            body: `<script type="application/ld+json">${JSON.stringify({
              '@type': 'JobPosting',
              title: 'Frontend Developer 1',
              url: 'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291000001',
              description: 'React and TypeScript role',
              hiringOrganization: { name: 'Ornek Teknoloji' },
            })}</script>`,
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(2),
        };
      }),
    );

    const searched = await provider.search(emptyInput);
    const enriched = await provider.enrichMissingDescriptions(searched.jobs);

    expect(enriched.detailsFetched).toBe(1);
    expect(enriched.detailsFailed).toBe(1);
    expect(
      enriched.jobs.find((job) => job.externalJobId === '4291000001')?.description,
    ).toBe('React and TypeScript role');
    expect(
      enriched.jobs.find((job) => job.externalJobId === '4291000002')?.title,
    ).toBe('Frontend Developer 2');
  });

  it('does not store a detail body when the redirect leaves the source host', async () => {
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 1, maxDetailRequests: 1 },
      httpClient(async (request) => {
        if (request.url.includes('/is-ilani/')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: `<script type="application/ld+json">${JSON.stringify({
              '@type': 'JobPosting',
              title: 'Frontend Developer 1',
              url: 'https://evil.example/phish',
              description: 'stolen copy',
              hiringOrganization: { name: 'Ornek Teknoloji' },
            })}</script>`,
            finalUrl: 'https://evil.example/phish',
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(1),
        };
      }),
    );

    const searched = await provider.search(emptyInput);
    const enriched = await provider.enrichMissingDescriptions(searched.jobs);

    expect(enriched.detailsFetched).toBe(0);
    expect(enriched.detailsFailed).toBe(1);
    expect(
      enriched.jobs.find((job) => job.externalJobId === '4291000001')?.description,
    ).toBeUndefined();
  });

  it('does not treat a 403 CAPTCHA detail page as fetched', async () => {
    const captchaHtml = `<html><body>${'captcha '.repeat(40)}<a href="/is-ilani/x">x</a></body></html>`;
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 1, maxDetailRequests: 1 },
      httpClient(async (request) => {
        if (request.url.includes('/is-ilani/')) {
          return {
            status: 403,
            contentType: 'text/html',
            body: captchaHtml,
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(1),
        };
      }),
    );

    const searched = await provider.search(emptyInput);
    const enriched = await provider.enrichMissingDescriptions(searched.jobs);

    expect(enriched.detailsFetched).toBe(0);
    expect(enriched.descriptionsExtracted).toBe(0);
    expect(enriched.outcomes?.[0]).toEqual(
      expect.objectContaining({
        requestSucceeded: false,
        detailFetched: false,
        descriptionExtracted: false,
        errorCategory: 'challenge',
        httpStatus: 403,
      }),
    );
    expect(enriched.jobs[0]?.description).toBeUndefined();
    expect(JSON.stringify(enriched.jobs[0]?.description ?? '')).not.toContain(
      'captcha',
    );
  });

  it('does not treat a 200 CAPTCHA detail page as fetched', async () => {
    const captchaHtml = `<html><body>${'captcha '.repeat(40)}<a href="/is-ilani/x">x</a></body></html>`;
    const provider = new KariyerNetWebProvider(
      { ...config(), maxPages: 1, maxDetailRequests: 1 },
      httpClient(async (request) => {
        if (request.url.includes('/is-ilani/')) {
          return {
            status: 200,
            contentType: 'text/html',
            body: captchaHtml,
          };
        }

        return {
          status: 200,
          contentType: 'text/html',
          body: listingHtmlWithJobs(1),
        };
      }),
    );

    const searched = await provider.search(emptyInput);
    const enriched = await provider.enrichMissingDescriptions(searched.jobs);

    expect(enriched.detailsFetched).toBe(0);
    expect(enriched.outcomes?.[0]?.errorCategory).toBe('challenge');
    expect(enriched.jobs[0]?.description).toBeUndefined();
  });
});
