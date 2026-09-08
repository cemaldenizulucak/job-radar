import { normalizeForSearch } from '../common/normalize-text.js';

const SOFTWARE_SEARCH_TOKENS = [
  'frontend',
  'front end',
  'react',
  'angular',
  'software',
  'yazilim',
  'developer',
  'gelistirici',
  'engineer',
  'qa',
  'test uzman',
  'quality assurance',
] as const;

const UNRELATED_TITLE_TOKENS = [
  'hekim',
  'doktor',
  'hemsire',
  'eczaci',
  'dis hekimi',
  'aile hekimligi',
  'avukat',
  'ogretmen',
  'ogretim gorevlisi',
] as const;

export function searchLooksLikeSoftware(terms: readonly string[]): boolean {
  const blob = normalizeForSearch(terms.join(' '));
  if (!blob) {
    return false;
  }

  return SOFTWARE_SEARCH_TOKENS.some((token) => blob.includes(token));
}

export function titleLooksUnrelatedToSoftware(title: string): boolean {
  const normalized = normalizeForSearch(title);
  if (!normalized) {
    return false;
  }

  return UNRELATED_TITLE_TOKENS.some((token) => normalized.includes(token));
}
