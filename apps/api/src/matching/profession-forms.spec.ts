import { describe, expect, it } from 'vitest';

import {
  expandKeywordsForSourceQuery,
  locateProfessionFieldSpan,
  professionFieldAppearsIn,
  titleHasCompetingEngineeringDiscipline,
  toProfessionFieldQueryVariant,
} from './profession-forms.js';

describe('profession field equivalence', () => {
  it('equates gıda mühendisi with gıda mühendisliği inflections', () => {
    expect(
      professionFieldAppearsIn(
        'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
        'Gıda Mühendisi',
      ),
    ).toBe(true);
    expect(
      professionFieldAppearsIn(
        'Gıda mühendisliğinden mezun adaylar',
        'gıda mühendisi',
      ),
    ).toBe(true);
    expect(
      professionFieldAppearsIn('Gıda mühendisleri aranır', 'Gıda Mühendisi'),
    ).toBe(true);
    expect(
      professionFieldAppearsIn('GIDA MÜHENDİSLİĞİ mezunu', 'gıda mühendisi'),
    ).toBe(true);
  });

  it('does not split the profession into gıda OR mühendis', () => {
    expect(
      professionFieldAppearsIn(
        'Gıda sektöründe çalışacak makine mühendisi',
        'Gıda Mühendisi',
      ),
    ).toBe(false);
  });

  it('does not treat a technician title as food engineering', () => {
    expect(
      professionFieldAppearsIn('Gıda Teknikeri', 'Gıda Mühendisi'),
    ).toBe(false);
  });

  it('locates the original field phrase for evidence', () => {
    const haystack =
      'Üniversitelerin Gıda Mühendisliği bölümünden mezun';
    const span = locateProfessionFieldSpan(haystack, 'Gıda Mühendisi');
    expect(span?.text).toBe('Gıda Mühendisliği');
    expect(span?.educationField).toBe(true);
    expect(haystack.slice(span?.start ?? 0, (span?.start ?? 0) + (span?.length ?? 0))).toBe(
      'Gıda Mühendisliği',
    );
  });

  it('adds a single field-form variant for source queries', () => {
    expect(toProfessionFieldQueryVariant('Gıda Mühendisi')).toBe(
      'Gıda Mühendisliği',
    );
    expect(
      expandKeywordsForSourceQuery([
        'Gıda Mühendisi',
        'Kalite güvence',
        'denetçi',
      ]),
    ).toEqual([
      'Gıda Mühendisi',
      'Gıda Mühendisliği',
      'Kalite güvence',
      'denetçi',
    ]);
  });

  it('treats makine vs gıda titles as competing disciplines', () => {
    expect(
      titleHasCompetingEngineeringDiscipline(
        'Makine Mühendisi',
        'gıda mühendisi',
      ),
    ).toBe(true);
    expect(
      titleHasCompetingEngineeringDiscipline(
        'Kalite Mühendisi',
        'gıda mühendisi',
      ),
    ).toBe(false);
  });
});
