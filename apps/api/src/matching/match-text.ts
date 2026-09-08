import { normalizeForSearch, normalizeText } from '../common/normalize-text.js';
import {
  tokenizeNormalized,
  tokensCoverQuery,
} from './fuzzy-text.js';
import { ROLE_ALIAS_PAIRS } from './role-aliases.js';
import type { MatchableJob } from './matching.types.js';

export type QueryMatchKind = 'phrase' | 'tokens' | 'fuzzy' | 'alias' | null;

export function jobSearchableText(job: MatchableJob): string {
  return [
    job.title,
    job.companyName,
    job.description ?? '',
    job.location ?? '',
    ...job.technologies,
  ].join(' ');
}

export function expandNormalizedPhrases(value: string): string[] {
  const start = normalizeText(value);
  if (start.length === 0) {
    return [];
  }

  const variants = new Set<string>([start]);
  const pairs = normalizedAliasPairs();
  let grew = true;

  while (grew) {
    grew = false;
    const snapshot = Array.from(variants);
    for (const current of snapshot) {
      for (const [left, right] of pairs) {
        const swappedLeft = replacePhrase(current, left, right);
        const swappedRight = replacePhrase(current, right, left);
        if (swappedLeft && !variants.has(swappedLeft)) {
          variants.add(swappedLeft);
          grew = true;
        }

        if (swappedRight && !variants.has(swappedRight)) {
          variants.add(swappedRight);
          grew = true;
        }
      }
    }
  }

  return [...variants];
}

export function phraseAppearsIn(haystack: string, needle: string): boolean {
  const haystacks = expandNormalizedPhrases(haystack);
  const needles = expandNormalizedPhrases(needle);

  return needles.some((variant) =>
    haystacks.some((text) => text.includes(variant)),
  );
}

export function queryAppearsIn(haystack: string, query: string): boolean {
  return queryMatchKind(haystack, query) !== null;
}

export function queryMatchKind(haystack: string, query: string): QueryMatchKind {
  const hay = normalizeForSearch(haystack);
  const needle = normalizeForSearch(query);
  if (!needle) {
    return null;
  }

  if (hay.includes(needle)) {
    const needleTokens = tokenizeNormalized(needle);
    if (needleTokens.length > 1 || needle.length >= 4) {
      return 'phrase';
    }

    if (tokenizeNormalized(hay).includes(needle)) {
      return 'phrase';
    }
  }

  const hayTokens = tokenizeNormalized(hay);
  const needleTokens = tokenizeNormalized(needle);
  const tokenKind = tokensCoverQuery(hayTokens, needleTokens);
  if (tokenKind === 'fuzzy') {
    return 'fuzzy';
  }
  if (tokenKind === 'exact' || tokenKind === 'stem') {
    return 'tokens';
  }

  if (needleTokens.length > 1 || needle.length >= 4) {
    return phraseAppearsIn(haystack, query) ? 'alias' : null;
  }

  return null;
}

/** Word-boundary match on normalized text so "java" does not hit "javascript". */
export function normalizedPhraseAppears(
  haystack: string,
  needle: string,
): boolean {
  const hay = normalizeText(haystack);
  const need = normalizeText(needle);
  if (!hay || !need) {
    return false;
  }

  return ` ${hay} `.includes(` ${need} `);
}

function normalizedAliasPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  const seen = new Set<string>();

  for (const [left, right] of ROLE_ALIAS_PAIRS) {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    if (!normalizedLeft || !normalizedRight || normalizedLeft === normalizedRight) {
      continue;
    }

    const key =
      normalizedLeft < normalizedRight
        ? `${normalizedLeft}|${normalizedRight}`
        : `${normalizedRight}|${normalizedLeft}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pairs.push([normalizedLeft, normalizedRight]);
  }

  return pairs.sort((left, right) => right[0].length - left[0].length);
}

function replacePhrase(
  text: string,
  from: string,
  to: string,
): string | null {
  if (!from || !text.includes(from)) {
    return null;
  }

  return text.split(from).join(to);
}
