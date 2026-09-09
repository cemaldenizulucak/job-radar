export const MATCH_STATUS = {
  verified: 'verified',
  unverifiedSourceCandidate: 'unverified_source_candidate',
} as const;

export type MatchStatus =
  (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

export function parseMatchStatus(value: unknown): MatchStatus {
  if (value === MATCH_STATUS.unverifiedSourceCandidate) {
    return MATCH_STATUS.unverifiedSourceCandidate;
  }

  return MATCH_STATUS.verified;
}

export function isVerifiedMatchStatus(
  value: MatchStatus | null | undefined,
): boolean {
  return parseMatchStatus(value) === MATCH_STATUS.verified;
}
