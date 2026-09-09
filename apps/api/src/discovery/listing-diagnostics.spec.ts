import { listingDiagnosisFromDecision } from './listing-diagnostics.js';
import type { MatchDecision, MatchableJob } from '../matching/matching.types.js';

const job: MatchableJob = {
  id: 'job-1',
  sourceId: 'kariyer_net',
  title: 'Kalite Mühendisi',
  companyName: 'Example',
  description: null,
  location: 'Manisa',
  workModel: null,
  experienceLevel: null,
  technologies: [],
};

const failedDecision = {
  matched: false,
  keyword: 'fail',
  location: 'pass',
  reasons: ['keyword mismatch'],
} as unknown as MatchDecision;

describe('listingDiagnosisFromDecision', () => {
  it('reports not_discovered when the listing is absent', () => {
    expect(
      listingDiagnosisFromDecision({
        job: null,
        decision: null,
        maxAgeDays: 30,
      }).outcome,
    ).toBe('not_discovered');
  });

  it('does not treat a missing description as positive evidence', () => {
    const result = listingDiagnosisFromDecision({
      job,
      decision: failedDecision,
      maxAgeDays: 30,
    });
    expect(result.outcome).toBe('detail_missing');
    expect(result.hasDescription).toBe(false);
  });
});
