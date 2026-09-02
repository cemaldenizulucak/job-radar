import type { KariyerNetSearchInput } from './kariyer-net.types.js';
import { KARIYER_NET_DEFAULT_BASE_URL } from './kariyer-net-web.config.js';

/**
 * Builds a public Kariyer.net search-results URL.
 * Keyword → `kw`. A single city-like location → path `/is-ilanlari/{slug}`.
 * Work type and experience are not encoded.
 */
export function buildKariyerNetSearchUrl(
  input: KariyerNetSearchInput,
  baseUrl = KARIYER_NET_DEFAULT_BASE_URL,
  page = 1,
): string {
  const origin = originFromBase(baseUrl);
  const locationSlug = input.locations
    .map(toLocationSlug)
    .find((slug) => slug.length > 0);
  const path = locationSlug
    ? `/is-ilanlari/${encodeURIComponent(locationSlug)}`
    : '/is-ilanlari';
  const url = new URL(path, origin);
  const keyword = input.keywords.map((value) => value.trim()).filter(Boolean).join(' ');
  if (keyword.length > 0) {
    url.searchParams.set('kw', keyword);
  }

  if (page > 1) {
    url.searchParams.set('cp', String(page));
  }

  return url.toString();
}

export function toLocationSlug(value: string): string {
  const ascii = value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');

  const slug = ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length === 0 || slug.includes('-')) {
    return slug.split('-')[0] ?? '';
  }

  return slug;
}

function originFromBase(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return KARIYER_NET_DEFAULT_BASE_URL;
  }
}
