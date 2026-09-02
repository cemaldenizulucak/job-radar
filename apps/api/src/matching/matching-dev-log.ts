import { Logger } from '@nestjs/common';

import type { MatchDecision } from './matching.types.js';

const logger = new Logger('MatchingService');

export function isMatchingDevLogEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== 'production' && nodeEnv !== 'test';
}

export function logMatchDecision(decision: MatchDecision): void {
  if (!isMatchingDevLogEnabled()) {
    return;
  }

  logger.log({
    message: 'Match decision',
    title: decision.title,
    roleClassification: decision.roleFamily,
    technologyTerms: decision.technologyTerms,
    roleMatch: decision.roleMatch,
    technologyMatch: decision.technology,
    locationMatch: decision.location,
    score: decision.score,
    matched: decision.matched,
    rejectionReasons: decision.reasons,
    source: decision.sourceId,
    savedSearchId: decision.savedSearchId,
    searchTerms: decision.searchTerms,
    classifiedTermTypes: decision.searchTerms.map((term) => term.kind),
    titleMatch: decision.titleMatch,
    descriptionMatch: decision.descriptionMatch,
    keyword: decision.keyword,
    keywordKind: decision.keywordKind,
    experience: decision.experience,
    workModel: decision.workModel,
    threshold: decision.threshold,
  });
}
