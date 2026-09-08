/**
 * Explicit TR/EN role aliases for keyword matching.
 * Add pairs here; do not infer aliases with a model.
 *
 * Frontend pairs are role-level (UI / arayüz developer titles).
 * Generic Java or full-stack titles are not frontend aliases.
 * Do not alias generic "yazılım uzmanı" or "developer" to frontend.
 */
export const ROLE_ALIAS_PAIRS: readonly (readonly [string, string])[] = [
  ['frontend developer', 'front-end developer'],
  ['frontend developer', 'front end developer'],
  ['frontend developer', 'frontend engineer'],
  ['frontend developer', 'front-end engineer'],
  ['frontend developer', 'front end engineer'],
  ['frontend developer', 'frontend specialist'],
  ['frontend developer', 'front-end specialist'],
  ['frontend developer', 'front-end geliştirici'],
  ['frontend developer', 'frontend geliştirici'],
  ['frontend developer', 'front end geliştirici'],
  ['frontend developer', 'arayüz geliştirici'],
  ['frontend developer', 'arayüz yazılım uzmanı'],
  ['frontend developer', 'ui developer'],
  ['frontend developer', 'ui engineer'],
  ['frontend developer', 'ön yüz geliştirici'],
  ['frontend developer', 'on yuz gelistirici'],
  ['qa engineer', 'test uzmanı'],
  ['qa engineer', 'qa uzmanı'],
  ['qa engineer', 'quality assurance'],
  ['software developer', 'software engineer'],
  ['software developer', 'yazılım mühendisi'],
  ['software developer', 'yazılım geliştirici'],
  ['software developer', 'yazılım uzmanı'],
  ['developer', 'geliştirici'],
  ['frontend', 'front-end'],
  ['frontend', 'front end'],
  ['frontend', 'arayüz'],
];
