import {
  canonicalizeKariyerNetJobUrl,
  extractKariyerNetListingId,
  fallbackIdFromCanonicalUrl,
  resolveKariyerNetExternalId,
} from './kariyer-net-listing-id.js';

describe('Kariyer.net listing identity', () => {
  it('uses the numeric listing id from the public job URL', () => {
    expect(
      extractKariyerNetListingId(
        'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111?utm_source=list',
      ),
    ).toBe('4291111111');
    expect(
      canonicalizeKariyerNetJobUrl(
        '/is-ilani/ornek-teknoloji-frontend-developer-4291111111?utm_source=list',
      ),
    ).toBe(
      'https://www.kariyer.net/is-ilani/ornek-teknoloji-frontend-developer-4291111111',
    );
  });

  it('falls back to a deterministic id from the canonical URL', () => {
    const url = 'https://www.kariyer.net/is-ilani/ornek-frontend-no-numeric-id';
    const first = resolveKariyerNetExternalId(url);
    const second = resolveKariyerNetExternalId(`${url}?ref=share`);

    expect(extractKariyerNetListingId(url)).toBeNull();
    expect(first).toBe(fallbackIdFromCanonicalUrl(url));
    expect(first).toBe(second);
    expect(first).toMatch(/^kn-url-[a-f0-9]{16}$/);
  });
});
