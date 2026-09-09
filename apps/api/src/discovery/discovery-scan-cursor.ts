import type { SourceId } from '../common/domain.types.js';

export type SearchSourceCursor = {
  fingerprint: string;
  nextIndex: number;
};

/**
 * In-process continuation for leftover source queries.
 * State lives only in this process: a PM2 restart (or any new Node process)
 * drops cursors, so the next scan starts at index 0 again.
 */
export class DiscoveryScanCursorStore {
  private readonly cursors = new Map<string, SearchSourceCursor>();

  read(
    savedSearchId: string,
    sourceId: SourceId,
    fingerprint: string,
  ): SearchSourceCursor {
    const existing = this.cursors.get(cursorKey(savedSearchId, sourceId));
    if (!existing || existing.fingerprint !== fingerprint) {
      return { fingerprint, nextIndex: 0 };
    }

    return existing;
  }

  write(
    savedSearchId: string,
    sourceId: SourceId,
    cursor: SearchSourceCursor,
  ): void {
    this.cursors.set(cursorKey(savedSearchId, sourceId), cursor);
  }

  clear(savedSearchId: string, sourceId?: SourceId): void {
    if (sourceId) {
      this.cursors.delete(cursorKey(savedSearchId, sourceId));
      return;
    }

    for (const key of this.cursors.keys()) {
      if (key.startsWith(`${savedSearchId}:`)) {
        this.cursors.delete(key);
      }
    }
  }
}

function cursorKey(savedSearchId: string, sourceId: SourceId): string {
  return `${savedSearchId}:${sourceId}`;
}
