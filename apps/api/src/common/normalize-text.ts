export function normalizeText(value: string): string {
  return foldTurkishAscii(value.toLocaleLowerCase('tr-TR'))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comparison-only normalization. Displayed job/search text must stay original.
 * Hyphens are removed so "front-end" matches "frontend".
 */
export function normalizeForSearch(value: string): string {
  return foldTurkishAscii(value.toLocaleLowerCase('tr-TR'))
    .replace(/[-_/']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function foldTurkishAscii(value: string): string {
  return value
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}

