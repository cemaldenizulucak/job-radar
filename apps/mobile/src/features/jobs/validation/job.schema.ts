import { z } from 'zod';

export const jobSourceIdSchema = z.enum(['linkedin', 'kariyer_net']);

export const workModelSchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);

const isoDateSchema = z.union([z.string(), z.date()]).transform((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
});

const nullableIsoDateSchema = isoDateSchema.nullable();

export const jobListItemSchema = z.object({
  id: z.string().min(1),
  sourceId: jobSourceIdSchema,
  title: z.string(),
  companyName: z.string(),
  location: z.string().nullable(),
  workModel: workModelSchema.nullable(),
  publishedAt: nullableIsoDateSchema,
  firstDiscoveredAt: isoDateSchema,
  canonicalUrl: z.string(),
  matchedSearchIds: z.array(z.string()),
  duplicateGroupSize: z.number().int().nonnegative(),
  isMatched: z.boolean().optional(),
  isNew: z.boolean(),
  isSeen: z.boolean(),
});

export const duplicateJobLinkSchema = z.object({
  id: z.string().min(1),
  sourceId: jobSourceIdSchema,
  title: z.string(),
  companyName: z.string(),
  canonicalUrl: z.string(),
});

export const jobListResponseSchema = z.object({
  items: z.array(jobListItemSchema),
  nextCursor: z.string().nullable(),
});

export const jobDetailSchema = jobListItemSchema.extend({
  description: z.string().nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  technologies: z.array(z.string()).optional(),
  matchedSearches: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  duplicateJobs: z.array(duplicateJobLinkSchema).optional(),
  isFavorite: z.boolean().optional(),
  applicationStatus: z
    .enum(['NEW', 'REVIEWING', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'])
    .nullable()
    .optional(),
  applicationId: z.string().nullable().optional(),
});
