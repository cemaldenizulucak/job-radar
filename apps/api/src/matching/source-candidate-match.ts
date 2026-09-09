import { normalizeForSearch } from '../common/normalize-text.js';
import { isTemporaryDetailFailure } from '../sources/detail-fetch.types.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { MATCH_STATUS, type MatchStatus } from './match-status.js';
import type { MatchableJob, MatchDecision } from './matching.types.js';
import { toProfessionFieldQueryVariant } from './profession-forms.js';
import { shouldBlockDescriptionKeyword } from './profession-conflict.js';
import { collectKeywordPhrases } from './search-phrases.js';

export type SearchScopedProvenance = {
  savedSearchId: string;
  keyword: string;
  origin: 'user' | 'profession_variant';
  location: string | null;
};

export type UnverifiedSourceCandidateInput = {
  job: MatchableJob;
  search: SavedSearch;
  decision: MatchDecision;
  provenances: readonly SearchScopedProvenance[];
  detailErrorCategory: string | null;
};

export function listingCameFromControlledSourceQuery(
  provenances: readonly SearchScopedProvenance[],
  search: SavedSearch,
): boolean {
  const allowed = controlledSourceQueryKeys(search);
  if (allowed.size === 0) {
    return false;
  }

  return provenances.some((item) => {
    if (item.savedSearchId && item.savedSearchId !== search.id) {
      return false;
    }

    if (item.origin !== 'user' && item.origin !== 'profession_variant') {
      return false;
    }

    return allowed.has(normalizeForSearch(item.keyword));
  });
}

export function shouldCreateUnverifiedSourceCandidate(
  input: UnverifiedSourceCandidateInput,
): boolean {
  if (input.job.description?.trim()) {
    return false;
  }

  if (input.decision.matched) {
    return false;
  }

  if (input.decision.location === 'fail') {
    return false;
  }

  if (!isTemporaryDetailFailure(input.detailErrorCategory)) {
    return false;
  }

  if (!listingCameFromControlledSourceQuery(input.provenances, input.search)) {
    return false;
  }

  const certainty = titleCertaintyForSourceCandidate(
    input.decision,
    input.job,
    input.search,
  );
  if (certainty === 'definite_fail' || certainty === 'blocked_other') {
    return false;
  }

  if (certainty === 'definite_pass') {
    return false;
  }

  return true;
}

function titleCertaintyForSourceCandidate(
  decision: MatchDecision,
  job: Pick<MatchableJob, 'title'>,
  search: SavedSearch,
): 'definite_pass' | 'definite_fail' | 'inconclusive' | 'blocked_other' {
  if (decision.location === 'fail' || decision.experience === 'fail') {
    return 'blocked_other';
  }

  if (decision.keyword === 'pass') {
    return 'definite_pass';
  }

  const phrases = collectKeywordPhrases(search.keywords).map((item) => item.phrase);
  if (phrases.some((phrase) => shouldBlockDescriptionKeyword(job.title, phrase))) {
    return 'definite_fail';
  }

  return 'inconclusive';
}

export function collectUnverifiedSourceCandidates(input: {
  jobs: readonly MatchableJob[];
  searches: readonly SavedSearch[];
  provenances: ReadonlyMap<string, readonly SearchScopedProvenance[]>;
  detailErrorByJobId: ReadonlyMap<string, string | null>;
  evaluateMatch: (job: MatchableJob, search: SavedSearch) => MatchDecision;
  verifiedKeys?: ReadonlySet<string>;
}): { jobId: string; savedSearchId: string; matchStatus: MatchStatus }[] {
  const candidates: {
    jobId: string;
    savedSearchId: string;
    matchStatus: MatchStatus;
  }[] = [];

  for (const job of input.jobs) {
    const provenances = input.provenances.get(job.id) ?? [];
    const detailErrorCategory = input.detailErrorByJobId.get(job.id) ?? null;

    for (const search of input.searches) {
      if (!search.isActive) {
        continue;
      }

      const key = `${job.id}:${search.id}`;
      if (input.verifiedKeys?.has(key)) {
        continue;
      }

      const decision = input.evaluateMatch(job, search);
      if (
        !shouldCreateUnverifiedSourceCandidate({
          job,
          search,
          decision,
          provenances,
          detailErrorCategory,
        })
      ) {
        continue;
      }

      candidates.push({
        jobId: job.id,
        savedSearchId: search.id,
        matchStatus: MATCH_STATUS.unverifiedSourceCandidate,
      });
    }
  }

  return candidates;
}

function controlledSourceQueryKeys(search: SavedSearch): Set<string> {
  const keys = new Set<string>();
  for (const item of collectKeywordPhrases(search.keywords)) {
    keys.add(normalizeForSearch(item.phrase));
    const variant = toProfessionFieldQueryVariant(item.phrase);
    if (variant) {
      keys.add(normalizeForSearch(variant));
    }
  }

  return keys;
}
