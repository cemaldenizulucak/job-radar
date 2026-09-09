export type DetailFetchErrorCategory =
  | 'challenge'
  | 'blocked'
  | 'rate_limit'
  | 'empty'
  | 'parse'
  | 'mismatch'
  | 'invalid_url'
  | 'unavailable'
  | 'redirect';

export type SourceDetailFetchOutcome = {
  sourceJobId: string;
  requestSucceeded: boolean;
  detailFetched: boolean;
  descriptionExtracted: boolean;
  errorCategory: DetailFetchErrorCategory | null;
  httpStatus: number | null;
};

export function isTemporaryDetailFailure(
  category: string | null | undefined,
): boolean {
  return (
    category === 'challenge' ||
    category === 'blocked' ||
    category === 'rate_limit' ||
    category === 'unavailable'
  );
}
