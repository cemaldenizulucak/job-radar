import { DuplicatesService } from './duplicates.service.js';
import type { DuplicateCandidate } from './duplicates.types.js';

const detector = new DuplicatesService();

function listing(
  overrides: Partial<DuplicateCandidate> = {},
): DuplicateCandidate {
  return {
    id: 'job-linkedin',
    sourceId: 'linkedin',
    title: 'Frontend Developer',
    companyName: 'ABC Technology',
    canonicalUrl: 'https://linkedin.example/jobs/1',
    ...overrides,
  };
}

describe('DuplicatesService', () => {
  it('groups related listings without deleting or merging them', () => {
    const linkedIn = listing();
    const kariyer = listing({
      id: 'job-kariyer',
      sourceId: 'kariyer_net',
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
      canonicalUrl: 'https://kariyer.example/jobs/1',
    });
    const jobs = [linkedIn, kariyer];

    const result = detector.detectRelationships(jobs);

    expect(result.groups).toEqual([
      {
        detectionMethod: 'normalized_exact',
        memberIds: ['job-linkedin', 'job-kariyer'],
      },
    ]);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toBe(linkedIn);
    expect(jobs[1]).toBe(kariyer);
  });

  it('leaves unique listings ungrouped', () => {
    const frontend = listing();
    const backend = listing({
      id: 'job-backend',
      title: 'Backend Developer',
      canonicalUrl: 'https://linkedin.example/jobs/2',
    });

    const result = detector.detectRelationships([frontend, backend]);

    expect(result.groups).toEqual([]);
  });
});
