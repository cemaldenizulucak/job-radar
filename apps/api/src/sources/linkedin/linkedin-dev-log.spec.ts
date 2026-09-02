import { isLinkedInDevLogEnabled, previewLinkedInJobs } from './linkedin-dev-log.js';
import type { LinkedInRawJob } from './linkedin.types.js';

describe('isLinkedInDevLogEnabled', () => {
  it('is disabled in production and test', () => {
    expect(isLinkedInDevLogEnabled('production')).toBe(false);
    expect(isLinkedInDevLogEnabled('test')).toBe(false);
    expect(isLinkedInDevLogEnabled('development')).toBe(true);
  });
});

describe('previewLinkedInJobs', () => {
  it('returns the first 3 jobs with safe fields only', () => {
    const jobs: LinkedInRawJob[] = [
      {
        title: 'Frontend Developer',
        companyName: 'Acme',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/1',
        externalJobId: '1',
      },
      {
        title: 'React Developer',
        companyName: 'Pixel',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/2',
        externalJobId: '2',
      },
      {
        title: 'Angular Developer',
        companyName: 'Orbit',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/3',
        externalJobId: '3',
      },
      {
        title: 'Should not appear',
        companyName: 'Skip',
        canonicalUrl: 'https://www.linkedin.com/jobs/view/4',
        externalJobId: '4',
      },
    ];

    expect(previewLinkedInJobs(jobs)).toHaveLength(3);
    expect(previewLinkedInJobs(jobs)[0]).toEqual({
      title: 'Frontend Developer',
      company: 'Acme',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/1',
      externalJobId: '1',
      publishedAt: null,
    });
  });
});
