import { isVisibleInMatchedJobFeed, clampJobFeedLimit } from './job-feed-visibility.js';

describe('isVisibleInMatchedJobFeed', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('keeps an active job with unknown published date', () => {
    expect(
      isVisibleInMatchedJobFeed({ isActive: true, publishedAt: null }, 30, now),
    ).toBe(true);
  });

  it('hides inactive jobs', () => {
    expect(
      isVisibleInMatchedJobFeed({ isActive: false, publishedAt: null }, 30, now),
    ).toBe(false);
  });

  it('hides jobs older than the feed max-age window', () => {
    expect(
      isVisibleInMatchedJobFeed(
        { isActive: true, publishedAt: '2026-07-01T00:00:00.000Z' },
        30,
        now,
      ),
    ).toBe(false);
  });
});

describe('clampJobFeedLimit', () => {
  it('defaults to 50 and caps at 200', () => {
    expect(clampJobFeedLimit(undefined)).toBe(50);
    expect(clampJobFeedLimit(12)).toBe(12);
    expect(clampJobFeedLimit(500)).toBe(200);
    expect(clampJobFeedLimit(0)).toBe(1);
  });
});
