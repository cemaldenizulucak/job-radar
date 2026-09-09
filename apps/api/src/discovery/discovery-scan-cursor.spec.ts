import { describe, expect, it } from 'vitest';

import { DiscoveryScanCursorStore } from './discovery-scan-cursor.js';

describe('DiscoveryScanCursorStore', () => {
  it('resets when the query fingerprint changes', () => {
    const store = new DiscoveryScanCursorStore();
    store.write('search-1', 'kariyer_net', {
      fingerprint: 'kw-a',
      nextIndex: 4,
    });

    expect(store.read('search-1', 'kariyer_net', 'kw-a').nextIndex).toBe(4);
    expect(store.read('search-1', 'kariyer_net', 'kw-b').nextIndex).toBe(0);
  });
});
