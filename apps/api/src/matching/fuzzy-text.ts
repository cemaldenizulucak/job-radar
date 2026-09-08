export function tokenizeNormalized(value: string): string[] {
  return value.split(' ').filter((token) => token.length > 0);
}

export function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let previousDiagonal = previous[0] ?? 0;
    previous[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const nextDiagonal = previous[j] ?? 0;
      const substitution =
        left[i - 1] === right[j - 1] ? previousDiagonal : previousDiagonal + 1;
      previous[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + 1,
        substitution,
      );
      previousDiagonal = nextDiagonal;
    }
  }

  return previous[right.length] ?? Math.max(left.length, right.length);
}

export type TokenMatchKind = 'exact' | 'stem' | 'fuzzy' | null;

export function tokenMatchKind(
  hayToken: string,
  needleToken: string,
): TokenMatchKind {
  if (!hayToken || !needleToken) {
    return null;
  }

  if (hayToken === needleToken) {
    return 'exact';
  }

  if (sharesMeaningfulStem(hayToken, needleToken)) {
    return 'stem';
  }

  if (needleToken.length <= 3 || hayToken.length <= 3) {
    return null;
  }

  const distance = levenshtein(hayToken, needleToken);
  const maxLen = Math.max(hayToken.length, needleToken.length);
  const allowed =
    maxLen <= 5 ? 1 : Math.min(2, Math.floor(maxLen * 0.25));

  return distance > 0 && distance <= allowed ? 'fuzzy' : null;
}

export function tokensCoverQuery(
  hayTokens: readonly string[],
  needleTokens: readonly string[],
): TokenMatchKind | null {
  if (needleTokens.length === 0 || hayTokens.length === 0) {
    return null;
  }

  let usedFuzzy = false;
  let usedStem = false;

  for (const needle of needleTokens) {
    const kinds = hayTokens
      .map((hayToken) => tokenMatchKind(hayToken, needle))
      .filter((kind): kind is Exclude<TokenMatchKind, null> => kind !== null);

    if (kinds.length === 0) {
      return null;
    }

    if (kinds.includes('exact')) {
      continue;
    }

    if (kinds.includes('stem')) {
      usedStem = true;
      continue;
    }

    usedFuzzy = true;
  }

  if (usedFuzzy) {
    return 'fuzzy';
  }

  return usedStem ? 'stem' : 'exact';
}

function sharesMeaningfulStem(left: string, right: string): boolean {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 5) {
    return false;
  }

  const prefix = commonPrefixLength(left, right);
  if (prefix >= shorter.length && longer.length - shorter.length <= 4) {
    return true;
  }

  return prefix >= Math.max(5, shorter.length - 1) && longer.length - prefix <= 4;
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}
