import {
  describeKariyerNetRawJob,
  isKariyerNetDevLogEnabled,
  previewKariyerNetJobs,
} from './kariyer-net-dev-log.js';
import type { KariyerNetRawJob } from './kariyer-net.types.js';

describe('isKariyerNetDevLogEnabled', () => {
  it('is enabled in development', () => {
    expect(isKariyerNetDevLogEnabled('development')).toBe(true);
  });

  it('is enabled when the environment name is empty', () => {
    expect(isKariyerNetDevLogEnabled('')).toBe(true);
  });

  it('is disabled when called with no argument under Vitest', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(isKariyerNetDevLogEnabled()).toBe(false);
  });

  it('is disabled in production', () => {
    expect(isKariyerNetDevLogEnabled('production')).toBe(false);
  });

  it('is disabled in test', () => {
    expect(isKariyerNetDevLogEnabled('test')).toBe(false);
  });
});

describe('previewKariyerNetJobs', () => {
  it('returns the first 3 jobs with title, company, canonicalUrl, and externalJobId', () => {
    const jobs: KariyerNetRawJob[] = [
      {
        title: 'Frontend Developer',
        companyName: 'Acme',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/a',
        externalJobId: '1',
      },
      {
        title: 'React Developer',
        companyName: 'Pixel',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/b',
        externalJobId: '2',
      },
      {
        title: 'Angular Developer',
        companyName: 'Orbit',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/c',
        externalJobId: '3',
      },
      {
        title: 'Should not appear',
        companyName: 'Skip',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/d',
        externalJobId: '4',
      },
    ];

    expect(previewKariyerNetJobs(jobs)).toEqual([
      {
        title: 'Frontend Developer',
        company: 'Acme',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/a',
        externalJobId: '1',
      },
      {
        title: 'React Developer',
        company: 'Pixel',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/b',
        externalJobId: '2',
      },
      {
        title: 'Angular Developer',
        company: 'Orbit',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/c',
        externalJobId: '3',
      },
    ]);
  });
});

describe('describeKariyerNetRawJob', () => {
  it('returns object keys and field candidates without extra payload', () => {
    expect(
      describeKariyerNetRawJob({
        title: 'Frontend Developer',
        companyName: 'Acme',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/a',
        externalJobId: 4291111111,
        location: 'Istanbul',
        description: 'should not be copied as a dedicated candidate',
      }),
    ).toEqual({
      keys: [
        'canonicalUrl',
        'companyName',
        'description',
        'externalJobId',
        'location',
        'title',
      ],
      titleCandidate: 'Frontend Developer',
      companyCandidate: 'Acme',
      urlCandidate: 'https://www.kariyer.net/is-ilani/a',
      locationCandidate: 'Istanbul',
      externalIdCandidate: '4291111111',
    });
  });
});
