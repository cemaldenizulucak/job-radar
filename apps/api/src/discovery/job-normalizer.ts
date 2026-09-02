import type { SourceId } from '../common/domain.types.js';
import { normalizeText } from '../common/normalize-text.js';
import type { NormalizedJob } from '../jobs/jobs.types.js';
import type { SourceJobRaw } from '../sources/job-source.adapter.js';

export function normalizeSourceJob(
  sourceId: SourceId,
  raw: SourceJobRaw,
): NormalizedJob | null {
  const sourceJobId = raw.sourceJobId.trim();
  const canonicalUrl = raw.canonicalUrl.trim();
  const title = raw.title.trim();
  const companyName = raw.companyName.trim();

  if (!sourceJobId || !canonicalUrl || !title || !companyName) {
    return null;
  }

  return {
    sourceId,
    sourceJobId,
    canonicalUrl,
    title,
    companyName,
    titleNormalized: normalizeText(title),
    companyNormalized: normalizeText(companyName),
    description: raw.description?.trim() || null,
    location: raw.location?.trim() || null,
    workModel: raw.workModel ?? null,
    experienceLevel: raw.experienceLevel?.trim() || null,
    technologies: (raw.technologies ?? [])
      .map((technology) => technology.trim())
      .filter((technology) => technology.length > 0),
    publishedAt: raw.publishedAt?.trim() || null,
    isActive: raw.availability !== 'closed',
  };
}
