import {
  searchLooksLikeSoftware,
  titleLooksUnrelatedToSoftware,
} from './unrelated-profession.js';

describe('unrelated profession guards', () => {
  it('treats frontend and QA keywords as a software-oriented search', () => {
    expect(
      searchLooksLikeSoftware([
        'Frontend Developer',
        'Angular Developer',
        'QA / Test Uzmanı',
      ]),
    ).toBe(true);
    expect(searchLooksLikeSoftware(['gıda mühendisi'])).toBe(false);
  });

  it('detects physician titles as unrelated to software', () => {
    expect(
      titleLooksUnrelatedToSoftware('Aile Hekimliği Uzmanı Kat Hekimi'),
    ).toBe(true);
    expect(titleLooksUnrelatedToSoftware('Frontend Developer')).toBe(false);
  });
});
