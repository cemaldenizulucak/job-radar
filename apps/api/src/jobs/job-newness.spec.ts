import {
  applyJobNewness,
  DEFAULT_JOB_NEW_WINDOW_HOURS,
  isJobNewForUser,
  resolveJobNewWindowHours,
} from './job-newness.js';

describe('resolveJobNewWindowHours', () => {
  it('defaults to 24 hours when unset or invalid', () => {
    expect(resolveJobNewWindowHours(undefined)).toBe(DEFAULT_JOB_NEW_WINDOW_HOURS);
    expect(resolveJobNewWindowHours('')).toBe(DEFAULT_JOB_NEW_WINDOW_HOURS);
    expect(resolveJobNewWindowHours('0')).toBe(DEFAULT_JOB_NEW_WINDOW_HOURS);
    expect(resolveJobNewWindowHours('nope')).toBe(DEFAULT_JOB_NEW_WINDOW_HOURS);
  });

  it('reads a positive integer from configuration', () => {
    expect(resolveJobNewWindowHours('12')).toBe(12);
  });
});

describe('isJobNewForUser', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');

  it('is new when the first event is inside the window', () => {
    expect(
      isJobNewForUser(new Date('2026-09-01T01:00:00.000Z'), now, 24),
    ).toBe(true);
  });

  it('is not new when the first event is older than the window', () => {
    expect(
      isJobNewForUser(new Date('2026-08-30T11:59:59.000Z'), now, 24),
    ).toBe(false);
  });
});

describe('applyJobNewness', () => {
  it('uses the earliest user match when present', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    const [item] = applyJobNewness(
      [
        {
          id: 'job-1',
          firstDiscoveredAt: new Date('2026-08-01T00:00:00.000Z'),
          isNew: false,
          isSeen: false,
        },
      ],
      [
        { jobId: 'job-1', matchedAt: new Date('2026-09-01T10:00:00.000Z') },
        { jobId: 'job-1', matchedAt: new Date('2026-09-01T08:00:00.000Z') },
      ],
      now,
      24,
    );

    expect(item?.isNew).toBe(true);
    expect(item?.isSeen).toBe(false);
  });

  it('clears isNew once the user has seen the job', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    const [item] = applyJobNewness(
      [
        {
          id: 'job-1',
          firstDiscoveredAt: new Date('2026-09-01T10:00:00.000Z'),
          isNew: true,
          isSeen: false,
        },
      ],
      [],
      now,
      24,
      new Set(['job-1']),
    );

    expect(item?.isSeen).toBe(true);
    expect(item?.isNew).toBe(false);
  });
});
