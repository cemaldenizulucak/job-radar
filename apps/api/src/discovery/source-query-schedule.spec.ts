import { buildSourceQueryUnits } from './source-query-plan.js';
import {
  collectUniqueSourceQueries,
  scheduleQueriesRoundRobin,
} from './source-query-schedule.js';

function unit(keyword: string, location: string | null = null) {
  return { keyword, location, origin: 'user' as const };
}

describe('collectUniqueSourceQueries', () => {
  it('collapses the same normalized query from two users into one HTTP unit', () => {
    const unique = collectUniqueSourceQueries([
      { userId: 'user-a', searchId: 'search-a', unit: unit('Frontend Developer', 'İzmir') },
      { userId: 'user-b', searchId: 'search-b', unit: unit('frontend developer', 'Izmir') },
    ]);

    expect(unique).toHaveLength(1);
    expect(unique[0]?.consumers.map((item) => item.userId).sort()).toEqual([
      'user-a',
      'user-b',
    ]);
  });
});

describe('scheduleQueriesRoundRobin', () => {
  it('defers queries that exceed the global hourly budget', () => {
    const queries = collectUniqueSourceQueries([
      { userId: 'user-a', searchId: 'search-a', unit: unit('alpha') },
      { userId: 'user-a', searchId: 'search-a', unit: unit('beta') },
      { userId: 'user-b', searchId: 'search-b', unit: unit('gamma') },
    ]);
    const first = scheduleQueriesRoundRobin({
      queries,
      budget: 2,
      roundRobinOffset: 0,
    });

    expect(first.selected.map((item) => item.unit.keyword)).toEqual(['alpha', 'gamma']);
    expect(first.deferred.map((item) => item.unit.keyword)).toEqual(['beta']);
  });

  it('rotates the starting user so one user is not starved', () => {
    const queries = collectUniqueSourceQueries([
      { userId: 'user-a', searchId: 'search-a', unit: unit('alpha') },
      { userId: 'user-a', searchId: 'search-a', unit: unit('beta') },
      { userId: 'user-b', searchId: 'search-b', unit: unit('gamma') },
      { userId: 'user-b', searchId: 'search-b', unit: unit('delta') },
    ]);

    const first = scheduleQueriesRoundRobin({
      queries,
      budget: 1,
      roundRobinOffset: 0,
    });
    const second = scheduleQueriesRoundRobin({
      queries,
      budget: 1,
      roundRobinOffset: first.nextRoundRobinOffset,
    });

    expect(first.selected.map((item) => item.consumers[0]?.userId)).toEqual(['user-a']);
    expect(second.selected.map((item) => item.consumers[0]?.userId)).toEqual(['user-b']);
  });

  it('does not emit profession-sized AND blobs from saved-search units', () => {
    const units = buildSourceQueryUnits({
      keywords: ['Gıda Mühendisi', 'Kalite güvence'],
      locations: [],
      subdivisionNames: ['İzmir'],
    });
    expect(units.every((item) => !item.keyword.includes(','))).toBe(true);
  });
});
