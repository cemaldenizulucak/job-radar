import { normalizeForSearch } from '../common/normalize-text.js';
import { tokenizeNormalized } from './fuzzy-text.js';

/**
 * Discipline prefixes that do not substitute for one another when they
 * appear in a job title with a generic role (mühendis, uzman, …).
 * This is not a company denylist.
 */
const EXCLUSIVE_TITLE_QUALIFIERS = new Set([
  'gida',
  'makine',
  'mekanik',
  'elektrik',
  'elektronik',
  'insaat',
  'kimya',
  'cevre',
  'endustri',
  'metalurji',
  'maden',
  'petrol',
  'ziraat',
  'orman',
  'harita',
  'jeoloji',
  'jeofizik',
  'tekstil',
  'gemi',
  'havacilik',
  'otomotiv',
  'mekatronik',
]);

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
  const titleTokens = tokenizeNormalized(normalizeForSearch(title));
  const hasExclusiveQualifier = titleTokens.some((token) =>
    EXCLUSIVE_TITLE_QUALIFIERS.has(token),
  );

  if (hasExclusiveQualifier) {
    return true;
  }

  return titleLooksLikeSoftware(title) && searchLooksLikePhysicalDiscipline(terms);
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
