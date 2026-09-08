import { splitProfessionPhrases } from './search-phrases.js';

describe('splitProfessionPhrases', () => {
  it('keeps gıda mühendisi together and treats kalite güvence as another alternative', () => {
    expect(splitProfessionPhrases('Gıda mühendisi Kalite güvence')).toEqual([
      'gida muhendisi',
      'kalite guvence',
    ]);
  });

  it('does not turn a profession phrase into gıda OR mühendis', () => {
    expect(splitProfessionPhrases('Gıda mühendisi')).toEqual(['gida muhendisi']);
  });

  it('keeps React Developer and Angular Developer as separate alternatives', () => {
    expect(splitProfessionPhrases('React Developer Angular Developer')).toEqual([
      'react developer',
      'angular developer',
    ]);
  });
});
