import { parseLinkedInPublishedAt } from './linkedin-published-at.js';

const NOW = new Date('2026-09-02T10:00:00.000Z');

describe('parseLinkedInPublishedAt', () => {
  it('parses relative English timestamps', () => {
    expect(parseLinkedInPublishedAt('2 hours ago', NOW)).toBe(
      '2026-09-02T08:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('1 day ago', NOW)).toBe(
      '2026-09-01T10:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('3 days ago', NOW)).toBe(
      '2026-08-30T10:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('2 weeks ago', NOW)).toBe(
      '2026-08-19T10:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('1 month ago', NOW)).toBe(
      '2026-08-03T10:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('3 hours ago', NOW)).toBe(
      '2026-09-02T07:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('yesterday', NOW)).toBe(
      '2026-09-01T10:00:00.000Z',
    );
    expect(parseLinkedInPublishedAt('just now', NOW)).toBe(
      '2026-09-02T10:00:00.000Z',
    );
  });

  it('keeps a confident ISO timestamp', () => {
    expect(parseLinkedInPublishedAt('2026-08-15T12:30:00.000Z', NOW)).toBe(
      '2026-08-15T12:30:00.000Z',
    );
    expect(parseLinkedInPublishedAt('2026-08-15', NOW)).toBe(
      '2026-08-15T00:00:00.000Z',
    );
  });

  it('returns null for invalid or empty values instead of inventing a date', () => {
    expect(parseLinkedInPublishedAt('not a date', NOW)).toBeNull();
    expect(parseLinkedInPublishedAt('Reposted', NOW)).toBeNull();
    expect(parseLinkedInPublishedAt('', NOW)).toBeNull();
    expect(parseLinkedInPublishedAt(undefined, NOW)).toBeNull();
  });
});
