export function normalizeText(value: string): string {
  return foldTurkishAscii(value.toLocaleLowerCase('tr-TR'))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldTurkishAscii(value: string): string {
  return value
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}
