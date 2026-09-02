import type { KariyerNetRawJob } from '../kariyer-net.types.js';

/**
 * Development-only Kariyer.net listings. Not used when
 * KARIYER_NET_PROVIDER=live.
 */
export const KARIYER_NET_FIXTURE_SOURCE_JOB_IDS = [
  'kn-abc-frontend',
  'kn-pixel-react',
  'kn-orbit-angular',
] as const;

export const KARIYER_NET_FIXTURE_URLS = [
  'https://www.kariyer.net/is-ilani/abc-frontend',
  'https://www.kariyer.net/is-ilani/pixel-react',
  'https://www.kariyer.net/is-ilani/orbit-angular',
] as const;

export function isKariyerNetFixtureIdentity(input: {
  sourceJobId?: string | null;
  canonicalUrl?: string | null;
  externalJobId?: unknown;
}): boolean {
  const sourceJobId = input.sourceJobId ?? '';
  const externalJobId =
    typeof input.externalJobId === 'string' ? input.externalJobId : '';
  const canonicalUrl = input.canonicalUrl ?? '';

  return (
    (KARIYER_NET_FIXTURE_SOURCE_JOB_IDS as readonly string[]).includes(
      sourceJobId,
    ) ||
    (KARIYER_NET_FIXTURE_SOURCE_JOB_IDS as readonly string[]).includes(
      externalJobId,
    ) ||
    (KARIYER_NET_FIXTURE_URLS as readonly string[]).includes(canonicalUrl)
  );
}

export const KARIYER_NET_FIXTURE_JOBS: readonly KariyerNetRawJob[] = [
  {
    externalJobId: 'kn-abc-frontend',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/abc-frontend',
    title: 'Frontend Developer',
    companyName: 'ABC Technology',
    description:
      'ABC Technology seeks a Frontend Developer for hybrid work in Istanbul. This Kariyer.net listing is a separate source row from LinkedIn.',
    location: 'Istanbul',
    workModel: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'mid',
    technologies: ['React', 'TypeScript'],
  },
  {
    externalJobId: 'kn-pixel-react',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/pixel-react',
    title: 'React Developer',
    companyName: 'Pixel Works',
    description:
      'Pixel Works is hiring a React Developer to work on customer-facing dashboards.',
    location: 'Istanbul',
    workModel: 'hybrid',
    employmentType: 'full-time',
    experienceLevel: 'mid',
    technologies: ['React'],
  },
  {
    externalJobId: 'kn-orbit-angular',
    canonicalUrl: 'https://www.kariyer.net/is-ilani/orbit-angular',
    title: 'Angular Developer',
    companyName: 'Orbit Digital',
    description:
      'Orbit Digital wants an Angular Developer for a remote product team.',
    location: 'Remote',
    workModel: 'remote',
    employmentType: 'full-time',
    experienceLevel: 'mid',
    technologies: ['Angular', 'TypeScript'],
  },
];
