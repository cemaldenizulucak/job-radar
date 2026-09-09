import type {
  KariyerNetPaginationStopReason,
  KariyerNetRawJob,
} from './kariyer-net.types.js';

export function kariyerNetPageSignature(
  jobs: readonly KariyerNetRawJob[],
): string {
  const identities = jobs
    .map((job) => kariyerJobIdentity(job))
    .filter((identity): identity is string => Boolean(identity))
    .sort();
  return identities.join('|');
}

export function shouldStopKariyerNetPagination(input: {
  page: number;
  maxPages: number;
  jobsOnPage: readonly KariyerNetRawJob[];
  previousPageSignature?: string | null;
}): KariyerNetPaginationStopReason | null {
  if (input.jobsOnPage.length === 0) {
    return 'no_results';
  }

  const signature = kariyerNetPageSignature(input.jobsOnPage);
  if (
    input.page > 1 &&
    input.previousPageSignature &&
    signature.length > 0 &&
    signature === input.previousPageSignature
  ) {
    return 'pagination_loop';
  }

  if (input.page >= input.maxPages) {
    return 'max_pages';
  }

  return null;
}

function kariyerJobIdentity(job: KariyerNetRawJob): string | null {
  if (typeof job.externalJobId === 'string' && job.externalJobId.trim().length > 0) {
    return job.externalJobId.trim();
  }

  if (typeof job.canonicalUrl === 'string' && job.canonicalUrl.trim().length > 0) {
    return job.canonicalUrl.trim();
  }

  return null;
}
