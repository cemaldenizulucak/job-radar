import { normalizeForSearch } from '../common/normalize-text.js';
import { tokenizeNormalized } from './fuzzy-text.js';

const PHRASE_END_TOKENS = new Set([
  'muhendis',
  'muhendisi',
  'muhendisligi',
  'engineer',
  'developer',
  'gelistirici',
  'uzman',
  'uzmani',
  'specialist',
  'sorumlu',
  'sorumlusu',
]);

/**
 * Splits a keyword blob into profession-sized phrases.
 * Comma-separated alternatives are handled by the caller.
 * "Gıda mühendisi Kalite güvence" → ["gıda mühendisi", "kalite güvence"].
 * Does not split a phrase into generic tokens ("gıda VEYA mühendis").
 */
export function splitProfessionPhrases(raw: string): string[] {
  const tokens = tokenizeNormalized(normalizeForSearch(raw));
  if (tokens.length === 0) {
    return [];
  }

  const phrases: string[] = [];
  let current: string[] = [];

  for (const token of tokens) {
    current.push(token);
    if (PHRASE_END_TOKENS.has(token)) {
      phrases.push(current.join(' '));
      current = [];
    }
  }

  if (current.length > 0) {
    phrases.push(current.join(' '));
  }

  return phrases;
}
