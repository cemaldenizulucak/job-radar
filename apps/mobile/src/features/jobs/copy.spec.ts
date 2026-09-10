import { describe, expect, it } from 'vitest';

import {
  jobsEmptyMessage,
  isUnverifiedSourceMatch,
  matchKindLabel,
  matchResultsTabLabel,
} from './copy';

describe('jobsEmptyMessage', () => {
  it('uses the verified empty copy when the matched tab has no jobs', () => {
    expect(
      jobsEmptyMessage({ itemCount: 0, visibleCount: 0, resultsView: 'matched' }),
    ).toBe('Henüz doğrulanmış bir eşleşme bulunamadı.');
  });

  it('uses the possible-match empty copy when that tab has no jobs', () => {
    expect(
      jobsEmptyMessage({
        itemCount: 0,
        visibleCount: 0,
        resultsView: 'possible',
      }),
    ).toBe('Şu anda doğrulanmayı bekleyen ilan bulunmuyor.');
  });

  it('uses the all-results empty copy when nothing is collected', () => {
    expect(
      jobsEmptyMessage({ itemCount: 0, visibleCount: 0, resultsView: 'all' }),
    ).toBe('Henüz ilan bulunamadı.');
  });

  it('uses the filter empty copy when a search tab has no visible jobs', () => {
    expect(
      jobsEmptyMessage({ itemCount: 4, visibleCount: 0, resultsView: 'matched' }),
    ).toBe('Seçili filtrelerle eşleşen ilan yok.');
  });

  it('explains an empty filtered result even when the tab itself has jobs', () => {
    expect(
      jobsEmptyMessage({
        itemCount: 0,
        visibleCount: 0,
        resultsView: 'matched',
        hasActiveFilters: true,
      }),
    ).toBe('Seçili filtrelerle eşleşen ilan yok.');
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

  it('keeps loading and error distinct from zero results', () => {
    expect(
      jobsEmptyMessage({
        itemCount: 0,
        visibleCount: 0,
        resultsView: 'matched',
        isLoading: true,
      }),
    ).toBeNull();
    expect(
      jobsEmptyMessage({
        itemCount: 0,
        visibleCount: 0,
        resultsView: 'matched',
        hasError: true,
      }),
    ).toBeNull();
  });
});

describe('matchResultsTabLabel', () => {
  it('puts the user-specific count in the tab title', () => {
    expect(matchResultsTabLabel('matched', 12)).toBe('Eşleşen (12)');
    expect(matchResultsTabLabel('possible', 3)).toBe('Olası (3)');
    expect(matchResultsTabLabel('all', 65)).toBe('Tüm sonuçlar (65)');
  });

  it('omits counts while a new filter scope is loading', () => {
    expect(matchResultsTabLabel('matched', null)).toBe('Eşleşen');
  });
});

describe('matchKindLabel', () => {
  it('maps backend match kinds to Turkish labels', () => {
    expect(matchKindLabel('direct')).toBe('Doğrudan eşleşme');
    expect(matchKindLabel('skill')).toBe('Beceri eşleşmesi');
    expect(matchKindLabel(null)).toBeNull();
  });
});

describe('isUnverifiedSourceMatch', () => {
  it('labels unverified source candidates without inventing evidence', () => {
    expect(isUnverifiedSourceMatch('unverified_source_candidate')).toBe(true);
    expect(isUnverifiedSourceMatch('verified')).toBe(false);
    expect(isUnverifiedSourceMatch(undefined)).toBe(false);
  });
});
