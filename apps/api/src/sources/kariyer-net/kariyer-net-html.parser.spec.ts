import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseKariyerNetSearchHtml } from './kariyer-net-html.parser.js';
import { fallbackIdFromCanonicalUrl } from './kariyer-net-listing-id.js';
import {
  kariyerNetNormalizeRejectionReasons,
  normalizeKariyerNetJob,
} from './kariyer-net.normalizer.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'html');

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

describe('parseKariyerNetSearchHtml', () => {
  it('parses current listing cards with nested title and company elements', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-listing.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toEqual([
      expect.objectContaining({
        externalJobId: '4291111111',
        canonicalUrl:
          'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111',
        title: 'Frontend Developer',
        companyName: 'Ornek Teknoloji',
        location: 'Istanbul',
        workModel: 'Hibrit',
        employmentType: 'Tam zamanlı',
        publishedAt: '1 gün',
      }),
      expect.objectContaining({
        externalJobId: '4292222222',
        title: 'React Developer',
        companyName: 'Pixel Works',
        workModel: 'Uzaktan',
      }),
    ]);
    expect(parsed.jobs[0]?.title).toBe('Frontend Developer');
    expect(parsed.jobs[0]?.title).not.toContain('Ornek Teknoloji');
  });

  it('normalizes current listing cards once company is read from the nested subtitle', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-listing.html'));
    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    const normalized = parsed.jobs.map((job) => normalizeKariyerNetJob(job));
    expect(normalized.filter((job) => job !== null)).toHaveLength(2);
    expect(normalized[0]?.companyName).toBe('Ornek Teknoloji');
    expect(normalized[0]?.canonicalUrl).toBe(
      'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111',
    );
    expect(normalized[0]?.publishedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(normalized[0]?.publishedAt).not.toBe('1 gün');
  });

  it('parses nested title and company instead of the wrapping anchor text', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-nested-card.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]).toEqual(
      expect.objectContaining({
        title: 'Frontend Developer',
        companyName: 'Ornek Teknoloji',
        canonicalUrl:
          'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111',
      }),
    );
  });

  it('turns relative listing URLs into canonical Kariyer.net URLs', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-duplicate-anchors.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs[0]?.canonicalUrl).toBe(
      'https://www.kariyer.net/is-ilani/example-123456',
    );
    expect(parsed.jobs[0]?.externalJobId).toBe('123456');
  });

  it('deduplicates multiple anchors for the same listing', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-duplicate-anchors.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toHaveLength(1);
  });

  it('keeps company and location unset when the card omits them', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-missing-fields.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]?.title).toBe('Frontend Developer');
    expect(parsed.jobs[0]?.externalJobId).toBe('4291111111');
    expect(parsed.jobs[0]?.companyName).toBeUndefined();
    expect(parsed.jobs[0]?.location).toBeUndefined();
    expect(parsed.jobs[0]?.description).toBeUndefined();
    expect(normalizeKariyerNetJob(parsed.jobs[0] ?? {})).toBeNull();
    expect(kariyerNetNormalizeRejectionReasons(parsed.jobs[0] ?? {})).toEqual([
      'missing companyName (required by NormalizedJob; listing pages may omit it)',
    ]);
  });

  it('still reads data-* attributes on a simple listing anchor', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-attribute-card.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs[0]).toEqual(
      expect.objectContaining({
        title: 'Frontend Developer',
        companyName: 'Ornek Teknoloji',
        location: 'Istanbul',
        workModel: 'Hibrit',
      }),
    );
  });

  it('reads JSON-LD JobPosting records from the public page', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-json-ld.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs[0]).toEqual(
      expect.objectContaining({
        externalJobId: '4293333333',
        companyName: 'Ornek LD',
        location: 'Izmir',
        employmentType: 'FULL_TIME',
        description: 'Listing-page description excerpt.',
      }),
    );
  });

  it('derives a stable id when the listing URL has no numeric id', () => {
    const parsed = parseKariyerNetSearchHtml(
      fixture('search-url-fallback-id.html'),
    );

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs[0]?.externalJobId).toBe(
      fallbackIdFromCanonicalUrl(
        'https://www.kariyer.net/is-ilani/ornek-frontend-no-numeric-id',
      ),
    );
    expect(parsed.jobs[0]?.companyName).toBe('Ornek Teknoloji');
  });

  it('skips a listing card that only has a control link', () => {
    const parsed = parseKariyerNetSearchHtml(fixture('search-malformed-card.html'));

    expect(parsed).toEqual({ kind: 'jobs', jobs: [] });
  });

  it('treats a bot-check page as blocked', () => {
    expect(parseKariyerNetSearchHtml(fixture('search-challenge.html'))).toEqual({
      kind: 'blocked',
      reason: 'challenge',
    });
  });

  it('returns no jobs for an empty results page', () => {
    expect(parseKariyerNetSearchHtml(fixture('search-empty.html'))).toEqual({
      kind: 'jobs',
      jobs: [],
    });
  });

  it('fails clearly on malformed HTML with no listings', () => {
    expect(parseKariyerNetSearchHtml(fixture('search-malformed.html'))).toEqual({
      kind: 'mismatch',
      reason: 'Kariyer.net HTML did not contain parseable job listings.',
    });
  });
});
