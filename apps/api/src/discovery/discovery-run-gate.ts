/**
 * Serializes discovery runs and coalesces overlapping work for the same
 * saved search so scheduled and immediate scans cannot race.
 */
export class DiscoveryRunGate {
  private chain: Promise<void> = Promise.resolve();
  private readonly inflightSearches = new Map<string, Promise<unknown>>();

  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    return this.enqueue(fn);
  }

  runForSearch<T>(searchId: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflightSearches.get(searchId);
    if (existing) {
      return existing as Promise<T>;
    }

    const started = this.enqueue(fn);
    this.inflightSearches.set(searchId, started);
    void started.finally(() => {
      if (this.inflightSearches.get(searchId) === started) {
        this.inflightSearches.delete(searchId);
      }
    });

    return started;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(() => fn());
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
