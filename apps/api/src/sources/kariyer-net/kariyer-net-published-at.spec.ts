import { parseKariyerNetPublishedAt } from './kariyer-net-published-at.js';

const NOW = new Date('2026-09-02T10:00:00.000Z');

describe('parseKariyerNetPublishedAt', () => {
  it('does not treat an update label as a publish date', () => {
    expect(parseKariyerNetPublishedAt('update 1 gün', NOW)).toBeNull();
    expect(
      parseKariyerNetPublishedAt('14 gün önce güncellendi', NOW),
    ).toBeNull();
  });

  it('parses "1 gün" as now minus 1 day', () => {
    expect(parseKariyerNetPublishedAt('1 gün', NOW)).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });

  it('parses "2 gün önce" as now minus 2 days', () => {
    expect(parseKariyerNetPublishedAt('2 gün önce', NOW)).toBe(
      '2026-08-31T10:00:00.000Z',
    );
  });

  it('parses "bugün" as the current instant', () => {
    expect(parseKariyerNetPublishedAt('bugün', NOW)).toBe(
      '2026-09-02T10:00:00.000Z',
    );
  });

  it('parses "dün" as now minus 1 day', () => {
    expect(parseKariyerNetPublishedAt('dün', NOW)).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });

  it('parses "3 saat önce" as now minus 3 hours', () => {
    expect(parseKariyerNetPublishedAt('3 saat önce', NOW)).toBe(
      '2026-09-02T07:00:00.000Z',
    );
  });

  it('keeps a confident ISO timestamp', () => {
    expect(parseKariyerNetPublishedAt('2026-08-15T12:30:00.000Z', NOW)).toBe(
      '2026-08-15T12:30:00.000Z',
    );
  });

  it('returns null for invalid values instead of the raw string', () => {
    expect(parseKariyerNetPublishedAt('not a date', NOW)).toBeNull();
    expect(parseKariyerNetPublishedAt('soon', NOW)).toBeNull();
    expect(parseKariyerNetPublishedAt('1', NOW)).toBeNull();
  });

  it('returns null for empty values', () => {
    expect(parseKariyerNetPublishedAt('', NOW)).toBeNull();
    expect(parseKariyerNetPublishedAt('   ', NOW)).toBeNull();
    expect(parseKariyerNetPublishedAt(undefined, NOW)).toBeNull();
    expect(parseKariyerNetPublishedAt(null, NOW)).toBeNull();
  });
});
