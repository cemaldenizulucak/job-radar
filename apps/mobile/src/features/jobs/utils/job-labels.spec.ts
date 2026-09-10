import { describe, expect, it } from 'vitest';

import type { JobListItem } from '../types/job.types';
import {
  countJobsBySourceForSearch,
  filterJobs,
  jobCardScheduleLabel,
  workModelLabel,
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

describe('filterJobs match status tabs', () => {
  const items = [
    job({
      id: 'verified-li',
      sourceId: 'linkedin',
      matchStatus: 'verified',
    }),
    job({
      id: 'possible-kn',
      sourceId: 'kariyer_net',
      canonicalUrl: 'https://example.com/possible',
      matchStatus: 'unverified_source_candidate',
    }),
    job({
      id: 'verified-kn',
      sourceId: 'kariyer_net',
      canonicalUrl: 'https://example.com/verified-kn',
      matchStatus: 'verified',
      matchedSearchIds: ['search-gida', 'search-other'],
    }),
  ];

  it('shows verified jobs only on the matched tab', () => {
    expect(
      filterJobs(items, 'all', 'all', 'verified').map((item) => item.id),
    ).toEqual(['verified-li', 'verified-kn']);
  });

  it('shows unverified jobs only on the possible-matches tab', () => {
    expect(
      filterJobs(items, 'all', 'all', 'unverified_source_candidate').map(
        (item) => item.id,
      ),
    ).toEqual(['possible-kn']);
  });

  it('counts a multi-search job once on the verified tab', () => {
    const verified = filterJobs(items, 'all', 'all', 'verified');
    expect(verified.filter((item) => item.id === 'verified-kn')).toHaveLength(1);
  });

  it('keeps LinkedIn and Kariyer.net filters inside each match tab', () => {
    expect(
      filterJobs(items, 'kariyer_net', 'all', 'verified').map((item) => item.id),
    ).toEqual(['verified-kn']);
    expect(
      filterJobs(items, 'kariyer_net', 'all', 'unverified_source_candidate').map(
        (item) => item.id,
      ),
    ).toEqual(['possible-kn']);
  });
});

describe('jobCardScheduleLabel', () => {
  it('omits unknown work-model copy from the card', () => {
    expect(workModelLabel(null)).toBeNull();
    expect(workModelLabel('unknown')).toBeNull();
    expect(jobCardScheduleLabel(null, 'Bugün')).toBe('Bugün');
    expect(jobCardScheduleLabel('hybrid', 'Bugün')).toBe('Hibrit · Bugün');
  });
});
