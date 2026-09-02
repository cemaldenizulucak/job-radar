import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseLinkedInSearchHtml } from './linkedin-html.parser.js';
import {
  linkedInNormalizeRejectionReasons,
  normalizeLinkedInJob,
} from './linkedin.normalizer.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'html');

function fixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

describe('parseLinkedInSearchHtml', () => {
  it('parses guest listing cards including a relative job URL', () => {
    const parsed = parseLinkedInSearchHtml(fixture('search-listing.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toEqual([
      expect.objectContaining({
        externalJobId: '3789011111',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/3789011111',
        title: 'Frontend Developer',
        companyName: 'Acme',
        location: 'Istanbul, Turkey',
        publishedAt: '2026-09-01',
        description: 'React and TypeScript',
      }),
      expect.objectContaining({
        externalJobId: '3789022222',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/3789022222',
        title: 'React Developer',
        companyName: 'Nova Labs',
        location: 'Remote',
        workModel: 'remote',
        publishedAt: '2026-08-20T12:00:00.000Z',
      }),
    ]);
  });

  it('keeps a single listing when the same LinkedIn job id appears twice', () => {
    const parsed = parseLinkedInSearchHtml(fixture('search-duplicate.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]?.externalJobId).toBe('3789011111');
  });

  it('keeps two cards when LinkedIn job ids differ even if titles match', () => {
    const html = `<ul class="jobs-search__results-list">
      <li>
        <div class="job-search-card" data-entity-urn="urn:li:jobPosting:3789011111">
          <a href="/jobs/view/3789011111"><h3 class="base-search-card__title">Frontend Developer - Next</h3></a>
        </div>
      </li>
      <li>
        <div class="job-search-card" data-entity-urn="urn:li:jobPosting:3789099999">
          <a href="/jobs/view/3789099999"><h3 class="base-search-card__title">Frontend Developer - Next</h3></a>
        </div>
      </li>
    </ul>`;
    const parsed = parseLinkedInSearchHtml(html);

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs.map((job) => job.externalJobId)).toEqual([
      '3789011111',
      '3789099999',
    ]);
  });

  it('reads a JobPosting from JSON-LD', () => {
    const parsed = parseLinkedInSearchHtml(fixture('search-json-ld.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toEqual([
      expect.objectContaining({
        externalJobId: '3789033333',
        title: 'Angular Developer',
        companyName: 'Delta Soft',
        location: 'Istanbul',
        publishedAt: '2026-08-30',
      }),
    ]);
  });

  it('treats a bot-check or login wall as blocked', () => {
    expect(parseLinkedInSearchHtml(fixture('search-challenge.html'))).toEqual({
      kind: 'blocked',
      reason: 'challenge',
    });
  });

  it('returns zero jobs for an empty results page', () => {
    expect(parseLinkedInSearchHtml(fixture('search-empty.html'))).toEqual({
      kind: 'jobs',
      jobs: [],
    });
  });

  it('treats unrelated HTML as a parser mismatch', () => {
    expect(parseLinkedInSearchHtml(fixture('search-malformed.html'))).toEqual({
      kind: 'mismatch',
      reason: 'LinkedIn HTML did not contain parseable job listings.',
    });
  });

  it('normalizes a parsed card into the shared job model', () => {
    const parsed = parseLinkedInSearchHtml(fixture('search-listing.html'));
    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    const job = normalizeLinkedInJob(parsed.jobs[0] ?? {});
    expect(job?.sourceId).toBe('linkedin');
    expect(job?.sourceJobId).toBe('3789011111');
    expect(job?.isActive).toBe(true);
    expect(linkedInNormalizeRejectionReasons(parsed.jobs[0] ?? {})).toEqual([]);
  });

  it('keeps a listing when location, date, and description are missing', () => {
    const parsed = parseLinkedInSearchHtml(fixture('search-missing-fields.html'));

    expect(parsed.kind).toBe('jobs');
    if (parsed.kind !== 'jobs') {
      return;
    }

    expect(parsed.jobs).toEqual([
      expect.objectContaining({
        externalJobId: '3789066666',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/3789066666',
        title: 'Frontend Developer',
        companyName: 'Acme',
        location: undefined,
        publishedAt: undefined,
        description: undefined,
      }),
    ]);

    const job = normalizeLinkedInJob(parsed.jobs[0] ?? {});
    expect(job?.publishedAt).toBeNull();
    expect(job?.location).toBeNull();
  });
});
