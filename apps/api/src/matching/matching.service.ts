import { Injectable, Optional } from '@nestjs/common';

import { normalizeForSearch } from '../common/normalize-text.js';
import {
  hasExplicitSearchLocationFilter,
  jobLocationMatchResult,
  resolveSavedSearchLocation,
  coalesceSubdivisionCodes,
  coalesceSubdivisionNames,
} from '../common/search-location.js';
import { LocationsService } from '../locations/locations.service.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { collectKeywordEvidence, overallMatchKind } from './match-evidence.js';
import { logMatchDecision } from './matching-dev-log.js';
import { jobSearchableText, queryAppearsIn } from './match-text.js';
import { collectKeywordPhrases } from './search-phrases.js';
import { isRoleSearchTerm } from './search-term-kind.js';
import {
  searchLooksLikeSoftware,
  titleLooksUnrelatedToSoftware,
} from './unrelated-profession.js';
import type {
  JobSearchMatch,
  KeywordMatchKind,
  MatchableJob,
  MatchDecision,
  MatchEvidence,
  MatchFieldResult,
} from './matching.types.js';

/**
 * Profession-agnostic matching.
 *
 * Keywords are OR'd across comma-separated and profession-sized phrases.
 * Tokens of one profession phrase stay together in a single field.
 * Company name and location are never keyword evidence.
 */
export const MATCH_SCORE = {
  exactTitle: 100,
  titleSubstring: 90,
  description: 70,
  other: 50,
} as const;

export const MATCH_SCORE_THRESHOLD = 0;

@Injectable()
export class MatchingService {
  constructor(
    @Optional() private readonly locationsService: LocationsService | null = null,
  ) {}

  matchJobsToSearches(
    jobs: readonly MatchableJob[],
    searches: readonly SavedSearch[],
  ): JobSearchMatch[] {
    const matches: JobSearchMatch[] = [];

    for (const job of jobs) {
      for (const search of searches) {
        const decision = this.evaluateMatch(job, search);
        if (decision.matched) {
          matches.push({
            jobId: job.id,
            savedSearchId: search.id,
          });
        }
      }
    }

    return matches;
  }

  jobMatchesSearch(job: MatchableJob, search: SavedSearch): boolean {
    return this.evaluateMatch(job, search).matched;
  }

  evaluateMatch(job: MatchableJob, search: SavedSearch): MatchDecision {
    const terms = collectSearchTerms(search);
    const { result: keyword, evidence } = this.keywordResult(job, search, terms);
    const titleMatch = fieldContainsAny(job.title, terms);
    const descriptionMatch = job.description
      ? fieldContainsAny(job.description, terms)
      : terms.length === 0
        ? 'skipped'
        : 'fail';
    const location = this.locationResult(job, search);
    const technology = this.optionalTagResult(job, search);
    const experience = this.experienceResult(job, search);
    const workModel = this.workModelResult(job, search);
    const reasons = rejectionReasons({
      isActive: search.isActive,
      sourceAllowed: this.matchesSources(job, search),
      keyword,
      location,
      experience,
      workModel,
    });
    const matched = reasons.length === 0;
    const score = matched ? scoreTextMatch(job, terms) : 0;
    const keywordKind = keywordKindFromEvidence(evidence, keyword);
    const decision: MatchDecision = {
      title: job.title,
      sourceId: job.sourceId,
      savedSearchId: search.id,
      matched,
      score,
      threshold: MATCH_SCORE_THRESHOLD,
      reasons,
      keyword,
      keywordKind,
      matchKind: matched ? overallMatchKind(evidence) : null,
      evidence: matched ? evidence : [],
      roleFamily: 'none',
      roleMatch: keywordKind,
      titleMatch,
      descriptionMatch,
      location,
      technology,
      experience,
      workModel,
      searchTerms: [
        ...search.keywords.map((raw) => ({
          raw,
          kind: isRoleSearchTerm(raw) ? ('role' as const) : ('technology' as const),
        })),
        ...search.technologies.map((raw) => ({
          raw,
          kind: 'technology' as const,
        })),
      ],
      technologyTerms: search.technologies,
    };

    logMatchDecision(decision);
    return decision;
  }

  private matchesSources(job: MatchableJob, search: SavedSearch): boolean {
    if (search.sourceIds.length === 0) {
      return true;
    }

    return search.sourceIds.includes(job.sourceId);
  }

  private keywordResult(
    job: MatchableJob,
    search: SavedSearch,
    terms: readonly string[],
  ): { result: MatchFieldResult; evidence: MatchEvidence[] } {
    if (terms.length === 0) {
      return { result: 'skipped', evidence: [] };
    }

    if (
      searchLooksLikeSoftware(terms) &&
      titleLooksUnrelatedToSoftware(job.title)
    ) {
      return { result: 'fail', evidence: [] };
    }

    const evidence = collectKeywordEvidence(job, search);
    return {
      result: evidence.length > 0 ? 'pass' : 'fail',
      evidence,
    };
  }

  private optionalTagResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    if (search.technologies.length === 0) {
      return 'skipped';
    }

    const searchable = jobSearchableText(job);
    if (search.technologies.some((term) => queryAppearsIn(searchable, term))) {
      return 'pass';
    }

    if (!job.description) {
      return 'unknown';
    }

    return 'skipped';
  }

  private locationResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    const hydrated = hydrateSearchLocation(search, this.locationsService);
    if (!hasExplicitSearchLocationFilter(hydrated)) {
      return 'skipped';
    }

    const aliases = hydrated.countryCode
      ? (this.locationsService?.getCachedSubdivisionNames(hydrated.countryCode) ??
        [])
      : [];

    return jobLocationMatchResult(
      job.location,
      resolveSavedSearchLocation(hydrated, aliases),
      {
        workModel: job.workModel,
        countryCityAliases: aliases,
      },
    );
  }

  private workModelResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    const allowed = search.workTypes.filter((model) => model !== 'unknown');
    if (allowed.length === 0) {
      return 'skipped';
    }

    if (!job.workModel || job.workModel === 'unknown') {
      return 'unknown';
    }

    return allowed.includes(job.workModel) ? 'pass' : 'fail';
  }

  private experienceResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    if (search.experienceLevels.length === 0) {
      return 'skipped';
    }

    if (!job.experienceLevel) {
      return 'unknown';
    }

    const matched = search.experienceLevels.some((level) =>
      queryAppearsIn(job.experienceLevel ?? '', level),
    );

    return matched ? 'pass' : 'fail';
  }
}

function collectSearchTerms(search: SavedSearch): string[] {
  return collectKeywordPhrases(search.keywords).map((item) => item.phrase);
}

function keywordKindFromEvidence(
  evidence: readonly MatchEvidence[],
  keyword: MatchFieldResult,
): KeywordMatchKind | null {
  if (keyword !== 'pass') {
    return null;
  }

  if (evidence.some((item) => item.field === 'title')) {
    return 'direct';
  }

  if (evidence.some((item) => item.field === 'description')) {
    return 'related';
  }

  return 'alias';
}

function hydrateSearchLocation(
  search: SavedSearch,
  locations: LocationsService | null,
): SavedSearch {
  const countryName =
    search.countryName ??
    (typeof locations?.getCountryName === 'function'
      ? locations.getCountryName(search.countryCode)
      : null) ??
    null;
  const codes = coalesceSubdivisionCodes(search);
  const existingNames = coalesceSubdivisionNames(search);
  const names =
    existingNames.length > 0
      ? existingNames
      : codes
          .map((code) =>
            typeof locations?.getSubdivisionName === 'function'
              ? locations.getSubdivisionName(search.countryCode, code)
              : null,
          )
          .filter((name): name is string => Boolean(name));
  const subdivisionName =
    names[0] ??
    search.subdivisionName ??
    (typeof locations?.getSubdivisionName === 'function'
      ? locations.getSubdivisionName(search.countryCode, search.subdivisionCode)
      : null) ??
    null;

  return {
    ...search,
    countryName,
    subdivisionName,
    subdivisionCodes: codes,
    subdivisionNames: names.length > 0 ? names : subdivisionName ? [subdivisionName] : [],
  };
}

function fieldContainsAny(
  haystack: string,
  terms: readonly string[],
): MatchFieldResult {
  if (terms.length === 0) {
    return 'skipped';
  }

  if (!haystack.trim()) {
    return 'fail';
  }

  return terms.some((term) => queryAppearsIn(haystack, term)) ? 'pass' : 'fail';
}

function scoreTextMatch(job: MatchableJob, terms: readonly string[]): number {
  if (terms.length === 0) {
    return MATCH_SCORE.other;
  }

  let best = 0;

  for (const term of terms) {
    if (!queryAppearsIn(jobSearchableText(job), term)) {
      continue;
    }

    if (queryAppearsIn(job.title, term)) {
      const title = normalizeForSearch(job.title);
      const needle = normalizeForSearch(term);
      best = Math.max(
        best,
        title === needle ? MATCH_SCORE.exactTitle : MATCH_SCORE.titleSubstring,
      );
      continue;
    }

    if (job.description && queryAppearsIn(job.description, term)) {
      best = Math.max(best, MATCH_SCORE.description);
      continue;
    }

    best = Math.max(best, MATCH_SCORE.other);
  }

  return best;
}

function rejectionReasons(input: {
  isActive: boolean;
  sourceAllowed: boolean;
  keyword: MatchFieldResult;
  location: MatchFieldResult;
  experience: MatchFieldResult;
  workModel: MatchFieldResult;
}): string[] {
  const reasons: string[] = [];

  if (!input.isActive) {
    reasons.push('inactive search');
  }

  if (!input.sourceAllowed) {
    reasons.push('source excluded');
  }

  if (input.keyword === 'fail') {
    reasons.push('keyword mismatch');
  }

  if (input.location === 'fail') {
    reasons.push('location mismatch');
  }

  if (input.experience === 'fail') {
    reasons.push('experience conflict');
  }

  if (input.workModel === 'fail') {
    reasons.push('work model mismatch');
  }

  if (input.workModel === 'unknown') {
    reasons.push('work model unknown');
  }

  return reasons;
}
