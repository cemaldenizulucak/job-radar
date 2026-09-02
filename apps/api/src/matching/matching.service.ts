import { Injectable } from '@nestjs/common';

import { normalizeText } from '../common/normalize-text.js';
import type { SavedSearch } from '../searches/searches.types.js';
import {
  classifyRoleMatch,
  classifyTechnologyOnlyRole,
  roleMatchScore,
} from './frontend-role.js';
import { logMatchDecision } from './matching-dev-log.js';
import { normalizedPhraseAppears, phraseAppearsIn } from './match-text.js';
import type {
  JobSearchMatch,
  MatchableJob,
  MatchDecision,
  MatchFieldResult,
} from './matching.types.js';
import {
  classifyJobRoleFamily,
  classifySearch,
  hasCompetingTechnology,
  isDirectFrontendUiRole,
  technologyNeedles,
  type ClassifiedSearch,
} from './search-terms.js';

/**
 * Deterministic match scoring. Threshold: 50.
 *
 * Role (title-first; aliases stay title-based):
 *   direct  +50  role phrase in title, or frontend/UI family with explicit tech
 *   alias   +40  known role alias; tech-only unknown + direct frontend/UI;
 *                fullstack/software with explicit technology evidence
 *   related +20  adjacent role (React Native for React; role only in description)
 *
 * Location:                         +30 when it passes
 * Explicit technology match:        +30 (title, description, or technologies[])
 * Technology unknown:               +0  (Kariyer cards / missing snippet — not a fail)
 * Explicit technology conflict:     reject
 *   — searched tech missing AND listing names another catalog stack
 *     (React vs Angular in the title), or technologies[] omits the search term
 *
 * Technology-only searches (Angular, React, Vue):
 *   explicit tech + compatible role     strong match
 *   unknown tech + direct frontend/UI   lower-confidence match (alias)
 *   unknown tech + generic web/software reject
 *   fullstack + explicit tech           lower-priority match
 *   fullstack + unknown tech            reject
 */
export const MATCH_SCORE_WEIGHTS = {
  keyword: 50,
  location: 30,
  technology: 30,
  experience: 5,
  workModel: 5,
} as const;

export const MATCH_SCORE_THRESHOLD = 50;

@Injectable()
export class MatchingService {
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
    const classified = classifySearch(search);
    const roleFamily = classifyJobRoleFamily(job.title);
    const titleMatch = this.titleMatchResult(job, classified);
    const descriptionMatch = this.descriptionMatchResult(job, classified);
    const location = this.locationResult(job, search);
    const technology = this.technologyResult(job, classified);
    const experience = this.experienceResult(job, search);
    const workModel = this.workModelResult(job, search);
    const isTechnologyOnly =
      classified.roleKeywords.length === 0 && classified.technologyTerms.length > 0;
    let keywordKind =
      classified.roleKeywords.length > 0
        ? classifyRoleMatch(job, classified.roleKeywords, classified.technologyTerms)
        : isTechnologyOnly
          ? classifyTechnologyOnlyRole(
              job.title,
              classified.technologyFamilies,
              classified.technologyTerms,
            )
          : null;
    let genericRoleWithoutTechnology = false;

    if (isTechnologyOnly && technology !== 'pass') {
      if (technology === 'unknown' && isDirectFrontendUiRole(job.title)) {
        keywordKind = 'alias';
      } else if (technology !== 'fail') {
        genericRoleWithoutTechnology =
          roleFamily === 'software' ||
          roleFamily === 'fullstack' ||
          roleFamily === 'frontend';
        keywordKind = null;
      }
    }

    const keyword = this.keywordResult(classified, keywordKind);
    const score =
      roleMatchScore(keyword === 'pass' ? keywordKind : null) +
      scoreFor(location, MATCH_SCORE_WEIGHTS.location) +
      scoreFor(technology, MATCH_SCORE_WEIGHTS.technology) +
      scoreFor(experience, MATCH_SCORE_WEIGHTS.experience) +
      scoreFor(workModel, MATCH_SCORE_WEIGHTS.workModel);
    const reasons = rejectionReasons({
      isActive: search.isActive,
      sourceAllowed: this.matchesSources(job, search),
      keyword,
      location,
      technology,
      experience,
      workModel,
      score,
      genericRoleWithoutTechnology,
    });
    const matched = reasons.length === 0;
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
      roleFamily,
      roleMatch: keywordKind,
      titleMatch,
      descriptionMatch,
      location,
      technology,
      experience,
      workModel,
      searchTerms: classified.terms.map((term) => ({
        raw: term.raw,
        kind: term.kind,
      })),
      technologyTerms: classified.technologyTerms,
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
    classified: ClassifiedSearch,
    keywordKind: ReturnType<typeof classifyRoleMatch>,
  ): MatchFieldResult {
    if (
      classified.roleKeywords.length === 0 &&
      classified.technologyTerms.length === 0
    ) {
      return 'skipped';
    }

    return keywordKind ? 'pass' : 'fail';
  }

  private titleMatchResult(
    job: MatchableJob,
    classified: ClassifiedSearch,
  ): MatchFieldResult {
    const titleHaystack = job.title;
    const roleHit = classified.roleKeywords.some((keyword) =>
      phraseOrAliasInTitle(titleHaystack, keyword),
    );
    const techHit = classified.technologyTerms.some((term) =>
      technologyNeedles(term).some((needle) =>
        normalizedPhraseAppears(titleHaystack, needle),
      ),
    );

    if (roleHit || techHit) {
      return 'pass';
    }

    if (classified.roleKeywords.length === 0 && classified.technologyTerms.length === 0) {
      return 'skipped';
    }

    return 'fail';
  }

  private descriptionMatchResult(
    job: MatchableJob,
    classified: ClassifiedSearch,
  ): MatchFieldResult {
    const description = job.description ?? '';
    if (!description.trim()) {
      return classified.roleKeywords.length === 0 &&
        classified.technologyTerms.length === 0
        ? 'skipped'
        : 'unknown';
    }

    const roleHit = classified.roleKeywords.some((keyword) =>
      phraseOrAliasInTitle(description, keyword),
    );
    const techHit = classified.technologyTerms.some((term) =>
      technologyNeedles(term).some((needle) =>
        normalizedPhraseAppears(description, needle),
      ),
    );

    return roleHit || techHit ? 'pass' : 'fail';
  }

  private technologyResult(
    job: MatchableJob,
    classified: ClassifiedSearch,
  ): MatchFieldResult {
    if (classified.technologyTerms.length === 0) {
      return 'skipped';
    }

    const haystack = technologyHaystack(job);
    const matched = classified.technologyTerms.some((term) =>
      technologyNeedles(term).some((needle) =>
        normalizedPhraseAppears(haystack, needle),
      ),
    );
    if (matched) {
      return 'pass';
    }

    if (
      hasCompetingTechnology(
        [job.title, ...job.technologies].join(' '),
        classified.technologyTerms,
      )
    ) {
      return 'fail';
    }

    if (job.technologies.length > 0) {
      return 'fail';
    }

    return 'unknown';
  }

  private locationResult(job: MatchableJob, search: SavedSearch): MatchFieldResult {
    if (search.locations.length === 0) {
      return 'skipped';
    }

    const jobLocation = normalizeText(job.location ?? '');
    if (!jobLocation) {
      return 'unknown';
    }

    const matched = search.locations.some((location) => {
      const needle = normalizeText(location);
      return jobLocation.includes(needle) || needle.includes(jobLocation);
    });

    return matched ? 'pass' : 'fail';
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

    const jobLevel = normalizeText(job.experienceLevel);
    const matched = search.experienceLevels.some(
      (level) => normalizeText(level) === jobLevel,
    );

    return matched ? 'pass' : 'fail';
  }
}

function phraseOrAliasInTitle(haystack: string, keyword: string): boolean {
  const needle = normalizeText(keyword);
  if (!needle) {
    return false;
  }

  return (
    normalizeText(haystack).includes(needle) || phraseAppearsIn(haystack, keyword)
  );
}

function technologyHaystack(job: MatchableJob): string {
  return [job.title, job.description ?? '', ...job.technologies].join(' ');
}

function scoreFor(result: MatchFieldResult, weight: number): number {
  return result === 'pass' ? weight : 0;
}

function rejectionReasons(input: {
  isActive: boolean;
  sourceAllowed: boolean;
  keyword: MatchFieldResult;
  location: MatchFieldResult;
  technology: MatchFieldResult;
  experience: MatchFieldResult;
  workModel: MatchFieldResult;
  score: number;
  genericRoleWithoutTechnology: boolean;
}): string[] {
  const reasons: string[] = [];

  if (!input.isActive) {
    reasons.push('inactive search');
  }

  if (!input.sourceAllowed) {
    reasons.push('source excluded');
  }

  if (input.genericRoleWithoutTechnology) {
    reasons.push('generic role without technology evidence');
  } else if (input.keyword === 'fail') {
    reasons.push('keyword mismatch');
  }

  if (input.location === 'fail') {
    reasons.push('location mismatch');
  }

  if (input.technology === 'fail') {
    reasons.push('technology conflict');
  }

  if (input.experience === 'fail') {
    reasons.push('experience conflict');
  }

  if (input.workModel === 'fail') {
    reasons.push('work model conflict');
  }

  if (reasons.length > 0) {
    return reasons;
  }

  const hasFilter = [
    input.keyword,
    input.location,
    input.technology,
    input.experience,
    input.workModel,
  ].some((result) => result !== 'skipped');
  const hasPositive = [
    input.keyword,
    input.location,
    input.technology,
    input.experience,
    input.workModel,
  ].some((result) => result === 'pass');

  if (hasFilter && !hasPositive && input.score < MATCH_SCORE_THRESHOLD) {
    reasons.push('no positive match signal');
  }

  return reasons;
}
