import { describe, expect, it } from 'vitest';

import { jobsEmptyMessage } from './copy';

describe('jobsEmptyMessage', () => {
  it('uses the matched empty copy when the matched feed has no jobs', () => {
    expect(
      jobsEmptyMessage({ itemCount: 0, visibleCount: 0, resultsView: 'matched' }),
    ).toBe('Bu aramaya uygun ilan bulunamadı.');
  });

  it('uses the all-results empty copy when nothing is collected', () => {
    expect(
      jobsEmptyMessage({ itemCount: 0, visibleCount: 0, resultsView: 'all' }),
    ).toBe('Henüz ilan bulunamadı.');
  });

  it('uses the filter empty copy when a search tab has no visible jobs', () => {
    expect(
      jobsEmptyMessage({ itemCount: 4, visibleCount: 0, resultsView: 'matched' }),
    ).toBe('Bu filtre için henüz eşleşen ilan yok.');
  });

  it('does not show an empty-match message while discovery is still running', () => {
    expect(
      jobsEmptyMessage({
        itemCount: 0,
        visibleCount: 0,
        resultsView: 'matched',
        isDiscovering: true,
      }),
    ).toBeNull();
  });
});
