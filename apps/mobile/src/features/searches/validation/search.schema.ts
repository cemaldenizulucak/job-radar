import { z } from 'zod';

import { searchesCopy } from '../copy';

export const SEARCH_SOURCE_IDS = ['linkedin', 'kariyer_net'] as const;
export const WORK_TYPES = ['remote', 'hybrid', 'onsite'] as const;

const searchSourceSchema = z.enum(SEARCH_SOURCE_IDS);
const workTypeSchema = z.enum(WORK_TYPES);

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const savedSearchFormSchema = z.object({
  name: z.string().trim().min(1, searchesCopy.nameRequired),
  keywords: z
    .string()
    .trim()
    .min(1, searchesCopy.keywordRequired)
    .refine((value) => splitTags(value).length > 0, searchesCopy.keywordRequired),
  technologies: z.string(),
  locations: z.string(),
  experienceLevels: z.string(),
  workTypes: z.array(workTypeSchema),
  sources: z
    .array(searchSourceSchema)
    .min(1, searchesCopy.sourceRequired),
  isActive: z.boolean(),
});

export type SavedSearchFormValues = z.infer<typeof savedSearchFormSchema>;

export const savedSearchWriteSchema = z.object({
  name: z.string().trim().min(1, searchesCopy.nameRequired),
  isActive: z.boolean(),
  keywords: z.array(z.string().trim().min(1)).min(1, searchesCopy.keywordRequired),
  technologies: z.array(z.string().trim().min(1)),
  locations: z.array(z.string().trim().min(1)),
  workTypes: z.array(workTypeSchema),
  experienceLevels: z.array(z.string().trim().min(1)),
  sources: z.array(searchSourceSchema).min(1, searchesCopy.sourceRequired),
});

export function formValuesToWriteInput(
  values: SavedSearchFormValues,
): z.infer<typeof savedSearchWriteSchema> {
  return savedSearchWriteSchema.parse({
    name: values.name,
    isActive: values.isActive,
    keywords: splitTags(values.keywords),
    technologies: splitTags(values.technologies),
    locations: splitTags(values.locations),
    workTypes: values.workTypes,
    experienceLevels: splitTags(values.experienceLevels),
    sources: values.sources,
  });
}

export function joinTags(values: readonly string[]): string {
  return values.join(', ');
}

export function previewTags(value: string): string[] {
  return splitTags(value);
}
