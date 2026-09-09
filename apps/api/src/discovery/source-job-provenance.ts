import type { QueryPhraseOrigin } from './source-query-plan.js';

export type SourceQueryProvenance = {
  keyword: string;
  origin: QueryPhraseOrigin;
  location: string | null;
  page: number;
};

export function provenanceQueryKey(item: SourceQueryProvenance): string {
  return `${item.keyword}::${item.location ?? ''}`;
}

export function recordProvenance(
  byIdentity: Map<string, SourceQueryProvenance[]>,
  identity: string,
  item: SourceQueryProvenance,
): void {
  const existing = byIdentity.get(identity) ?? [];
  const key = `${provenanceQueryKey(item)}::${item.page}::${item.origin}`;
  if (existing.some((entry) => `${provenanceQueryKey(entry)}::${entry.page}::${entry.origin}` === key)) {
    byIdentity.set(identity, existing);
    return;
  }

  byIdentity.set(identity, [...existing, item]);
}
