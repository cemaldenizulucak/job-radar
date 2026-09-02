import { DiscoveryRunGate } from './discovery-run-gate.js';

describe('DiscoveryRunGate', () => {
  it('coalesces overlapping runs for the same saved search', async () => {
    const gate = new DiscoveryRunGate();
    let calls = 0;
    let release: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });

    const run = () =>
      gate.runForSearch('search-1', async () => {
        calls += 1;
        await started;
        return 'done';
      });

    const first = run();
    const second = run();
    release();

    await expect(Promise.all([first, second])).resolves.toEqual(['done', 'done']);
    expect(calls).toBe(1);
  });

  it('serializes a full run with a search-scoped run', async () => {
    const gate = new DiscoveryRunGate();
    const order: string[] = [];
    let releaseSearch: () => void = () => undefined;
    const searchStarted = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });

    const searchRun = gate.runForSearch('search-1', async () => {
      order.push('search-start');
      await searchStarted;
      order.push('search-end');
      return 'search';
    });
    const fullRun = gate.runExclusive(async () => {
      order.push('full');
      return 'full';
    });

    releaseSearch();
    await expect(Promise.all([searchRun, fullRun])).resolves.toEqual([
      'search',
      'full',
    ]);
    expect(order).toEqual(['search-start', 'search-end', 'full']);
  });

  it('runs a later search after the previous one finishes', async () => {
    const gate = new DiscoveryRunGate();
    const order: string[] = [];

    await gate.runForSearch('search-1', async () => {
      order.push('one');
      return 1;
    });
    await gate.runForSearch('search-2', async () => {
      order.push('two');
      return 2;
    });

    expect(order).toEqual(['one', 'two']);
  });
});
