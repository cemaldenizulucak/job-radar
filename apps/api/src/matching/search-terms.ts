import { normalizeText } from '../common/normalize-text.js';

/**
 * Software/technology classifiers. Not used on the default MatchingService path.
 * Kept for optional scoring or metadata later.
 */

export type SearchTermKind = 'role' | 'technology';

export type TechnologyFamily = 'frontend' | 'backend' | 'mobile' | 'universal';

export type JobRoleFamily =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'software'
  | 'none';

export type ClassifiedSearchTerm = {
  raw: string;
  normalized: string;
  kind: SearchTermKind;
  family: TechnologyFamily | null;
};

export type ClassifiedSearch = {
  roleKeywords: readonly string[];
  technologyTerms: readonly string[];
  terms: readonly ClassifiedSearchTerm[];
  technologyFamilies: readonly TechnologyFamily[];
};

type TechnologyEntry = {
  aliases: readonly string[];
  family: TechnologyFamily;
};

/**
 * Deterministic catalog. Add aliases here; do not infer with a model.
 * Aliases are matched after normalizeText (punctuation becomes spaces).
 */
const TECHNOLOGY_CATALOG: readonly TechnologyEntry[] = [
  { aliases: ['angular', 'angularjs'], family: 'frontend' },
  { aliases: ['react'], family: 'frontend' },
  { aliases: ['vue', 'vuejs'], family: 'frontend' },
  { aliases: ['svelte'], family: 'frontend' },
  { aliases: ['next js', 'nextjs', 'next'], family: 'frontend' },
  { aliases: ['rxjs'], family: 'frontend' },
  { aliases: ['redux'], family: 'frontend' },
  { aliases: ['react native'], family: 'mobile' },
  { aliases: ['flutter'], family: 'mobile' },
  { aliases: ['kotlin'], family: 'mobile' },
  { aliases: ['swift'], family: 'mobile' },
  { aliases: ['typescript'], family: 'universal' },
  { aliases: ['javascript'], family: 'universal' },
  { aliases: ['node', 'nodejs', 'node js'], family: 'universal' },
  { aliases: ['html'], family: 'universal' },
  { aliases: ['css'], family: 'universal' },
  { aliases: ['java'], family: 'backend' },
  { aliases: ['python'], family: 'backend' },
  { aliases: ['php'], family: 'backend' },
  { aliases: ['ruby'], family: 'backend' },
  { aliases: ['net', 'dotnet', 'asp net'], family: 'backend' },
  { aliases: ['spring'], family: 'backend' },
  { aliases: ['nest js', 'nestjs'], family: 'backend' },
];

const SOFTWARE_ROLE_TOKENS = [
  'developer',
  'engineer',
  'gelistirici',
  'programmer',
  'muhendis',
  'muhendisi',
] as const;

const SOFTWARE_SPECIALIST_CONTEXT_TOKENS = [
  'yazilim',
  'software',
  'frontend',
  'backend',
  'fullstack',
  'full stack',
] as const;

const FRONTEND_ROLE_TOKENS = [
  'frontend',
  'front end',
  'ui',
  'arayuz',
] as const;

const BACKEND_STACK_TOKENS = [
  'java',
  'python',
  'php',
  'ruby',
  'dotnet',
  'spring',
] as const;

/**
 * Adjacent stacks that should not reject each other when the searched
 * technology is missing from the listing but a sibling appears in the title.
 */
const TECHNOLOGY_COMPATIBLE_GROUPS: readonly (readonly string[])[] = [
  ['react', 'react native', 'next js', 'nextjs', 'next', 'redux'],
  ['angular', 'angularjs', 'rxjs'],
  ['vue', 'vuejs'],
  ['node', 'nodejs', 'node js', 'nest js', 'nestjs'],
];

const aliasIndex: ReadonlyMap<string, TechnologyFamily> = buildAliasIndex();

export function classifySearchTerm(raw: string): ClassifiedSearchTerm {
  const normalized = normalizeText(raw);
  if (looksLikeRolePhrase(normalized)) {
    return { raw, normalized, kind: 'role', family: null };
  }

  const family = aliasIndex.get(normalized);
  if (family) {
    return { raw, normalized, kind: 'technology', family };
  }

  return { raw, normalized, kind: 'role', family: null };
}

export function classifySearch(input: {
  keywords: readonly string[];
  technologies: readonly string[];
}): ClassifiedSearch {
  const terms: ClassifiedSearchTerm[] = [];
  const roleKeywords: string[] = [];
  const technologyTerms: string[] = [];
  const families = new Set<TechnologyFamily>();

  for (const keyword of input.keywords) {
    const classified = classifySearchTerm(keyword);
    terms.push(classified);
    if (classified.kind === 'technology') {
      pushUnique(technologyTerms, classified.normalized);
      if (classified.family) {
        families.add(classified.family);
      }
    } else if (classified.normalized.length > 0) {
      pushUnique(roleKeywords, keyword);
    }
  }

  for (const technology of input.technologies) {
    const classified = classifySearchTerm(technology);
    terms.push({ ...classified, kind: 'technology' });
    if (classified.normalized.length > 0) {
      pushUnique(technologyTerms, classified.normalized);
    }
    const family = classified.family ?? aliasIndex.get(classified.normalized);
    if (family) {
      families.add(family);
    } else {
      families.add('universal');
    }
  }

  return {
    roleKeywords,
    technologyTerms,
    terms,
    technologyFamilies: [...families],
  };
}

export function technologyNeedles(term: string): string[] {
  const normalized = normalizeText(term);
  const needles = new Set<string>(normalized.length > 0 ? [normalized] : []);

  for (const entry of TECHNOLOGY_CATALOG) {
    const aliases = entry.aliases.map((alias) => normalizeText(alias));
    if (aliases.includes(normalized)) {
      for (const alias of aliases) {
        if (alias.length > 0) {
          needles.add(alias);
        }
      }
    }
  }

  return [...needles];
}

export function classifyJobRoleFamily(title: string): JobRoleFamily {
  const normalized = normalizeText(title);
  if (!normalized) {
    return 'none';
  }

  if (
    padded(normalized).includes(padded('react native')) ||
    padded(normalized).includes(padded('mobile')) ||
    padded(normalized).includes(padded('android')) ||
    padded(normalized).includes(padded('ios'))
  ) {
    return 'mobile';
  }

  if (FRONTEND_ROLE_TOKENS.some((token) => padded(normalized).includes(padded(token)))) {
    return 'frontend';
  }

  if (
    padded(normalized).includes(padded('fullstack')) ||
    padded(normalized).includes(padded('full stack'))
  ) {
    return 'fullstack';
  }

  if (
    padded(normalized).includes(padded('backend')) ||
    padded(normalized).includes(padded('back end'))
  ) {
    return 'backend';
  }

  if (BACKEND_STACK_TOKENS.some((token) => padded(normalized).includes(padded(token)))) {
    return 'backend';
  }

  if (hasSoftwareRoleToken(normalized) || hasSoftwareSpecialistTitle(normalized)) {
    return 'software';
  }

  return 'none';
}

/**
 * True when the haystack names a catalog technology that is not the searched
 * term and not a compatible sibling (React vs Next.js). Universal skills such
 * as TypeScript never compete. Used so "Senior Frontend Engineer (React)" does
 * not match an Angular-only search merely because LinkedIn returned it.
 */
export function hasCompetingTechnology(
  haystack: string,
  searchedTerms: readonly string[],
): boolean {
  const normalizedHaystack = normalizeText(haystack);
  if (!normalizedHaystack || searchedTerms.length === 0) {
    return false;
  }

  const searchedNeedles = new Set(
    searchedTerms.flatMap((term) => technologyNeedles(term)),
  );
  const searchedGroups = new Set(
    [...searchedNeedles]
      .map((needle) => compatibilityGroup(needle))
      .filter((group): group is string => group !== null),
  );

  for (const entry of TECHNOLOGY_CATALOG) {
    if (entry.family === 'universal') {
      continue;
    }

    for (const alias of entry.aliases) {
      const normalized = normalizeText(alias);
      if (!normalized || searchedNeedles.has(normalized)) {
        continue;
      }

      const group = compatibilityGroup(normalized);
      if (group && searchedGroups.has(group)) {
        continue;
      }

      if (padded(normalizedHaystack).includes(padded(normalized))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Direct frontend/UI titles (Frontend Developer, Front-End Engineer,
 * Arayüz Yazılım Uzmanı, UI Developer). Generic web or software titles
 * are not included.
 */
export function isDirectFrontendUiRole(title: string): boolean {
  const normalized = normalizeText(title);
  if (!normalized) {
    return false;
  }

  const hasFrontendToken = FRONTEND_ROLE_TOKENS.some((token) =>
    padded(normalized).includes(padded(token)),
  );
  if (!hasFrontendToken) {
    return false;
  }

  return hasSoftwareRoleToken(normalized) || hasSoftwareSpecialistTitle(normalized);
}

export function isRoleCompatibleWithTechnologies(
  jobRole: JobRoleFamily,
  families: readonly TechnologyFamily[],
): 'compatible' | 'generic' | 'incompatible' | 'none' {
  if (jobRole === 'none') {
    return 'none';
  }

  if (families.length === 0) {
    return jobRole === 'software' ? 'generic' : 'compatible';
  }

  const wantsFrontend = families.includes('frontend');
  const wantsBackend = families.includes('backend');
  const wantsMobile = families.includes('mobile');
  const onlyUniversal = families.every((family) => family === 'universal');

  if (onlyUniversal) {
    return jobRole === 'software' ? 'generic' : 'compatible';
  }

  if (jobRole === 'fullstack') {
    return 'compatible';
  }

  if (jobRole === 'software') {
    return 'generic';
  }

  if (jobRole === 'frontend') {
    return wantsFrontend || (!wantsBackend && !wantsMobile) ? 'compatible' : 'incompatible';
  }

  if (jobRole === 'backend') {
    return wantsBackend && !wantsFrontend ? 'compatible' : 'incompatible';
  }

  if (jobRole === 'mobile') {
    return wantsMobile ? 'compatible' : 'incompatible';
  }

  return 'incompatible';
}

function looksLikeRolePhrase(normalized: string): boolean {
  if (!normalized) {
    return false;
  }

  return (
    hasSoftwareRoleToken(normalized) ||
    hasSoftwareSpecialistTitle(normalized) ||
    FRONTEND_ROLE_TOKENS.some((token) => padded(normalized).includes(padded(token))) ||
    padded(normalized).includes(padded('fullstack')) ||
    padded(normalized).includes(padded('full stack')) ||
    padded(normalized).includes(padded('backend')) ||
    padded(normalized).includes(padded('mobile'))
  );
}

function hasSoftwareRoleToken(normalized: string): boolean {
  return SOFTWARE_ROLE_TOKENS.some((token) => padded(normalized).includes(padded(token)));
}

function hasSoftwareSpecialistTitle(normalized: string): boolean {
  const specialist =
    padded(normalized).includes(padded('uzmani')) ||
    padded(normalized).includes(padded('specialist'));
  if (!specialist) {
    return false;
  }

  return SOFTWARE_SPECIALIST_CONTEXT_TOKENS.some((token) =>
    padded(normalized).includes(padded(token)),
  );
}

function compatibilityGroup(normalized: string): string | null {
  for (const group of TECHNOLOGY_COMPATIBLE_GROUPS) {
    if (group.includes(normalized)) {
      return group[0] ?? null;
    }
  }

  return null;
}

function buildAliasIndex(): Map<string, TechnologyFamily> {
  const index = new Map<string, TechnologyFamily>();
  for (const entry of TECHNOLOGY_CATALOG) {
    for (const alias of entry.aliases) {
      index.set(normalizeText(alias), entry.family);
    }
  }

  return index;
}

function padded(value: string): string {
  return ` ${value} `;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}
