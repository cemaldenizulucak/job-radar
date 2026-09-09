import { BadRequestException } from '@nestjs/common';

import {
  listingMatchesDiagnosisTarget,
  parseDiagnosisListingUrl,
} from './diagnosis-listing-url.js';

describe('parseDiagnosisListingUrl', () => {
  it('accepts Kariyer.net and LinkedIn https listing URLs', () => {
    expect(
      parseDiagnosisListingUrl(
        'https://www.kariyer.net/is-ilani/kalite-muhendisi-123',
      ).hostname,
    ).toBe('www.kariyer.net');
    expect(
      parseDiagnosisListingUrl('https://www.linkedin.com/jobs/view/123').hostname,
    ).toBe('www.linkedin.com');
  });

  it('rejects localhost, private networks, credentials, and unrelated hosts', () => {
    const blocked = [
      'https://localhost/is-ilani/1',
      'https://127.0.0.1/is-ilani/1',
      'https://[::1]/is-ilani/1',
      'https://10.0.0.5/is-ilani/1',
      'https://192.168.1.10/is-ilani/1',
      'https://172.16.0.8/is-ilani/1',
      'https://169.254.169.254/latest/meta-data',
      'http://www.kariyer.net/is-ilani/1',
      'https://example.com/jobs/1',
      'https://evil.example/kariyer.net/1',
      'https://kariyer.net.attacker.com/is-ilani/1',
      'https://user:pass@www.kariyer.net/is-ilani/1',
      'file:///etc/passwd',
    ];

    for (const url of blocked) {
      expect(() => parseDiagnosisListingUrl(url), url).toThrow(
        BadRequestException,
      );
    }
  });
});

describe('listingMatchesDiagnosisTarget', () => {
  const job = {
    sourceId: 'kariyer_net' as const,
    sourceJobId: 'kn-1',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/kalite-muhendisi-123',
  };

  it('matches an allowlisted catalog URL without fetching', () => {
    const parsedUrl = parseDiagnosisListingUrl(job.canonicalUrl);
    expect(
      listingMatchesDiagnosisTarget(job, {
        url: job.canonicalUrl,
        parsedUrl,
      }),
    ).toBe(true);
  });

  it('does not treat an unrelated URL as a catalog hit', () => {
    expect(
      listingMatchesDiagnosisTarget(job, {
        url: 'https://example.com/jobs/1',
        parsedUrl: null,
      }),
    ).toBe(false);
  });
});
