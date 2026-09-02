import { InMemoryIngestedEmailStore } from './ingested-email.store.js';
import { JobAlertParserRegistry } from './job-alert-parser.registry.js';
import { MailIngestionService } from './mail-ingestion.service.js';
import { KariyerNetJobAlertParser } from './parsers/kariyer-net-job-alert.parser.js';
import { LINKEDIN_JOB_ALERT_DIGEST_FIXTURE } from './parsers/fixtures/linkedin-job-alert-digest.fixture.js';
import { LinkedInJobAlertParser } from './parsers/linkedin-job-alert.parser.js';
import type { JobAlertEmail } from './types/job-alert.types.js';

function createService(): MailIngestionService {
  return new MailIngestionService(
    new JobAlertParserRegistry([
      new LinkedInJobAlertParser(),
      new KariyerNetJobAlertParser(),
    ]),
    new InMemoryIngestedEmailStore(),
  );
}

function linkedInEmail(overrides: Partial<JobAlertEmail> = {}): JobAlertEmail {
  return {
    sender: 'jobalerts-noreply@linkedin.com',
    subject: 'Your job alert for Frontend Developer',
    body: LINKEDIN_JOB_ALERT_DIGEST_FIXTURE,
    receivedAt: new Date('2026-09-01T08:00:00.000Z'),
    externalMessageId: 'gmail-msg-1',
    ...overrides,
  };
}

describe('MailIngestionService', () => {
  it('normalizes LinkedIn alert jobs without merging listings', async () => {
    const service = createService();
    const result = await service.ingest(linkedInEmail());

    expect(result.status).toBe('ingested');
    expect(result.sourceId).toBe('linkedin');
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.map((job) => job.sourceId)).toEqual([
      'linkedin',
      'linkedin',
      'linkedin',
    ]);
    expect(result.jobs.map((job) => job.sourceJobId)).toEqual([
      '4291111111',
      '4292222222',
      '4293333333',
    ]);
  });

  it('does not process the same externalMessageId twice', async () => {
    const service = createService();
    const email = linkedInEmail({ externalMessageId: 'gmail-msg-repeat' });

    const first = await service.ingest(email);
    const second = await service.ingest(email);

    expect(first.status).toBe('ingested');
    expect(first.jobs).toHaveLength(3);
    expect(second.status).toBe('already_processed');
    expect(second.jobs).toEqual([]);
  });

  it('leaves Kariyer.net mail unprocessed so a later parser can retry', async () => {
    const service = createService();
    const email = linkedInEmail({
      sender: 'noreply@kariyer.net',
      externalMessageId: 'gmail-msg-kariyer',
      body: '<p>unknown format</p>',
    });

    const first = await service.ingest(email);
    const second = await service.ingest(email);

    expect(first.status).toBe('unsupported');
    expect(first.sourceId).toBe('kariyer_net');
    expect(first.jobs).toEqual([]);
    expect(second.status).toBe('unsupported');
  });

  it('does not mark unrecognized senders as processed', async () => {
    const service = createService();
    const email = linkedInEmail({
      sender: 'alerts@example.com',
      externalMessageId: 'gmail-msg-unknown',
    });

    await expect(service.ingest(email)).resolves.toMatchObject({
      status: 'unrecognized_sender',
      jobs: [],
    });
    await expect(service.ingest(email)).resolves.toMatchObject({
      status: 'unrecognized_sender',
    });
  });
});
