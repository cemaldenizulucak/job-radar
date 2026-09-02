import type { SourceId } from '../common/domain.types.js';

export function sourceListingIdentity(
  sourceId: SourceId,
  sourceJobId: string,
): string {
  return `${sourceId}:${sourceJobId}`;
}

export function decideListingWrite(existingId: string | null): 'insert' | 'update' {
  return existingId ? 'update' : 'insert';
}
