import type { JobAlertEmail } from '../types/job-alert.types.js';
import { KariyerNetJobAlertParser } from './kariyer-net-job-alert.parser.js';

const parser = new KariyerNetJobAlertParser();

function kariyerEmail(overrides: Partial<JobAlertEmail> = {}): JobAlertEmail {
  return {
    sender: 'Kariyer.net <noreply@kariyer.net>',
    subject: 'Yeni iş fırsatları',
    body: '<html><body>placeholder until a real sample is provided</body></html>',
    receivedAt: new Date('2026-09-01T08:00:00.000Z'),
    externalMessageId: 'gmail-msg-kariyer-1',
    ...overrides,
  };
}

describe('KariyerNetJobAlertParser', () => {
  it('routes Kariyer.net senders to the stub without guessing HTML', () => {
    expect(parser.canParse(kariyerEmail())).toBe(true);
    expect(parser.sourceId).toBe('kariyer_net');
  });

  it('returns unsupported until a real sample is provided', () => {
    const result = parser.parse(kariyerEmail());

    expect(result.status).toBe('unsupported');
    expect(result.sourceId).toBe('kariyer_net');
    expect(result.jobs).toEqual([]);
    expect(result.reason).toMatch(/not implemented/i);
  });

  it('ignores senders that are not Kariyer.net', () => {
    const result = parser.parse(
      kariyerEmail({ sender: 'jobalerts-noreply@linkedin.com' }),
    );

    expect(result.status).toBe('ignored');
    expect(result.jobs).toEqual([]);
  });
});
