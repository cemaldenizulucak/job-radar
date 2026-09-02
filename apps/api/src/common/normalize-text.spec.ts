import { normalizeText } from '../common/normalize-text.js';

describe('normalizeText', () => {
  it('folds Turkish letters and punctuation for matching', () => {
    expect(normalizeText('İstanbul(Asya)')).toBe('istanbul asya');
    expect(normalizeText('Front-End Geliştirici')).toBe('front end gelistirici');
  });

  it('treats hyphens and extra whitespace as spaces', () => {
    expect(normalizeText('  front-end   developer  ')).toBe('front end developer');
  });
});
