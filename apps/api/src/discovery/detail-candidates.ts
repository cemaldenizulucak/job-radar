import { sourceListingIdentity } from '../jobs/job-identity.js';
import type { JobDetailFetchState, NormalizedJob } from '../jobs/jobs.types.js';
import type { MatchableJob, MatchDecision } from '../matching/matching.types.js';
import { shouldBlockDescriptionKeyword } from '../matching/profession-conflict.js';
import { collectKeywordPhrases } from '../matching/search-phrases.js';
import type { SavedSearch } from '../searches/searches.types.js';
import type { SourceJobRaw } from '../sources/job-source.adapter.js';
import {
  provenanceQueryKey,
  type SourceQueryProvenance,
} from './source-job-provenance.js';

export const DEFAULT_MAX_DETAIL_ATTEMPTS = 3;
export const DETAIL_RETRY_BACKOFF_MS = [
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

export type TitleKeywordCertainty =
  | 'definite_pass'
  | 'definite_fail'
  | 'inconclusive'
  | 'blocked_other';

export type DetailFetchState = JobDetailFetchState;

export type DetailCandidate = {
  identity: string;
  job: SourceJobRaw;
  provenances: readonly SourceQueryProvenance[];
  priority: number;
  priorityReason: DetailPriorityReason;
  queryKey: string;
};

export type DetailPriorityReason =
  | 'profession_variant'
  | 'user_query'
  | 'catalog_empty'
  | 'other';

export type DetailSkipReason =
  | 'has_description'
  | 'backoff'
  | 'definite_pass'
  | 'definite_fail'
  | 'blocked_other'
  | 'budget';

export type DetailSkipSample = {
  identity: string;
  title: string;
  reason: DetailSkipReason;
};

export type DetailSelectionReport = {
  selected: DetailCandidate[];
  ranked: DetailCandidate[];
  skipped: DetailSkipSample[];
  byPriority: Record<number, number>;
  backoffCount: number;
  skippedHasDescription: number;
};

export type EvaluateTitleMatch = (
  job: MatchableJob,
  search: SavedSearch,
) => MatchDecision;

/**
 * Ranking for description fetches. Query provenance is runtime-only and is
 * never match evidence. Being returned by a source query is not a match.
 */
export function classifyTitleKeywordCertainty(
  decision: MatchDecision,
  job: Pick<MatchableJob, 'title'>,
  search: SavedSearch,
): TitleKeywordCertainty {
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

export function hasUsableDescription(
  job: Pick<SourceJobRaw, 'description'>,
  catalog: DetailFetchState | undefined,
): boolean {
  return Boolean(job.description?.trim() || catalog?.description?.trim());
}

export function isDetailRetryEligible(
  state: DetailFetchState | undefined,
  nowMs: number,
  maxAttempts = DEFAULT_MAX_DETAIL_ATTEMPTS,
): boolean {
  const attempts = state?.detailFetchAttempts ?? 0;
  if (attempts <= 0) {
    return true;
  }

  if (attempts >= maxAttempts) {
    return false;
  }

  const attemptedAt = state?.detailFetchAttemptedAt
    ? Date.parse(state.detailFetchAttemptedAt)
    : Number.NaN;
  if (!Number.isFinite(attemptedAt)) {
    return true;
  }

  const wait =
    DETAIL_RETRY_BACKOFF_MS[
      Math.min(attempts, DETAIL_RETRY_BACKOFF_MS.length) - 1
    ] ?? DETAIL_RETRY_BACKOFF_MS[DETAIL_RETRY_BACKOFF_MS.length - 1];
  return nowMs - attemptedAt >= wait;
}

export function detailCandidatePriority(input: {
  certainty: TitleKeywordCertainty;
  provenances: readonly SourceQueryProvenance[];
  catalogEmpty: boolean;
}): number | null {
  if (input.certainty === 'blocked_other' || input.certainty === 'definite_fail') {
    return null;
  }

  if (input.certainty === 'definite_pass') {
    return null;
  }

  const fromProfessionVariant = input.provenances.some(
    (item) => item.origin === 'profession_variant',
  );
  if (fromProfessionVariant) {
    return 0;
  }

  const fromUserQuery = input.provenances.some((item) => item.origin === 'user');
  if (fromUserQuery) {
    return 1;
  }

  if (input.catalogEmpty) {
    return 2;
  }

  return 3;
}

export function selectDetailCandidates(input: {
  sourceId: NormalizedJob['sourceId'];
  search: SavedSearch;
  jobs: readonly SourceJobRaw[];
  provenances: ReadonlyMap<string, readonly SourceQueryProvenance[]>;
  catalog: ReadonlyMap<string, DetailFetchState>;
  evaluateMatch: EvaluateTitleMatch;
  maxDetails: number;
  nowMs?: number;
}): DetailSelectionReport {
  const nowMs = input.nowMs ?? Date.now();
  const ranked: DetailCandidate[] = [];
  const skipped: DetailSkipSample[] = [];
  let backoffCount = 0;
  let skippedHasDescription = 0;

  for (const job of input.jobs) {
    const identity = sourceListingIdentity(input.sourceId, job.sourceJobId);
    const catalog = input.catalog.get(identity);
    if (hasUsableDescription(job, catalog)) {
      skippedHasDescription += 1;
      skipped.push({ identity, title: clipTitle(job.title), reason: 'has_description' });
      continue;
    }

    if (!isDetailRetryEligible(catalog, nowMs)) {
      backoffCount += 1;
      skipped.push({ identity, title: clipTitle(job.title), reason: 'backoff' });
      continue;
    }

    const decision = input.evaluateMatch(
      toMatchablePreview(identity, input.sourceId, job, catalog),
      input.search,
    );
    const certainty = classifyTitleKeywordCertainty(decision, job, input.search);
    const provenances = input.provenances.get(identity) ?? [];
    const priority = detailCandidatePriority({
      certainty,
      provenances,
      catalogEmpty: catalog !== undefined && !catalog.description?.trim(),
    });
    if (priority === null) {
      skipped.push({
        identity,
        title: clipTitle(job.title),
        reason:
          certainty === 'definite_pass'
            ? 'definite_pass'
            : certainty === 'definite_fail'
              ? 'definite_fail'
              : 'blocked_other',
      });
      continue;
    }

    ranked.push({
      identity,
      job,
      provenances,
      priority,
      priorityReason: priorityReasonFrom(priority),
      queryKey: primaryQueryKey(provenances),
    });
  }

  ranked.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const leftAttempts = input.catalog.get(left.identity)?.detailFetchAttempts ?? 0;
    const rightAttempts = input.catalog.get(right.identity)?.detailFetchAttempts ?? 0;
    if (leftAttempts !== rightAttempts) {
      return leftAttempts - rightAttempts;
    }

    return stableHash(left.identity) - stableHash(right.identity);
  });

  const selected = takeRoundRobin(ranked, Math.max(0, input.maxDetails));
  const selectedIds = new Set(selected.map((item) => item.identity));
  for (const candidate of ranked) {
    if (!selectedIds.has(candidate.identity)) {
      skipped.push({
        identity: candidate.identity,
        title: clipTitle(candidate.job.title),
        reason: 'budget',
      });
    }
  }

  const byPriority: Record<number, number> = {};
  for (const candidate of ranked) {
    byPriority[candidate.priority] = (byPriority[candidate.priority] ?? 0) + 1;
  }

  return {
    selected,
    ranked,
    skipped,
    byPriority,
    backoffCount,
    skippedHasDescription,
  };
}

function priorityReasonFrom(priority: number): DetailPriorityReason {
  if (priority === 0) {
    return 'profession_variant';
  }
  if (priority === 1) {
    return 'user_query';
  }
  if (priority === 2) {
    return 'catalog_empty';
  }
  return 'other';
}

function clipTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}

function primaryQueryKey(provenances: readonly SourceQueryProvenance[]): string {
  const variant = provenances.find((item) => item.origin === 'profession_variant');
  if (variant) {
    return provenanceQueryKey(variant);
  }

  const first = provenances[0];
  return first ? provenanceQueryKey(first) : '';
}

function takeRoundRobin(
  ranked: readonly DetailCandidate[],
  budget: number,
): DetailCandidate[] {
  if (budget <= 0 || ranked.length === 0) {
    return [];
  }

  const lanes = new Map<string, DetailCandidate[]>();
  for (const candidate of ranked) {
    const lane = lanes.get(candidate.queryKey) ?? [];
    lane.push(candidate);
    lanes.set(candidate.queryKey, lane);
  }

  const keys = [...lanes.keys()];
  const selected: DetailCandidate[] = [];
  const seen = new Set<string>();

  while (selected.length < budget) {
    let progressed = false;
    for (const key of keys) {
      const queue = lanes.get(key);
      while (queue && queue.length > 0) {
        const next = queue.shift();
        if (!next || seen.has(next.identity)) {
          continue;
        }

        seen.add(next.identity);
        selected.push(next);
        progressed = true;
        break;
      }

      if (selected.length >= budget) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  return selected;
}

function toMatchablePreview(
  identity: string,
  sourceId: NormalizedJob['sourceId'],
  job: SourceJobRaw,
  catalog: DetailFetchState | undefined,
): MatchableJob {
  return {
    id: identity,
    sourceId,
    title: job.title,
    companyName: job.companyName,
    description: job.description?.trim() || catalog?.description || null,
    location: job.location ?? null,
    workModel: job.workModel ?? null,
    experienceLevel: job.experienceLevel ?? null,
    technologies: job.technologies ?? [],
    sourceJobId: job.sourceJobId,
    canonicalUrl: job.canonicalUrl,
  };
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
