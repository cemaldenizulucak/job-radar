import { mapJobFeedRow } from './jobs.mapper.js';

describe('mapJobFeedRow', () => {
  it('maps public.jobs columns onto the feed item', () => {
    const mapped = mapJobFeedRow(
      {
        id: 'job-1',
        source: 'linkedin',
        title: 'Frontend Developer',
        company: 'ABC Technology',
        location: 'Istanbul',
        work_model: 'hybrid',
        published_at: '2026-09-01T10:00:00.000Z',
        discovered_at: '2026-09-01T12:00:00.000Z',
        original_url: 'https://linkedin.example/abc-frontend',
        duplicate_group_id: 'group-1',
        technologies: ['React'],
        description: 'React role',
        experience_level: 'mid',
      },
      ['search-1'],
    );

    expect(mapped?.item).toEqual(
      expect.objectContaining({
        id: 'job-1',
        sourceId: 'linkedin',
        companyName: 'ABC Technology',
        canonicalUrl: 'https://linkedin.example/abc-frontend',
        matchedSearchIds: ['search-1'],
        isMatched: true,
        isFavorite: false,
      }),
    );
    expect(mapped?.duplicateGroupId).toBe('group-1');
  });

  it('keeps a row when original_url is missing', () => {
    const mapped = mapJobFeedRow(
      {
        id: 'job-1',
        source: 'linkedin',
        title: 'Frontend Developer',
        company: 'ABC Technology',
        discovered_at: '2026-09-01T12:00:00.000Z',
      },
      [],
    );

    expect(mapped?.item.id).toBe('job-1');
    expect(mapped?.item.canonicalUrl).toBe('');
    expect(mapped?.item.isMatched).toBe(false);
  });

  it('drops rows with an unknown source value', () => {
    expect(
      mapJobFeedRow(
        {
          id: 'job-1',
          source: 'indeed',
          title: 'Frontend Developer',
          company: 'ABC Technology',
          original_url: 'https://example.com',
          discovered_at: '2026-09-01T12:00:00.000Z',
        },
        [],
      ),
    ).toBeNull();
  });
});
