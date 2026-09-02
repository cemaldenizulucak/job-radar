import {
  DEFAULT_JOB_SOURCE_MAX_AGE_DAYS,
  isWithinSourceMaxAge,
  sourceMaxAgeCutoff,
} from './discovery-window.js';

describe('isWithinSourceMaxAge', () => {
  const now = new Date('2026-09-02T10:00:00.000Z');

  it('keeps missing and unparseable publishedAt', () => {
    expect(isWithinSourceMaxAge(null, 30, now)).toBe(true);
    expect(isWithinSourceMaxAge(undefined, 30, now)).toBe(true);
    expect(isWithinSourceMaxAge('not a date', 30, now)).toBe(true);
  });

  it('keeps jobs published inside the window', () => {
    expect(isWithinSourceMaxAge('2026-08-20T10:00:00.000Z', 30, now)).toBe(true);
  });

  it('discards jobs confidently older than the window', () => {
    expect(isWithinSourceMaxAge('2026-07-01T10:00:00.000Z', 30, now)).toBe(
      false,
    );
    expect(sourceMaxAgeCutoff(DEFAULT_JOB_SOURCE_MAX_AGE_DAYS, now).toISOString()).toBe(
      '2026-08-03T10:00:00.000Z',
    );
  });
});
