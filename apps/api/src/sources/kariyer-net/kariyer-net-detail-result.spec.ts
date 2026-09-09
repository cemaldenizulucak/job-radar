import { describe, expect, it } from 'vitest';

import { classifyKariyerNetDetailResponse } from './kariyer-net-detail-result.js';

const listingUrl =
  'https://www.kariyer.net/is-ilani/ornek-kalite-4299999999';

function jobPostingHtml(description: string): string {
  return `<!DOCTYPE html>
<html><head>
<script type="application/ld+json">${JSON.stringify({
    '@type': 'JobPosting',
    title: 'Kalite Mühendisi',
    url: listingUrl,
    description,
    hiringOrganization: { name: 'Ornek Gida' },
    datePosted: '2026-08-20',
  })}</script>
</head><body></body></html>`;
}

const captchaHtml = `<!DOCTYPE html>
<html><body>
  <title>captcha</title>
  <p>captcha captcha captcha</p>
  <p>access denied</p>
  <a href="${listingUrl}">is-ilani</a>
</body></html>`;

describe('classifyKariyerNetDetailResponse', () => {
  it('rejects HTTP 403 CAPTCHA pages', () => {
    const result = classifyKariyerNetDetailResponse({
      httpStatus: 403,
      html: captchaHtml,
      canonicalUrl: listingUrl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        requestSucceeded: false,
        detailFetched: false,
        descriptionExtracted: false,
        errorCategory: 'challenge',
        httpStatus: 403,
        description: null,
      }),
    );
  });

  it('rejects HTTP 200 CAPTCHA pages', () => {
    const result = classifyKariyerNetDetailResponse({
      httpStatus: 200,
      html: captchaHtml,
      canonicalUrl: listingUrl,
    });

    expect(result.requestSucceeded).toBe(true);
    expect(result.detailFetched).toBe(false);
    expect(result.descriptionExtracted).toBe(false);
    expect(result.errorCategory).toBe('challenge');
    expect(result.description).toBeNull();
  });

  it('accepts HTTP 200 real listing pages with a usable description', () => {
    const result = classifyKariyerNetDetailResponse({
      httpStatus: 200,
      html: jobPostingHtml('Üniversitelerin Gıda Mühendisliği bölümünden mezun'),
      canonicalUrl: listingUrl,
    });

    expect(result).toEqual(
      expect.objectContaining({
        requestSucceeded: true,
        detailFetched: true,
        descriptionExtracted: true,
        errorCategory: null,
        httpStatus: 200,
        description: 'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
      }),
    );
  });
});
