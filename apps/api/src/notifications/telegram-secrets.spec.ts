import { redactTelegramSecrets } from './telegram-secrets.js';

describe('redactTelegramSecrets', () => {
  it('redacts token, chat id, webhook secret, and code hashes', () => {
    const redacted = redactTelegramSecrets(
      'url https://api.telegram.org/bot123456:ABC/sendMessage chat 9988 secret s3cret hash deadbeef',
      '123456:ABC',
      '9988',
      ['s3cret', 'deadbeef'],
    );

    expect(redacted).not.toContain('123456:ABC');
    expect(redacted).not.toContain('9988');
    expect(redacted).not.toContain('s3cret');
    expect(redacted).not.toContain('deadbeef');
  });
});
