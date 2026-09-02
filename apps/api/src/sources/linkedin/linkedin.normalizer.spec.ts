import { normalizeLinkedInJob } from './linkedin.normalizer.js';

describe('normalizeLinkedInJob', () => {
  it('maps a live listing onto the shared job model and marks it active', () => {
    const job = normalizeLinkedInJob({
      externalJobId: '3789011111',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/3789011111',
      title: 'Frontend Developer',
      companyName: 'Acme',
      location: 'Istanbul',
      workModel: 'hybrid',
      publishedAt: '2026-09-01T10:00:00.000Z',
      description: 'React',
    });

    expect(job).toEqual(
      expect.objectContaining({
        sourceId: 'linkedin',
        sourceJobId: '3789011111',
        isActive: true,
        publishedAt: '2026-09-01T10:00:00.000Z',
        workModel: 'hybrid',
      }),
    );
  });

  it('keeps a job when publishedAt is missing instead of inventing a date', () => {
    const job = normalizeLinkedInJob({
      externalJobId: '3789011111',
      canonicalUrl: 'https://www.linkedin.com/jobs/view/3789011111',
      title: 'Frontend Developer',
      companyName: 'Acme',
    });

    expect(job?.publishedAt).toBeNull();
  });

  it('rejects a listing without a LinkedIn job id', () => {
    expect(
      normalizeLinkedInJob({
        canonicalUrl: 'https://www.linkedin.com/jobs/search/',
        title: 'Frontend Developer',
        companyName: 'Acme',
      }),
    ).toBeNull();
  });
});
