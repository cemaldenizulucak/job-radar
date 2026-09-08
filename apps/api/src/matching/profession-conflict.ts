import { normalizeForSearch } from '../common/normalize-text.js';
import { tokenizeNormalized } from './fuzzy-text.js';
import {
  ENGINEERING_DISCIPLINES,
  exclusiveDisciplineInTitle,
  parseEngineeringProfession,
  titleHasCompetingEngineeringDiscipline,
} from './profession-forms.js';
import { isRoleSearchTerm } from './search-term-kind.js';

/**
 * Discipline prefixes that do not substitute for one another when they
 * appear in a job title with a generic role (mühendis, uzman, …).
 * This is not a company denylist.
 */
const EXCLUSIVE_TITLE_QUALIFIERS = ENGINEERING_DISCIPLINES;

const SOFTWARE_TITLE_TOKENS = [
  'yazilim',
  'software',
  'frontend',
  'backend',
  'fullstack',
  'developer',
  'gelistirici',
  'programmer',
  'qa',
  'sdet',
  'javascript',
  'typescript',
  'react',
  'angular',
] as const;

export function titleLooksLikeSoftware(title: string): boolean {
  const normalized = normalizeForSearch(title);
  if (!normalized) {
    return false;
  }

  const padded = ` ${normalized} `;
  return SOFTWARE_TITLE_TOKENS.some((token) => padded.includes(` ${token} `));
}

export function titleBlocksDescriptionKeywordMatch(
  title: string,
  terms: readonly string[],
): boolean {
  if (terms.some((term) => titleHasCompetingEngineeringDiscipline(title, term))) {
    return true;
  }

  const hasExclusiveQualifier = Boolean(exclusiveDisciplineInTitle(title));
  if (hasExclusiveQualifier && terms.some((term) => !parseEngineeringProfession(term))) {
    return (
      searchLooksLikePhysicalDiscipline(terms) ||
      terms.some((term) => isRoleSearchTerm(term) && !parseEngineeringProfession(term))
    );
  }

  return titleLooksLikeSoftware(title) && searchLooksLikePhysicalDiscipline(terms);
}

/**
 * Competing engineering titles (Makine vs Gıda) still block description
 * matches. Kalite Mühendisi is not a competing discipline, so an explicit
 * Gıda Mühendisliği graduation requirement may match.
 */
export function shouldBlockDescriptionKeyword(
  title: string,
  term: string,
): boolean {
  if (titleHasCompetingEngineeringDiscipline(title, term)) {
    return true;
  }

  if (titleLooksLikeSoftware(title) && searchLooksLikePhysicalDiscipline([term])) {
    return true;
  }

  if (!isRoleSearchTerm(term) && !searchLooksLikePhysicalDiscipline([term])) {
    return false;
  }

  const titleDiscipline = exclusiveDisciplineInTitle(title);
  if (
    titleDiscipline &&
    searchLooksLikePhysicalDiscipline([term]) &&
    !parseEngineeringProfession(term)
  ) {
    return true;
  }

  return false;
}

function searchLooksLikePhysicalDiscipline(terms: readonly string[]): boolean {
  const blob = normalizeForSearch(terms.join(' '));
  if (!blob) {
    return false;
  }

  const tokens = tokenizeNormalized(blob);
  if (tokens.some((token) => EXCLUSIVE_TITLE_QUALIFIERS.has(token))) {
    return true;
  }

  return blob.includes('kalite guvence');
}
