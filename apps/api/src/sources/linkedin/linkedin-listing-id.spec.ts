import {
  canonicalizeLinkedInJobUrl,
  extractLinkedInJobId,
} from './linkedin-listing-id.js';

describe('LinkedIn listing identity', () => {
  it('extracts the numeric job id from absolute, relative, urn, and query URLs', () => {
    expect(
      extractLinkedInJobId(
        'https://www.linkedin.com/jobs/view/frontend-developer-at-acme-3789011111?position=1',
      ),
    ).toBe('3789011111');
    expect(extractLinkedInJobId('/jobs/view/3789022222')).toBe('3789022222');
    expect(extractLinkedInJobId('urn:li:jobPosting:3789033333')).toBe('3789033333');
    expect(
      extractLinkedInJobId(
        'https://www.linkedin.com/jobs/search/?currentJobId=3789044444',
      ),
    ).toBe('3789044444');
    expect(
      extractLinkedInJobId('https://tr.linkedin.com/jobs/view/3789055555'),
    ).toBe('3789055555');
    expect(
      extractLinkedInJobId(
        'https://tr.linkedin.com/jobs/view/frontend-developer-next-at-hubx-4457295583',
      ),
    ).toBe('4457295583');
  });

  it('canonicalizes relative and tracking URLs to www.linkedin.com/jobs/view/{id}', () => {
    expect(
      canonicalizeLinkedInJobUrl(
        '/jobs/view/frontend-developer-at-acme-3789011111?trk=public',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/3789011111');
    expect(
      canonicalizeLinkedInJobUrl(
        'https://tr.linkedin.com/jobs/view/3789011111?position=1',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/3789011111');
  });

  it('returns null when no LinkedIn job id is present', () => {
    expect(extractLinkedInJobId('https://www.linkedin.com/jobs/search/')).toBeNull();
    expect(extractLinkedInJobId('')).toBeNull();
  });
});
