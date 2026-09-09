import { describe, expect, it } from 'vitest';

import {
  buildSourceQueryUnits,
  collectSourceQueryLocations,
  collectSourceQueryPhrases,
  resolveScanKind,
  selectQueryUnits,
  sourceQueryPlanFingerprint,
  nextQueryStartIndex,
} from './source-query-plan.js';

describe('collectSourceQueryPhrases', () => {
  it('keeps comma-separated phrases as alternatives and adds field-form variants', () => {
    expect(
      collectSourceQueryPhrases([
        'Gıda Mühendisi',
        'Kalite güvence',
        'denetçi',
      ]),
    ).toEqual([
      { text: 'Gıda Mühendisi', origin: 'user' },
      { text: 'Kalite güvence', origin: 'user' },
      { text: 'denetçi', origin: 'user' },
      { text: 'Gıda Mühendisliği', origin: 'profession_variant' },
    ]);
  });

  it('splits a comma blob without turning the original into an AND query', () => {
    expect(
      collectSourceQueryPhrases(['Gıda Mühendisi, Kalite güvence, denetçi']),
    ).toEqual([
      { text: 'Gıda Mühendisi', origin: 'user' },
      { text: 'Kalite güvence', origin: 'user' },
      { text: 'denetçi', origin: 'user' },
      { text: 'Gıda Mühendisliği', origin: 'profession_variant' },
    ]);
  });

  it('applies the same field-form transform to Gıda, Makine, and Çevre', () => {
    expect(collectSourceQueryPhrases(['Gıda Mühendisi']).map((item) => item.text)).toEqual([
      'Gıda Mühendisi',
      'Gıda Mühendisliği',
    ]);
    expect(collectSourceQueryPhrases(['Makine Mühendisi']).map((item) => item.text)).toEqual([
      'Makine Mühendisi',
      'Makine Mühendisliği',
    ]);
    expect(collectSourceQueryPhrases(['Çevre Mühendisi']).map((item) => item.text)).toEqual([
      'Çevre Mühendisi',
      'Çevre Mühendisliği',
    ]);
  });

  it('keeps unknown terms and does not invent technician or specialist variants', () => {
    expect(collectSourceQueryPhrases(['denetçi', 'Kalite Uzmanı'])).toEqual([
      { text: 'denetçi', origin: 'user' },
      { text: 'Kalite Uzmanı', origin: 'user' },
    ]);
    expect(collectSourceQueryPhrases(['Gıda Teknikeri'])).toEqual([
      { text: 'Gıda Teknikeri', origin: 'user' },
    ]);
    expect(collectSourceQueryPhrases(['Mimar'])).toEqual([
      { text: 'Mimar', origin: 'user' },
    ]);
  });

  it('does not drop the discipline when adding a field-form variant', () => {
    const variant = collectSourceQueryPhrases(['Gıda Mühendisi']).find(
      (item) => item.origin === 'profession_variant',
    );
    expect(variant?.text).toBe('Gıda Mühendisliği');
    expect(variant?.text.startsWith('Gıda')).toBe(true);
  });
});

describe('collectSourceQueryLocations', () => {
  it('keeps İzmir and Manisa as alternative cities', () => {
    expect(
      collectSourceQueryLocations({
        locations: ['İzmir', 'İzmir, Türkiye', 'Manisa', 'Manisa, Türkiye'],
        countryName: 'Türkiye',
        subdivisionNames: ['İzmir', 'Manisa'],
      }),
    ).toEqual(['İzmir', 'Manisa']);
  });
});

describe('buildSourceQueryUnits', () => {
  it('fans phrases and cities out instead of AND-combining them', () => {
    const units = buildSourceQueryUnits({
      keywords: ['Gıda Mühendisi', 'Kalite güvence'],
      locations: [],
      countryName: 'Türkiye',
      subdivisionNames: ['İzmir', 'Manisa'],
    });

    expect(units.map((unit) => `${unit.keyword}@${unit.location}`)).toEqual([
      'Gıda Mühendisi@İzmir',
      'Gıda Mühendisi@Manisa',
      'Kalite güvence@İzmir',
      'Kalite güvence@Manisa',
      'Gıda Mühendisliği@İzmir',
      'Gıda Mühendisliği@Manisa',
    ]);
  });
});

describe('selectQueryUnits', () => {
  it('reports leftover queries as deferred instead of dropping them', () => {
    const units = buildSourceQueryUnits({
      keywords: ['alpha', 'beta', 'gamma'],
      locations: [],
      subdivisionNames: ['İzmir'],
    });
    const first = selectQueryUnits(units, { startIndex: 0, maxQueries: 2 });

    expect(first.selected.map((unit) => unit.keyword)).toEqual(['alpha', 'beta']);
    expect(first.deferred.map((unit) => unit.keyword)).toEqual(['gamma']);
    expect(first.truncated).toBe(true);
    expect(first.nextIndex).toBe(2);

    const second = selectQueryUnits(units, {
      startIndex: first.nextIndex,
      maxQueries: 2,
    });
    expect(second.selected.map((unit) => unit.keyword)).toEqual(['gamma', 'alpha']);
  });
});

describe('nextQueryStartIndex', () => {
  it('resumes at the first unattempted unit after a time-budget cut', () => {
    expect(
      nextQueryStartIndex({
        unitCount: 3,
        startIndex: 0,
        attempted: 1,
        deferredCount: 2,
      }),
    ).toBe(1);
  });

  it('matches the planner wrap index when the selected window completed', () => {
    expect(
      nextQueryStartIndex({
        unitCount: 3,
        startIndex: 0,
        attempted: 2,
        deferredCount: 1,
      }),
    ).toBe(2);
  });

  it('resets when nothing is deferred', () => {
    expect(
      nextQueryStartIndex({
        unitCount: 6,
        startIndex: 2,
        attempted: 6,
        deferredCount: 0,
      }),
    ).toBe(0);
  });
});

describe('sourceQueryPlanFingerprint', () => {
  it('changes when keywords or cities change', () => {
    const base = {
      keywords: ['Gıda Mühendisi'],
      locations: [],
      countryName: 'Türkiye',
      subdivisionNames: ['İzmir'],
      sourceIds: ['kariyer_net'] as const,
      technologies: [],
      experienceLevels: [],
    };

    const before = sourceQueryPlanFingerprint(base);
    const afterKeywords = sourceQueryPlanFingerprint({
      ...base,
      keywords: ['Gıda Mühendisi', 'denetçi'],
    });
    const afterCities = sourceQueryPlanFingerprint({
      ...base,
      subdivisionNames: ['İzmir', 'Manisa'],
    });

    expect(afterKeywords).not.toBe(before);
    expect(afterCities).not.toBe(before);
  });
});

describe('resolveScanKind', () => {
  it('separates first, periodic, and user-requested scans', () => {
    expect(resolveScanKind({ trigger: 'user', lastDiscoveredAt: null })).toBe(
      'first',
    );
    expect(
      resolveScanKind({ trigger: 'user', lastDiscoveredAt: '2026-09-01T00:00:00.000Z' }),
    ).toBe('user');
    expect(
      resolveScanKind({
        trigger: 'scheduled',
        lastDiscoveredAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toBe('periodic');
    expect(resolveScanKind({ trigger: 'scheduled', lastDiscoveredAt: null })).toBe(
      'first',
    );
  });
});
