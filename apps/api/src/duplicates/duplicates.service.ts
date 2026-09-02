import { Injectable } from '@nestjs/common';

import { normalizeText } from '../common/normalize-text.js';
import type {
  DuplicateCandidate,
  DuplicateDetectionResult,
  DuplicateGroup,
} from './duplicates.types.js';

@Injectable()
export class DuplicatesService {
  detectRelationships(
    jobs: readonly DuplicateCandidate[],
  ): DuplicateDetectionResult {
    const buckets = new Map<string, string[]>();

    for (const job of jobs) {
      const key = fingerprint(job);
      const members = buckets.get(key) ?? [];
      members.push(job.id);
      buckets.set(key, members);
    }

    const groups: DuplicateGroup[] = [];

    for (const members of buckets.values()) {
      if (members.length < 2) {
        continue;
      }

      groups.push({
        detectionMethod: 'normalized_exact',
        memberIds: members,
      });
    }

    return { groups };
  }
}

function fingerprint(job: DuplicateCandidate): string {
  return `${normalizeText(job.companyName)}|${normalizeText(job.title)}`;
}
