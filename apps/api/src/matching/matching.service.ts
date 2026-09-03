import { Injectable } from '@nestjs/common';

import { normalizeForSearch } from '../common/normalize-text.js';
import {
  jobLocationMatchResult,
  resolveEffectiveSearchLocation,
  type ProfileLocation,
} from '../common/search-location.js';
import type { SavedSearch } from '../searches/searches.types.js';
import { logMatchDecision } from './matching-dev-log.js';
import { jobSearchableText, queryAppearsIn } from './match-text.js';
import type {
  JobSearchMatch,
  MatchableJob,
  MatchDecision,
  MatchFieldResult,
} from './matching.types.js';

/**
 * Profession-agnostic matching.
 *
 * Keywords (and optional technologies) are OR'd against searchable job text.
 * Location / source / work model / experience remain optional filters.
 * Score is for sorting only and never excludes a textual match.
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
  matchJobsToSearches(
    jobs: readonly MatchableJob[],
    searches: readonly SavedSearch[],
    profilesByUserId?: ReadonlyMap<string, ProfileLocation>,
  ): JobSearchMatch[] {
    const matches: JobSearchMatch[] = [];

    for (const job of jobs) {
      for (const search of searches) {
        const decision = this.evaluateMatch(
          job,
          search,
          profilesByUserId?.get(search.userId),
        );
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

  jobMatchesSearch(
    job: MatchableJob,
    search: SavedSearch,
    profile?: ProfileLocation | null,
  ): boolean {
    return this.evaluateMatch(job, search, profile).matched;
  }

  evaluateMatch(
    job: MatchableJob,
    search: SavedSearch,
    profile?: ProfileLocation | null,
  ): MatchDecision {
    const terms = collectSearchTerms(search);
    const searchable = jobSearchableText(job);
    const keyword = this.keywordResult(searchable, terms);
    const titleMatch = fieldContainsAny(job.title, terms);
    const descriptionMatch = fieldContainsAny(job.description ?? '', terms);
    const location = this.locationResult(job, search, profile);
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
    const decision: MatchDecision = {
      title: job.title,
      sourceId: job.sourceId,
      savedSearchId: search.id,
      matched,
      score,
      threshold: MATCH_SCORE_THRESHOLD,
      reasons,
      keyword,
      keywordKind:
        titleMatch === 'pass'
          ? 'direct'
          : descriptionMatch === 'pass'
            ? 'related'
            : keyword === 'pass'
              ? 'alias'
              : null,
      roleFamily: 'none',
      roleMatch:
        titleMatch === 'pass'
          ? 'direct'
          : descriptionMatch === 'pass'
            ? 'related'
            : keyword === 'pass'
              ? 'alias'
              : null,
      titleMatch,
      descriptionMatch,
      location,
      technology,
      experience,
      workModel,
      searchTerms: [
        ...search.keywords.map((raw) => ({ raw, kind: 'role' as const })),
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
    searchable: string,
    terms: readonly string[],
  ): MatchFieldResult {
    if (terms.length === 0) {
      return 'skipped';
    }

    return terms.some((term) => queryAppearsIn(searchable, term))
      ? 'pass'
      : 'fail';
  }

  private optionalTagResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    if (search.technologies.length === 0) {
      return 'skipped';
    }

    const searchable = jobSearchableText(job);
    return search.technologies.some((term) => queryAppearsIn(searchable, term))
      ? 'pass'
      : 'skipped';
  }

  private locationResult(
    job: MatchableJob,
    search: SavedSearch,
    profile?: ProfileLocation | null,
  ): MatchFieldResult {
    const resolved = resolveEffectiveSearchLocation(search.locations, profile);
    return jobLocationMatchResult(job.location, resolved);
  }

  private workModelResult(
    job: MatchableJob,
    search: SavedSearch,
  ): MatchFieldResult {
    if (search.workTypes.length === 0) {
      return 'skipped';
    }

    if (!job.workModel || job.workModel === 'unknown') {
      return 'unknown';
    }

    return search.workTypes.includes(job.workModel) ? 'pass' : 'fail';
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
  return [...search.keywords, ...search.technologies]
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
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
    reasons.push('work model conflict');
  }

  return reasons;
}
