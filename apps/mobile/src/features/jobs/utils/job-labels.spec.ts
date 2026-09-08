import { describe, expect, it } from 'vitest';

import type { JobListItem } from '../types/job.types';
import {
  countJobsBySourceForSearch,
  filterJobs,
} from './job-labels';

function job(overrides: Partial<JobListItem>): JobListItem {
  return {
    id: 'job-1',
    sourceId: 'linkedin',
    title: 'Gıda Mühendisi',
    companyName: 'Co',
    location: 'İzmir',
    workModel: 'onsite',
    publishedAt: null,
    firstDiscoveredAt: '2026-09-04T10:00:00.000Z',
    canonicalUrl: 'https://example.com/1',
    matchedSearchIds: ['search-gida'],
    duplicateGroupSize: 1,
    isMatched: true,
    isNew: false,
    isSeen: true,
    isFavorite: false,
    ...overrides,
  };
}

describe('countJobsBySourceForSearch', () => {
  const items = [
    job({ id: 'li-1', sourceId: 'linkedin', matchedSearchIds: ['search-gida'] }),
    job({
      id: 'kn-1',
      sourceId: 'kariyer_net',
      canonicalUrl: 'https://example.com/2',
      matchedSearchIds: ['search-gida'],
    }),
    job({
      id: 'li-other',
      sourceId: 'linkedin',
      canonicalUrl: 'https://example.com/3',
      matchedSearchIds: ['search-other'],
    }),
  ];

  it('counts LinkedIn and Kariyer.net from the selected search result set', () => {
    expect(countJobsBySourceForSearch(items, 'search-gida')).toEqual({
      total: 2,
      linkedin: 1,
      kariyerNet: 1,
    });
    expect(countJobsBySourceForSearch(items, 'all')).toEqual({
      total: 3,
      linkedin: 2,
      kariyerNet: 1,
    });
  });

  it('keeps source-tab filtering independent of header source counts', () => {
    const scoped = filterJobs(items, 'linkedin', 'search-gida');
    expect(scoped).toHaveLength(1);
    expect(countJobsBySourceForSearch(items, 'search-gida').kariyerNet).toBe(1);
  });
});
