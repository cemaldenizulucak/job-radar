import { describe, expect, it } from 'vitest';

import { mergeNormalizedJobUpdate } from './listing-merge.js';
import type { NormalizedJob } from './jobs.types.js';

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    sourceId: 'kariyer_net',
    sourceJobId: '4291111111',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/ornek-4291111111',
    title: 'Kalite Mühendisi',
    companyName: 'Example Co',
    titleNormalized: 'kalite muhendisi',
    companyNormalized: 'example co',
    description: null,
    location: 'Manisa',
    workModel: null,
    experienceLevel: null,
    technologies: [],
    publishedAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('mergeNormalizedJobUpdate', () => {
  it('keeps a stored description when the incoming list card is empty', () => {
    const merged = mergeNormalizedJobUpdate(job({ description: null }), {
      description: 'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
      publishedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(merged.description).toBe(
      'Üniversitelerin Gıda Mühendisliği bölümünden mezun',
    );
    expect(merged.publishedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('replaces an empty stored description when detail text arrives', () => {
    const merged = mergeNormalizedJobUpdate(
      job({ description: 'Gıda mühendisliği mezunu' }),
      { description: null, publishedAt: null },
    );

    expect(merged.description).toBe('Gıda mühendisliği mezunu');
  });
});
