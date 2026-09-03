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
  countryCode: z.string(),
  countryName: z.string(),
  subdivisionCode: z.string(),
  subdivisionName: z.string(),
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
  countryCode: z.string().nullable(),
  countryName: z.string().nullable(),
  subdivisionCode: z.string().nullable(),
  subdivisionName: z.string().nullable(),
  workTypes: z.array(workTypeSchema),
  experienceLevels: z.array(z.string().trim().min(1)),
  sources: z.array(searchSourceSchema).min(1, searchesCopy.sourceRequired),
});

export function deriveSearchLocations(
  countryName: string,
  subdivisionName: string,
): string[] {
  const country = countryName.trim();
  const subdivision = subdivisionName.trim();

  if (subdivision && country) {
    return [subdivision, `${subdivision}, ${country}`];
  }

  if (subdivision) {
    return [subdivision];
  }

  if (country) {
    return [country];
  }

  return [];
}

export function formValuesToWriteInput(
  values: SavedSearchFormValues,
): z.infer<typeof savedSearchWriteSchema> {
  const countryCode = values.countryCode.trim() || null;
  const countryName = values.countryName.trim() || null;
  const subdivisionCode = countryCode
    ? values.subdivisionCode.trim() || null
    : null;
  const subdivisionName = countryCode
    ? values.subdivisionName.trim() || null
    : null;

  return savedSearchWriteSchema.parse({
    name: values.name,
    isActive: values.isActive,
    keywords: splitTags(values.keywords),
    technologies: splitTags(values.technologies),
    locations: deriveSearchLocations(
      countryName ?? '',
      subdivisionName ?? '',
    ),
    countryCode,
    countryName,
    subdivisionCode,
    subdivisionName,
    workTypes: [],
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
