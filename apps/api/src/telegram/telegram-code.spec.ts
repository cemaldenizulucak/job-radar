import { generateTelegramLinkCode, hashTelegramLinkCode, isTelegramLinkCodeFormat } from './telegram-code.js';

describe('telegram link codes', () => {
  it('generates JR- plus 10 digits without Math.random', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateTelegramLinkCode()));
    expect(codes.size).toBeGreaterThan(1);
    for (const code of codes) {
      expect(isTelegramLinkCodeFormat(code)).toBe(true);
    }
  });

  it('hashes the normalized code and does not keep the raw value', () => {
    const hash = hashTelegramLinkCode('jr-1234567890');
    expect(hash).toBe(hashTelegramLinkCode('JR-1234567890'));
    expect(hash).not.toContain('1234567890');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects the example-shaped but short code', () => {
    expect(isTelegramLinkCodeFormat('JR-482916')).toBe(false);
    expect(isTelegramLinkCodeFormat('JR-1234567890')).toBe(true);
  });
});
