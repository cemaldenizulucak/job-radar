import { normalizeForSearch, normalizeText } from '../common/normalize-text.js';

describe('normalizeText', () => {
  it('folds Turkish letters and punctuation for storage keys', () => {
    expect(normalizeText('İstanbul(Asya)')).toBe('istanbul asya');
    expect(normalizeText('Front-End Geliştirici')).toBe('front end gelistirici');
  });

  it('treats hyphens and extra whitespace as spaces', () => {
    expect(normalizeText('  front-end   developer  ')).toBe('front end developer');
  });
});

describe('normalizeForSearch', () => {
  it('folds GIDA / gıda / mühendis / İstanbul for comparison only', () => {
    expect(normalizeForSearch('GIDA')).toBe('gida');
    expect(normalizeForSearch('gıda')).toBe('gida');
    expect(normalizeForSearch('MÜHENDİS')).toBe('muhendis');
    expect(normalizeForSearch('mühendis')).toBe('muhendis');
    expect(normalizeForSearch('İstanbul')).toBe('istanbul');
    expect(normalizeForSearch('istanbul')).toBe('istanbul');
  });

  it('collapses hyphens so frontend matches Front-End', () => {
    expect(normalizeForSearch('Front-End')).toBe('frontend');
    expect(normalizeForSearch('frontend')).toBe('frontend');
    expect(normalizeForSearch('Senior Front-End Engineer')).toBe(
      'senior frontend engineer',
    );
  });

  it('does not change the original display string', () => {
    const original = 'Gıda Mühendisi';
    normalizeForSearch(original);
    expect(original).toBe('Gıda Mühendisi');
  });
});
