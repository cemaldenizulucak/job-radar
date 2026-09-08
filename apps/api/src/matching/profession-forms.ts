import { normalizeForSearch } from '../common/normalize-text.js';
import { tokenizeNormalized } from './fuzzy-text.js';

/**
 * Engineering discipline prefixes. Used for field-form equivalence
 * (mühendis ↔ mühendisliği), not as a company denylist.
 */
export const ENGINEERING_DISCIPLINES = new Set([
  'gida',
  'makine',
  'mekanik',
  'elektrik',
  'elektronik',
  'insaat',
  'kimya',
  'cevre',
  'endustri',
  'metalurji',
  'maden',
  'petrol',
  'ziraat',
  'orman',
  'harita',
  'jeoloji',
  'jeofizik',
  'tekstil',
  'gemi',
  'havacilik',
  'otomotiv',
  'mekatronik',
]);

const ENGINEER_TITLE_REMAINDERS = new Set(['', 'i', 'ler', 'leri', 'lerin']);

const ENGINEER_FIELD_REMAINDERS = new Set([
  'lik',
  'ligi',
  'ligin',
  'liginden',
  'ligine',
  'ligini',
  'liginin',
]);

export type ProfessionFieldPhrase = {
  discipline: string;
  roleToken: string;
};

export function parseEngineeringProfession(
  phrase: string,
): ProfessionFieldPhrase | null {
  const tokens = tokenizeNormalized(normalizeForSearch(phrase));
  if (tokens.length < 2) {
    return null;
  }

  const roleToken = tokens[tokens.length - 1] ?? '';
  if (!isEngineerRoleToken(roleToken)) {
    return null;
  }

  if (tokens.length !== 2) {
    return null;
  }

  const discipline = tokens[0] ?? '';
  if (!ENGINEERING_DISCIPLINES.has(discipline)) {
    return null;
  }

  return { discipline, roleToken };
}

export function isEngineerRoleToken(token: string): boolean {
  if (token === 'engineer' || token === 'engineering') {
    return true;
  }

  if (!token.startsWith('muhendis')) {
    return false;
  }

  const remainder = token.slice('muhendis'.length);
  return (
    ENGINEER_TITLE_REMAINDERS.has(remainder) ||
    ENGINEER_FIELD_REMAINDERS.has(remainder)
  );
}

export function isEngineerFieldToken(token: string): boolean {
  if (token === 'engineering') {
    return true;
  }

  if (!token.startsWith('muhendis')) {
    return false;
  }

  return ENGINEER_FIELD_REMAINDERS.has(token.slice('muhendis'.length));
}

/**
 * True when the haystack has the searched discipline immediately followed by
 * an allowed mühendis / mühendislik inflection. Does not OR "gıda" with
 * "mühendis" across the rest of the text.
 */
export function professionFieldAppearsIn(
  haystack: string,
  phrase: string,
): boolean {
  return locateProfessionFieldSpan(haystack, phrase) !== null;
}

export function locateProfessionFieldSpan(
  haystack: string,
  phrase: string,
): { start: number; length: number; text: string; educationField: boolean } | null {
  const parsed = parseEngineeringProfession(phrase);
  if (!parsed) {
    return null;
  }

  const tokenRe = /\p{L}+/gu;
  const tokens: { text: string; start: number; end: number }[] = [];
  let match: RegExpExecArray | null = tokenRe.exec(haystack);
  while (match) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
    match = tokenRe.exec(haystack);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const disciplineToken = tokens[index];
    const roleToken = tokens[index + 1];
    if (!disciplineToken || !roleToken) {
      continue;
    }

    const discipline = normalizeForSearch(disciplineToken.text);
    const role = normalizeForSearch(roleToken.text);
    if (discipline !== parsed.discipline || !isEngineerRoleToken(role)) {
      continue;
    }

    const start = disciplineToken.start;
    const end = roleToken.end;
    return {
      start,
      length: end - start,
      text: haystack.slice(start, end),
      educationField: isEngineerFieldToken(role),
    };
  }

  return null;
}

export function exclusiveDisciplineInTitle(title: string): string | null {
  const tokens = tokenizeNormalized(normalizeForSearch(title));
  return tokens.find((token) => ENGINEERING_DISCIPLINES.has(token)) ?? null;
}

export function titleHasCompetingEngineeringDiscipline(
  title: string,
  term: string,
): boolean {
  const titleDiscipline = exclusiveDisciplineInTitle(title);
  const parsed = parseEngineeringProfession(term);
  if (!titleDiscipline || !parsed) {
    return false;
  }

  return titleDiscipline !== parsed.discipline;
}

/**
 * One extra source-query variant: Gıda Mühendisi → Gıda Mühendisliği.
 * Does not split the profession into independent tokens.
 */
export function toProfessionFieldQueryVariant(keyword: string): string | null {
  const trimmed = keyword.trim();
  const parsed = parseEngineeringProfession(trimmed);
  if (!parsed || isEngineerFieldToken(parsed.roleToken)) {
    return null;
  }

  if (/mühendis(i)?$/iu.test(trimmed)) {
    return trimmed.replace(/mühendis(i)?$/giu, (match) =>
      startsWithTurkishUpper(match) ? 'Mühendisliği' : 'mühendisliği',
    );
  }

  if (/muhendis(i)?$/i.test(trimmed)) {
    return trimmed.replace(/muhendis(i)?$/gi, (match) =>
      match[0] === 'M' ? 'Muhendisligi' : 'muhendisligi',
    );
  }

  return null;
}

export function expandKeywordsForSourceQuery(
  keywords: readonly string[],
): string[] {
  const expanded: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const key = normalizeForSearch(trimmed);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    expanded.push(trimmed);
  };

  for (const keyword of keywords) {
    push(keyword);
    for (const part of keyword.split(',')) {
      const variant = toProfessionFieldQueryVariant(part.trim());
      if (variant) {
        push(variant);
      }
    }
  }

  return expanded;
}

function startsWithTurkishUpper(value: string): boolean {
  const first = value[0] ?? '';
  return first === first.toLocaleUpperCase('tr-TR');
}
