import { describe, expect, it } from 'vitest';

import {
  formatJobListingDate,
  formatTurkishJobDate,
  formatTurkishJobDateFromIso,
} from './job-dates';

const now = new Date(2026, 8, 2, 15, 30, 0);

describe('formatTurkishJobDate', () => {
  it('formats today with time', () => {
    expect(formatTurkishJobDate(new Date(2026, 8, 2, 14, 30, 0), now)).toBe(
      'Bugün 14:30',
    );
  });

  it('formats yesterday with time', () => {
    expect(formatTurkishJobDate(new Date(2026, 8, 1, 9, 15, 0), now)).toBe(
      'Dün 09:15',
    );
  });

  it('formats dates within 7 days relatively', () => {
    expect(formatTurkishJobDate(new Date(2026, 7, 30, 11, 0, 0), now)).toBe(
      '3 gün önce',
    );
    expect(formatTurkishJobDate(new Date(2026, 7, 26, 8, 0, 0), now)).toBe(
      '7 gün önce',
    );
  });

  it('formats older dates as an absolute Turkish date', () => {
    expect(formatTurkishJobDate(new Date(2026, 7, 24, 10, 0, 0), now)).toBe(
      '24 Ağu 2026',
    );
  });
});

describe('formatJobListingDate', () => {
  it('uses publishedAt when it is valid', () => {
    const published = new Date(2026, 8, 2, 14, 30, 0);
    expect(
      formatJobListingDate(
        published.toISOString(),
        new Date(2026, 7, 20, 10, 0, 0).toISOString(),
        now,
      ),
    ).toBe(formatTurkishJobDate(published, now));
  });

  it('falls back to discovered date without inventing a published date', () => {
    expect(
      formatJobListingDate(null, new Date(2026, 7, 24, 10, 0, 0).toISOString(), now),
    ).toBe('Bulundu: 24 Ağu 2026');
    expect(formatTurkishJobDateFromIso(null, now)).toBeNull();
    expect(formatTurkishJobDateFromIso('not-a-date', now)).toBeNull();
  });
});
