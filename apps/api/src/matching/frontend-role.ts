import { normalizeText } from '../common/normalize-text.js';
import { phraseAppearsIn } from './match-text.js';
import type { KeywordMatchKind, MatchableJob } from './matching.types.js';
import {
  classifyJobRoleFamily,
  isRoleCompatibleWithTechnologies,
  type TechnologyFamily,
} from './search-terms.js';

/**
 * Role title scoring:
 *   direct  +50
 *   alias   +40
 *   related +20
 */
export const ROLE_MATCH_SCORE: Record<KeywordMatchKind, number> = {
  direct: 50,
  alias: 40,
  related: 20,
};

const SOFTWARE_ROLE_TOKENS = new Set([
  'developer',
  'engineer',
  'specialist',
  'gelistirici',
  'uzmani',
  'programmer',
  'muhendis',
  'muhendisi',
]);

/**
 * Classifies how role keywords match a listing title (description is a weaker fallback).
 */
export function classifyRoleMatch(
  job: MatchableJob,
  roleKeywords: readonly string[],
  technologyTerms: readonly string[],
): KeywordMatchKind | null {
  if (roleKeywords.length === 0) {
    return null;
  }

  const title = job.title;
  const normalizedTitle = normalizeText(title);
  const direct = roleKeywords.some((keyword) => {
    const needle = normalizeText(keyword);
    return needle.length > 0 && normalizedTitle.includes(needle);
  });
  if (direct) {
    return 'direct';
  }

  const alias = roleKeywords.some((keyword) => phraseAppearsIn(title, keyword));
  if (alias) {
    return 'alias';
  }

  if (isTechnologyRelatedRole(title, technologyTerms)) {
    return 'related';
  }

  const description = job.description ?? '';
  if (description.length > 0) {
    const inDescription = roleKeywords.some((keyword) =>
      phraseAppearsIn(description, keyword),
    );
    if (inDescription) {
      return 'related';
    }
  }

  return null;
}

export function classifyTechnologyOnlyRole(
  title: string,
  families: readonly TechnologyFamily[],
  technologyTerms: readonly string[] = [],
): KeywordMatchKind | null {
  const jobRole = classifyJobRoleFamily(title);

  if (isReactNativeAdjacent(title, families, technologyTerms)) {
    return 'related';
  }

  const compatibility = isRoleCompatibleWithTechnologies(jobRole, families);

  if (compatibility === 'compatible') {
    if (jobRole === 'frontend') {
      return 'direct';
    }

    if (jobRole === 'fullstack' || jobRole === 'mobile') {
      return 'alias';
    }

    return 'alias';
  }

  if (compatibility === 'generic') {
    return 'alias';
  }

  return null;
}

export function roleMatchScore(kind: KeywordMatchKind | null): number {
  if (!kind) {
    return 0;
  }

  return ROLE_MATCH_SCORE[kind];
}

function isReactNativeAdjacent(
  title: string,
  families: readonly TechnologyFamily[],
  technologyTerms: readonly string[],
): boolean {
  const wantsFrontendOrMobile =
    families.includes('frontend') || families.includes('mobile');
  if (!wantsFrontendOrMobile) {
    return false;
  }

  const wantsReact = technologyTerms.some((term) => {
    const normalized = normalizeText(term);
    return normalized === 'react' || normalized.startsWith('react ');
  });
  if (!wantsReact) {
    return false;
  }

  const normalizedTitle = normalizeText(title);
  return (
    padded(normalizedTitle).includes(padded('react native')) ||
    (padded(normalizedTitle).includes(padded('react')) &&
      (padded(normalizedTitle).includes(padded('mobile')) ||
        padded(normalizedTitle).includes(padded('native'))))
  );
}

function isTechnologyRelatedRole(
  title: string,
  technologyTerms: readonly string[],
): boolean {
  if (technologyTerms.length === 0) {
    return false;
  }

  const titleTokens = new Set(normalizeText(title).split(' ').filter(Boolean));
  if (titleTokens.size === 0) {
    return false;
  }

  const hasRoleToken = [...SOFTWARE_ROLE_TOKENS].some((token) => titleTokens.has(token));
  if (!hasRoleToken) {
    return false;
  }

  return technologyTerms.some((technology) => {
    const token = normalizeText(technology);
    return token.length > 0 && token.split(' ').every((part) => titleTokens.has(part));
  });
}

function padded(value: string): string {
  return ` ${value} `;
}
