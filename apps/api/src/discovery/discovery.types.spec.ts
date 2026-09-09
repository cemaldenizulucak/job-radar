import {
  EMPTY_DISCOVERY_SUMMARY,
  immediateDiscoveryStatus,
  toImmediateDiscoveryResult,
} from './discovery.types.js';

describe('immediateDiscoveryStatus', () => {
  it('is completed when every attempted source succeeds', () => {
    expect(
      immediateDiscoveryStatus({
        ...EMPTY_DISCOVERY_SUMMARY,
        sourceAttempts: 2,
        sourceFailures: 0,
        jobsFetched: 10,
      }),
    ).toBe('completed');
  });

  it('is partial when some sources fail', () => {
    expect(
      immediateDiscoveryStatus({
        ...EMPTY_DISCOVERY_SUMMARY,
        sourceAttempts: 2,
        sourceFailures: 1,
        jobsFetched: 3,
      }),
    ).toBe('partial');
  });

  it('is partial when leftover queries were deferred', () => {
    expect(
      immediateDiscoveryStatus({
        ...EMPTY_DISCOVERY_SUMMARY,
        sourceAttempts: 1,
        queriesDeferred: 2,
        jobsFetched: 4,
      }),
    ).toBe('partial');
  });

  it('is partial when a source kept earlier pages after a pagination loop', () => {
    expect(
      immediateDiscoveryStatus({
        ...EMPTY_DISCOVERY_SUMMARY,
        sourceAttempts: 2,
        sourceFailures: 0,
        sourcePartials: 1,
        jobsFetched: 6,
      }),
    ).toBe('partial');
  });

  it('is failed when every attempted source fails', () => {
    expect(
      toImmediateDiscoveryResult({
        ...EMPTY_DISCOVERY_SUMMARY,
        sourceAttempts: 2,
        sourceFailures: 2,
      }),
    ).toEqual({
      status: 'failed',
      jobsFetched: 0,
      matchesCreated: 0,
      lastDiscoveryAt: null,
    });
  });
});
