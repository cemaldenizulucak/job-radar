import { describe, expect, it, vi } from 'vitest';

import {
  resetFavoriteToggleLocks,
  resolveFavoriteState,
  runFavoriteToggle,
} from './favorite-toggle';

describe('resolveFavoriteState', () => {
  it('uses the overlay so card and detail stay in sync', () => {
    expect(resolveFavoriteState('job-1', false, { 'job-1': true })).toBe(true);
    expect(resolveFavoriteState('job-1', true, { 'job-1': false })).toBe(false);
    expect(resolveFavoriteState('job-2', true, { 'job-1': false })).toBe(true);
  });
});

describe('runFavoriteToggle', () => {
  it('optimistically favorites then keeps the change', async () => {
    resetFavoriteToggleLocks();
    const states: boolean[] = [];
    const add = vi.fn(async () => undefined);

    await expect(
      runFavoriteToggle({
        jobId: 'job-1',
        currentlyFavorite: false,
        add,
        remove: vi.fn(),
        onOptimistic: (next) => states.push(next),
        onRollback: (previous) => states.push(previous),
      }),
    ).resolves.toBe('ok');

    expect(add).toHaveBeenCalledWith('job-1');
    expect(states).toEqual([true]);
  });

  it('rolls back and reports error when the API fails', async () => {
    resetFavoriteToggleLocks();
    const states: boolean[] = [];

    await expect(
      runFavoriteToggle({
        jobId: 'job-1',
        currentlyFavorite: true,
        add: vi.fn(),
        remove: async () => {
          throw new Error('network');
        },
        onOptimistic: (next) => states.push(next),
        onRollback: (previous) => states.push(previous),
      }),
    ).resolves.toBe('error');

    expect(states).toEqual([false, true]);
  });

  it('ignores a second tap while a request is in flight', async () => {
    resetFavoriteToggleLocks();
    let release: (() => void) | undefined;
    const add = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const first = runFavoriteToggle({
      jobId: 'job-1',
      currentlyFavorite: false,
      add,
      remove: vi.fn(),
      onOptimistic: vi.fn(),
      onRollback: vi.fn(),
    });
    const second = await runFavoriteToggle({
      jobId: 'job-1',
      currentlyFavorite: false,
      add,
      remove: vi.fn(),
      onOptimistic: vi.fn(),
      onRollback: vi.fn(),
    });

    expect(second).toBe('ignored');
    expect(add).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toBe('ok');
  });
});
