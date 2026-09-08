export type FavoriteToggleResult = 'ignored' | 'ok' | 'error';

const inflightJobIds = new Set<string>();

export function resolveFavoriteState(
  jobId: string,
  fallback: boolean,
  overlay: Readonly<Record<string, boolean>>,
): boolean {
  return Object.prototype.hasOwnProperty.call(overlay, jobId)
    ? overlay[jobId] === true
    : fallback;
}

export function pendingFavoriteJobIds(): ReadonlySet<string> {
  return inflightJobIds;
}

export function resetFavoriteToggleLocks(): void {
  inflightJobIds.clear();
}

export async function runFavoriteToggle(input: {
  jobId: string;
  currentlyFavorite: boolean;
  add: (jobId: string) => Promise<unknown>;
  remove: (jobId: string) => Promise<unknown>;
  onOptimistic: (next: boolean) => void;
  onRollback: (previous: boolean) => void;
}): Promise<FavoriteToggleResult> {
  if (!input.jobId || inflightJobIds.has(input.jobId)) {
    return 'ignored';
  }

  inflightJobIds.add(input.jobId);
  const next = !input.currentlyFavorite;
  input.onOptimistic(next);

  try {
    if (next) {
      await input.add(input.jobId);
    } else {
      await input.remove(input.jobId);
    }
    return 'ok';
  } catch {
    input.onRollback(input.currentlyFavorite);
    return 'error';
  } finally {
    inflightJobIds.delete(input.jobId);
  }
}
