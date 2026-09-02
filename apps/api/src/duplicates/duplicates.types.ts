import type { SourceId } from '../common/domain.types.js';

export type DuplicateCandidate = {
  id: string;
  sourceId: SourceId;
  title: string;
  companyName: string;
  canonicalUrl: string;
};

export type DuplicateGroup = {
  detectionMethod: 'normalized_exact';
  memberIds: readonly string[];
};

export type DuplicateDetectionResult = {
  groups: readonly DuplicateGroup[];
};
