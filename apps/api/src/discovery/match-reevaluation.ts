import type { JobSearchMatch } from '../matching/matching.types.js';

export type MatchReevaluationPair = {
  jobId: string;
  savedSearchId: string;
  title?: string;
  searchName?: string;
};

export type MatchReevaluationDiff = {
  keep: JobSearchMatch[];
  insert: JobSearchMatch[];
  remove: JobSearchMatch[];
};

export function diffJobSearchMatches(
  existing: readonly JobSearchMatch[],
  desired: readonly JobSearchMatch[],
): MatchReevaluationDiff {
  const existingKeys = new Map<string, JobSearchMatch>();
  for (const match of existing) {
    existingKeys.set(matchKey(match), match);
  }

  const desiredKeys = new Map<string, JobSearchMatch>();
  for (const match of desired) {
    desiredKeys.set(matchKey(match), match);
  }

  const keep: JobSearchMatch[] = [];
  const insert: JobSearchMatch[] = [];
  const remove: JobSearchMatch[] = [];

  for (const [key, match] of desiredKeys) {
    if (existingKeys.has(key)) {
      keep.push(match);
    } else {
      insert.push(match);
    }
  }

  for (const [key, match] of existingKeys) {
    if (!desiredKeys.has(key)) {
      remove.push(match);
    }
  }

  return { keep, insert, remove };
}

export function matchKey(match: JobSearchMatch): string {
  return `${match.jobId}:${match.savedSearchId}`;
}
