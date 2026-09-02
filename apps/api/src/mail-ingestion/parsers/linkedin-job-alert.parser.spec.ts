import type { JobAlertEmail } from '../types/job-alert.types.js';
import { LINKEDIN_JOB_ALERT_DIGEST_FIXTURE } from './fixtures/linkedin-job-alert-digest.fixture.js';
import { LinkedInJobAlertParser } from './linkedin-job-alert.parser.js';
import {
  canonicalLinkedInJobUrl,
  extractLinkedInJobId,
} from './linkedin-job-url.js';

const parser = new LinkedInJobAlertParser();

function linkedInEmail(overrides: Partial<JobAlertEmail> = {}): JobAlertEmail {
  return {
    sender: 'LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>',
    subject: "Your job alert for Frontend Developer",
    body: LINKEDIN_JOB_ALERT_DIGEST_FIXTURE,
    receivedAt: new Date('2026-09-01T08:00:00.000Z'),
    externalMessageId: 'gmail-msg-linkedin-digest-1',
    ...overrides,
  };
}

describe('extractLinkedInJobId', () => {
  it('extracts the numeric id from /jobs/view/{id} URLs', () => {
    expect(
      extractLinkedInJobId(
        'https://www.linkedin.com/jobs/view/4292222222/?eBP=JyYy',
      ),
    ).toBe('4292222222');
    expect(
      extractLinkedInJobId(
        'https://www.linkedin.com/comm/jobs/view/4291111111?trk=jobalert&eBP=csrf',
      ),
    ).toBe('4291111111');
    expect(
      extractLinkedInJobId('https://tr.linkedin.com/jobs/view/4293333333'),
    ).toBe('4293333333');
  });

  it('returns null when the path has no numeric job id', () => {
    expect(
      extractLinkedInJobId('https://www.linkedin.com/jobs/collections/recommended/'),
    ).toBeNull();
  });
});

describe('LinkedInJobAlertParser', () => {
  it('parses a digest fixture into three separate LinkedIn jobs', () => {
    const result = parser.parse(linkedInEmail());

    expect(result.status).toBe('parsed');
    expect(result.sourceId).toBe('linkedin');
    expect(result.alertName).toBe('Frontend Developer');
    expect(result.jobs).toHaveLength(3);

    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      '4291111111',
      '4292222222',
      '4293333333',
    ]);
    expect(result.jobs.map((job) => job.title)).toEqual([
      'Frontend Developer',
      'React Developer',
      'Angular Developer',
    ]);
    expect(result.jobs.map((job) => job.companyName)).toEqual([
      'ABC Technology',
      'Nova Labs',
      'Delta Soft',
    ]);
    expect(result.jobs.map((job) => job.location)).toEqual([
      'Istanbul, Türkiye',
      'Remote',
      'Ankara, Türkiye',
    ]);
    expect(result.jobs.map((job) => job.workModel)).toEqual([
      'hybrid',
      'remote',
      'onsite',
    ]);
    expect(result.jobs.map((job) => job.canonicalUrl)).toEqual([
      canonicalLinkedInJobUrl('4291111111'),
      canonicalLinkedInJobUrl('4292222222'),
      canonicalLinkedInJobUrl('4293333333'),
    ]);
  });

  it('does not merge jobs that appear in the same digest', () => {
    const result = parser.parse(linkedInEmail());
    const identities = result.jobs.map((job) => `${job.sourceJobId}:${job.canonicalUrl}`);

    expect(new Set(identities).size).toBe(3);
  });

  it('keeps a repeated View job link as the same listing instead of a fourth row', () => {
    const result = parser.parse(linkedInEmail());

    expect(
      result.jobs.filter((job) => job.sourceJobId === '4291111111'),
    ).toHaveLength(1);
  });

  it('ignores senders that are not LinkedIn job alerts', () => {
    const result = parser.parse(
      linkedInEmail({ sender: 'recruiter@example.com' }),
    );

    expect(result.status).toBe('ignored');
    expect(result.jobs).toEqual([]);
  });

  it('parses a plaintext digest when HTML anchors are absent', () => {
    const result = parser.parse(
      linkedInEmail({
        body: `
Your job alert for React jobs

Frontend Developer
ABC Technology
Istanbul (Hybrid)
https://www.linkedin.com/jobs/view/5551111111

React Developer
Nova Labs
Remote
https://www.linkedin.com/jobs/view/5552222222

Angular Developer
Delta Soft
Ankara (On-site)
https://www.linkedin.com/jobs/view/5553333333
`,
      }),
    );

    expect(result.status).toBe('parsed');
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      '5551111111',
      '5552222222',
      '5553333333',
    ]);
    expect(result.jobs[0]).toMatchObject({
      title: 'Frontend Developer',
      companyName: 'ABC Technology',
      location: 'Istanbul',
      workModel: 'hybrid',
    });
  });
});
