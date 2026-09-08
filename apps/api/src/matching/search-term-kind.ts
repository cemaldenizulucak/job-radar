import { normalizeForSearch } from '../common/normalize-text.js';
import { tokenizeNormalized } from './fuzzy-text.js';
import { PHRASE_END_TOKENS } from './search-phrases.js';

const ROLE_LABELS = new Set([
  'frontend',
  'backend',
  'fullstack',
  'arayuz',
]);

const ROLE_LABEL_PHRASES = new Set([
  'front end',
  'back end',
  'full stack',
]);

/**
 * Role phrases name the job itself (Frontend, Frontend Developer, mühendis).
 * Skill tokens such as UI or JavaScript are not role labels.
 * Do not treat generic "developer" as a frontend alias.
 */
export function isRoleSearchTerm(term: string): boolean {
  const normalized = normalizeForSearch(term);
  if (!normalized) {
    return false;
  }

  if (ROLE_LABEL_PHRASES.has(normalized) || ROLE_LABELS.has(normalized)) {
    return true;
  }

  const tokens = tokenizeNormalized(normalized);
  if (tokens.some((token) => PHRASE_END_TOKENS.has(token))) {
    return true;
  }

  return tokens.length === 1 && ROLE_LABELS.has(tokens[0] ?? '');
}
