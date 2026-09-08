import { attachFavoriteState } from './attach-favorite-state.js';

describe('attachFavoriteState', () => {
  it('marks only the current user favorite ids without a per-item lookup', () => {
    const items = attachFavoriteState(
      [{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }],
      new Set(['job-2']),
    );

    expect(items).toEqual([
      { id: 'job-1', isFavorite: false },
      { id: 'job-2', isFavorite: true },
      { id: 'job-3', isFavorite: false },
    ]);
  });
});
