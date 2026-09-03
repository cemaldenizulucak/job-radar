import {
  normalizedPhraseAppears,
  phraseAppearsIn,
  queryAppearsIn,
} from './match-text.js';

describe('queryAppearsIn', () => {
  it('matches Turkish case and diacritics as substrings', () => {
    expect(queryAppearsIn('Gıda Mühendisi', 'gıda')).toBe(true);
    expect(queryAppearsIn('Gıda Mühendisi', 'GIDA')).toBe(true);
    expect(queryAppearsIn('Gıda Mühendisi', 'mühendis')).toBe(true);
    expect(queryAppearsIn('İstanbul(Asya)', 'istanbul')).toBe(true);
  });

  it('collapses hyphens so frontend matches Front-End', () => {
    expect(queryAppearsIn('Senior Front-End Engineer', 'frontend')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(queryAppearsIn('Satış Temsilcisi', 'muhasebe')).toBe(false);
  });
});

describe('phraseAppearsIn', () => {
  it('equates English and Turkish frontend role titles', () => {
    const needle = 'frontend developer';

    expect(phraseAppearsIn('Front-End Geliştirici', needle)).toBe(true);
    expect(phraseAppearsIn('front-end developer', needle)).toBe(true);
    expect(phraseAppearsIn('front end developer', needle)).toBe(true);
    expect(phraseAppearsIn('Arayüz Geliştirici', needle)).toBe(true);
    expect(phraseAppearsIn('Arayüz Yazılım Uzmanı', needle)).toBe(true);
    expect(phraseAppearsIn('UI Developer', needle)).toBe(true);
    expect(phraseAppearsIn('UI Engineer', needle)).toBe(true);
    expect(phraseAppearsIn('Senior Frontend Engineer (React)', needle)).toBe(
      true,
    );
    expect(phraseAppearsIn('frontend specialist', needle)).toBe(true);
  });

  it('equates frontend with hyphen, space, and arayüz spellings', () => {
    expect(phraseAppearsIn('front-end', 'frontend')).toBe(true);
    expect(phraseAppearsIn('front end', 'frontend')).toBe(true);
    expect(phraseAppearsIn('Arayüz', 'frontend')).toBe(true);
  });

  it('does not treat Java Yazılım Uzmanı as a frontend developer role', () => {
    expect(
      phraseAppearsIn('Java Yazılım Uzmanı', 'frontend developer'),
    ).toBe(false);
  });

  it('does not treat Full-Stack Java Developer as a frontend developer role', () => {
    expect(
      phraseAppearsIn('Full-Stack Java Developer', 'frontend developer'),
    ).toBe(false);
  });

  it('does not treat java as a match inside javascript', () => {
    expect(normalizedPhraseAppears('javascript developer', 'java')).toBe(false);
    expect(normalizedPhraseAppears('Java Developer', 'java')).toBe(true);
    expect(
      normalizedPhraseAppears('Angular 17, RxJS, TypeScript', 'angular'),
    ).toBe(true);
  });
});
