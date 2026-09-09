import {
  kariyerNetNormalizeRejectionReasons,
  normalizeKariyerNetJob,
} from './kariyer-net.normalizer.js';

describe('normalizeKariyerNetJob', () => {
  it('maps provider fields onto the shared normalized job model', () => {
    const job = normalizeKariyerNetJob({
      externalJobId: ' kn-abc-frontend ',
      canonicalUrl: ' https://www.kariyer.net/is-ilani/abc-frontend ',
      title: ' Frontend Developer ',
      companyName: ' ABC Technology ',
      location: ' Istanbul ',
      workModel: 'Hibrit',
      employmentType: 'full-time',
      description: ' React role ',
      technologies: [' React ', 'TypeScript', 1],
      publishedAt: '2026-09-01T10:00:00.000Z',
      experienceLevel: 'mid',
    });

    expect(job).toEqual(
      expect.objectContaining({
        sourceId: 'kariyer_net',
        sourceJobId: 'kn-abc-frontend',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/abc-frontend',
        title: 'Frontend Developer',
        companyName: 'ABC Technology',
        location: 'Istanbul',
        workModel: 'hybrid',
        employmentType: 'full-time',
        description: 'React role',
        technologies: ['React', 'TypeScript'],
        publishedAt: '2026-09-01T10:00:00.000Z',
        experienceLevel: 'mid',
      }),
    );
  });

  it('accepts a numeric listing id from JSON-LD', () => {
    const job = normalizeKariyerNetJob({
      externalJobId: 4291111111,
      canonicalUrl: 'https://www.kariyer.net/is-ilani/numeric-id',
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
    });

    expect(job?.sourceJobId).toBe('4291111111');
  });

  it('drops malformed records instead of persisting half-rows', () => {
    expect(
      normalizeKariyerNetJob({
        externalJobId: 'kn-missing-title',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/missing',
        companyName: 'ABC Technology',
      }),
    ).toBeNull();

    expect(
      kariyerNetNormalizeRejectionReasons({
        externalJobId: 'kn-missing-title',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/missing',
        companyName: 'ABC Technology',
      }),
    ).toEqual(['missing title']);
  });

  it('reports the shared-model companyName constraint instead of inventing a company', () => {
    const raw = {
      externalJobId: '4291111111',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/ornek-4291111111',
      title: 'Frontend Developer',
    };

    expect(normalizeKariyerNetJob(raw)).toBeNull();
    expect(kariyerNetNormalizeRejectionReasons(raw)).toEqual([
      'missing companyName (required by NormalizedJob; listing pages may omit it)',
    ]);
  });

  it('rejects a non-http canonical URL', () => {
    expect(
      kariyerNetNormalizeRejectionReasons({
        externalJobId: '4291111111',
        canonicalUrl: 'javascript:alert(1)',
        title: 'Frontend Developer',
        companyName: 'ABC Technology',
      }),
    ).toEqual(['invalid URL']);
  });

  it('ignores a non-array technologies field', () => {
    const job = normalizeKariyerNetJob({
      externalJobId: 'kn-1',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/1',
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
      technologies: 'React',
    });

    expect(job?.technologies).toEqual([]);
  });

  it('does not treat an update label as publishedAt and still keeps the job', () => {
    const job = normalizeKariyerNetJob({
      externalJobId: '4291111111',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/ornek-4291111111',
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
      publishedAt: '14 gün önce güncellendi',
    });

    expect(job).not.toBeNull();
    expect(job?.publishedAt).toBeNull();
  });

  it('leaves publishedAt null when the date is not parseable and still keeps the job', () => {
    const job = normalizeKariyerNetJob({
      externalJobId: '4291111111',
      canonicalUrl: 'https://www.kariyer.net/is-ilani/ornek-4291111111',
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
      publishedAt: 'not a date',
    });

    expect(job).not.toBeNull();
    expect(job?.publishedAt).toBeNull();
  });
});
