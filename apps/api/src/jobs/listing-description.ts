const ACCESS_CHALLENGE_PATTERN =
  /güvenlik doğrulaması|guvenlik dogrulamasi|captcha|cf-challenge|just a moment|access denied|bot detection/i;

export function textLooksLikeAccessChallenge(value: string): boolean {
  return ACCESS_CHALLENGE_PATTERN.test(value);
}

export function isUsableJobDescription(
  value: string | null | undefined,
): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !textLooksLikeAccessChallenge(trimmed);
}
