import type { SourceJobRaw } from '../job-source.adapter.js';

/**
 * Development-only LinkedIn listings. Inserted only when
 * LINKEDIN_PROVIDER=mock. Never used when LINKEDIN_PROVIDER=disabled.
 */
export const LINKEDIN_FIXTURE_JOBS: readonly SourceJobRaw[] = [
  {
    sourceJobId: 'li-abc-frontend',
    canonicalUrl: 'https://www.linkedin.com/jobs/view/abc-frontend',
    title: 'Frontend Developer',
    companyName: 'ABC Technology',
    description:
      'ABC Technology is hiring a Frontend Developer to build product surfaces with React and TypeScript.',
    location: 'Istanbul',
    workModel: 'hybrid',
    experienceLevel: 'mid',
    technologies: ['React', 'TypeScript', 'Next.js'],
  },
  {
    sourceJobId: 'li-nova-react',
    canonicalUrl: 'https://www.linkedin.com/jobs/view/nova-react',
    title: 'React Developer',
    companyName: 'Nova Labs',
    description:
      'Nova Labs is looking for a React Developer to work on a remote TypeScript codebase.',
    location: 'Remote',
    workModel: 'remote',
    experienceLevel: 'mid',
    technologies: ['React', 'TypeScript'],
  },
  {
    sourceJobId: 'li-delta-angular',
    canonicalUrl: 'https://www.linkedin.com/jobs/view/delta-angular',
    title: 'Angular Developer',
    companyName: 'Delta Soft',
    description:
      'Delta Soft needs an Angular Developer for an Istanbul-based product team.',
    location: 'Istanbul',
    workModel: 'onsite',
    experienceLevel: 'mid',
    technologies: ['Angular', 'TypeScript'],
  },
];

export const LINKEDIN_FIXTURE_SOURCE_JOB_IDS = LINKEDIN_FIXTURE_JOBS.map(
  (job) => job.sourceJobId,
);

export const LINKEDIN_FIXTURE_URLS = LINKEDIN_FIXTURE_JOBS.map(
  (job) => job.canonicalUrl,
);

export function isLinkedInFixtureIdentity(input: {
  sourceJobId?: string | null;
  canonicalUrl?: string | null;
  externalJobId?: unknown;
}): boolean {
  const sourceJobId = input.sourceJobId ?? '';
  const externalJobId =
    typeof input.externalJobId === 'string' ? input.externalJobId : '';
  const canonicalUrl = input.canonicalUrl ?? '';

  return (
    LINKEDIN_FIXTURE_SOURCE_JOB_IDS.includes(sourceJobId) ||
    LINKEDIN_FIXTURE_SOURCE_JOB_IDS.includes(externalJobId) ||
    LINKEDIN_FIXTURE_URLS.includes(canonicalUrl)
  );
}
