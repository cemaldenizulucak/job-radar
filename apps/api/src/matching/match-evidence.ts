import { expandNormalizedPhrases, queryAppearsIn } from './match-text.js';
import { shouldBlockDescriptionKeyword } from './profession-conflict.js';
import { collectKeywordPhrases } from './search-phrases.js';
import { isRoleSearchTerm } from './search-term-kind.js';
import type {
  MatchEvidence,
  MatchEvidenceField,
  MatchKind,
  MatchableJob,
} from './matching.types.js';
import type { SavedSearch } from '../searches/searches.types.js';

const SNIPPET_RADIUS = 52;

export function collectKeywordEvidence(
  job: MatchableJob,
  search: SavedSearch,
): MatchEvidence[] {
  const phrases = collectKeywordPhrases(search.keywords);
  const hits: MatchEvidence[] = [];
  const seen = new Set<string>();

  for (const { term, phrase } of phrases) {
    const titleHit = evidenceInField(job.title, term, phrase, 'title');
    if (titleHit) {
      pushUnique(hits, seen, titleHit);
      continue;
    }

    const technologyHit = evidenceInTechnologies(job.technologies, term, phrase);
    if (technologyHit) {
      pushUnique(hits, seen, technologyHit);
      continue;
    }

    if (!job.description) {
      continue;
    }

    if (shouldBlockDescriptionKeyword(job.title, phrase)) {
      continue;
    }

    const descriptionHit = evidenceInField(
      job.description,
      term,
      phrase,
      'description',
    );
    if (descriptionHit) {
      pushUnique(hits, seen, descriptionHit);
    }
  }

  return hits;
}

export function overallMatchKind(
  evidence: readonly MatchEvidence[],
): MatchKind | null {
  if (evidence.length === 0) {
    return null;
  }

  if (
    evidence.some(
      (item) => item.field === 'title' && isRoleSearchTerm(item.term),
    )
  ) {
    return 'direct';
  }

  return 'skill';
}

function evidenceInTechnologies(
  technologies: readonly string[],
  term: string,
  phrase: string,
): MatchEvidence | null {
  for (const technology of technologies) {
    const hit = evidenceInField(technology, term, phrase, 'technologies');
    if (hit) {
      return hit;
    }
  }

  return null;
}

function evidenceInField(
  haystack: string,
  term: string,
  phrase: string,
  field: MatchEvidenceField,
): MatchEvidence | null {
  if (!haystack.trim() || !queryAppearsIn(haystack, phrase)) {
    return null;
  }

  const span = locateEvidenceSpan(haystack, phrase);
  return {
    term,
    matchedText: span?.text ?? term,
    field,
    snippet: span ? snippetAround(haystack, span.start, span.length) : null,
    kind: field === 'title' && isRoleSearchTerm(term) ? 'title' : 'skill',
  };
}

function locateEvidenceSpan(
  haystack: string,
  query: string,
): { start: number; length: number; text: string } | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const short = trimmed.length <= 3;
  const direct = short
    ? indexOfBounded(haystack, trimmed)
    : indexOfIgnoreCase(haystack, trimmed);
  if (direct >= 0) {
    const length = boundedMatchLength(haystack, direct, trimmed);
    return {
      start: direct,
      length,
      text: haystack.slice(direct, direct + length),
    };
  }

  const flexible = escapeRegex(trimmed).replace(/[\s\-_\/]+/g, '[\\s\\-_/]*');
  const flexMatch = new RegExp(flexible, 'iu').exec(haystack);
  if (flexMatch) {
    return {
      start: flexMatch.index,
      length: flexMatch[0].length,
      text: flexMatch[0],
    };
  }

  for (const variant of expandNormalizedPhrases(trimmed)) {
    const found = indexOfIgnoreCase(haystack, variant);
    if (found >= 0) {
      return {
        start: found,
        length: variant.length,
        text: haystack.slice(found, found + variant.length),
      };
    }
  }

  return null;
}

function indexOfIgnoreCase(haystack: string, needle: string): number {
  return haystack.toLocaleLowerCase('tr-TR').indexOf(needle.toLocaleLowerCase('tr-TR'));
}

function indexOfBounded(haystack: string, needle: string): number {
  const pattern = new RegExp(
    `(?<!\\p{L})${escapeRegex(needle)}(?!\\p{L})`,
    'iu',
  );
  const match = pattern.exec(haystack);
  return match ? match.index : -1;
}

function boundedMatchLength(
  haystack: string,
  start: number,
  needle: string,
): number {
  const rest = haystack.slice(start);
  const compound = new RegExp(
    `^${escapeRegex(needle)}(?:\\s*[\\/_-]\\s*[\\p{L}\\p{N}]{1,12})?`,
    'iu',
  ).exec(rest);
  return compound?.[0].length ?? needle.length;
}

function snippetAround(haystack: string, start: number, length: number): string {
  const from = Math.max(0, start - SNIPPET_RADIUS);
  const to = Math.min(haystack.length, start + length + SNIPPET_RADIUS);
  const slice = haystack.slice(from, to).replace(/\s+/g, ' ').trim();
  const prefix = from > 0 ? '…' : '';
  const suffix = to < haystack.length ? '…' : '';
  return `${prefix}${slice}${suffix}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pushUnique(
  hits: MatchEvidence[],
  seen: Set<string>,
  item: MatchEvidence,
): void {
  const key = `${item.term}|${item.field}|${item.matchedText}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  hits.push(item);
}
