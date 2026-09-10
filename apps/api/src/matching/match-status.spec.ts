import {
  parseMatchStatus,
  parseMatchStatusFilter,
} from './match-status.js';

describe('parseMatchStatusFilter', () => {
  it('accepts verified and unverified_source_candidate only', () => {
    expect(parseMatchStatusFilter('verified')).toBe('verified');
    expect(parseMatchStatusFilter('unverified_source_candidate')).toBe(
      'unverified_source_candidate',
    );
    expect(parseMatchStatusFilter('all')).toBeUndefined();
    expect(parseMatchStatusFilter(undefined)).toBeUndefined();
  });

  it('does not coerce unknown query values to verified', () => {
    expect(parseMatchStatus('unknown')).toBe('verified');
    expect(parseMatchStatusFilter('unknown')).toBeUndefined();
  });
});
