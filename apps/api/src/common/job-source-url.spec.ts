import {
  assertAllowedJobSourceUrl,
  isAllowedJobSourceUrl,
  redirectKeepsJobSourceHost,
} from './job-source-url.js';

describe('job source URL allowlist', () => {
  it('accepts public Kariyer.net and LinkedIn https hosts', () => {
    expect(
      isAllowedJobSourceUrl(
        'https://www.kariyer.net/is-ilani/example-4252360',
      ),
    ).toBe(true);
    expect(
      isAllowedJobSourceUrl('https://www.linkedin.com/jobs/view/123'),
    ).toBe(true);
  });

  it('rejects credentials, localhost, private hosts, and unrelated domains', () => {
    expect(
      isAllowedJobSourceUrl('https://user:pass@www.kariyer.net/is-ilani/1'),
    ).toBe(false);
    expect(isAllowedJobSourceUrl('https://127.0.0.1/is-ilani/1')).toBe(false);
    expect(isAllowedJobSourceUrl('https://localhost/is-ilani/1')).toBe(false);
    expect(isAllowedJobSourceUrl('https://169.254.169.254/latest')).toBe(false);
    expect(isAllowedJobSourceUrl('https://example.com/jobs/1')).toBe(false);
    expect(() => assertAllowedJobSourceUrl('http://www.kariyer.net/1')).toThrow();
  });

  it('rejects redirects that change host', () => {
    expect(
      redirectKeepsJobSourceHost(
        'https://www.kariyer.net/is-ilani/1',
        'https://www.kariyer.net/is-ilani/1?ref=1',
      ),
    ).toBe(true);
    expect(
      redirectKeepsJobSourceHost(
        'https://www.kariyer.net/is-ilani/1',
        'https://evil.example/phish',
      ),
    ).toBe(false);
  });
});
