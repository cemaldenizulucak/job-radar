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
  countryCode: z.string(),
  countryName: z.string(),
  subdivisionCodes: z.array(z.string()),
  subdivisionNames: z.array(z.string()),
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
  subdivisionCodes: z.array(z.string().trim().min(1)),
  subdivisionNames: z.array(z.string().trim().min(1)),
  workTypes: z.array(workTypeSchema),
  experienceLevels: z.array(z.string().trim().min(1)),
  sources: z.array(searchSourceSchema).min(1, searchesCopy.sourceRequired),
});

export function deriveSearchLocations(
  countryName: string,
  subdivisionNames: readonly string[],
): string[] {
  const country = blankLocationToEmpty(countryName);
  const cities = subdivisionNames
    .map((name) => blankLocationToEmpty(name))
    .filter((name) => name.length > 0);

  if (cities.length > 0 && country) {
    return unique([
      ...cities,
      ...cities.map((city) => `${city}, ${country}`),
    ]);
  }

  if (cities.length > 0) {
    return cities;
  }

  if (country) {
    return [country];
  }

  return [];
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function blankLocationToEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const folded = trimmed
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');

  if (
    folded === 'tumu' ||
    folded === 'all' ||
    folded === 'any' ||
    folded === 'hepsi' ||
    folded === '-' ||
    folded === '*'
  ) {
    return '';
  }

  return trimmed;
}

export function formValuesToWriteInput(
  values: SavedSearchFormValues,
): z.infer<typeof savedSearchWriteSchema> {
  const countryName = blankLocationToEmpty(values.countryName) || null;
  const countryCode = countryName
    ? values.countryCode.trim() || null
    : null;
  const subdivisionNames = countryCode
    ? values.subdivisionNames
        .map((name) => blankLocationToEmpty(name))
        .filter((name) => name.length > 0)
    : [];
  const subdivisionCodes = countryCode
    ? values.subdivisionCodes
        .map((code) => code.trim())
        .filter((code) => code.length > 0)
        .slice(0, subdivisionNames.length)
    : [];

  return savedSearchWriteSchema.parse({
    name: values.name,
    isActive: values.isActive,
    keywords: splitTags(values.keywords),
    technologies: [],
    locations: deriveSearchLocations(countryName ?? '', subdivisionNames),
    countryCode,
    countryName,
    subdivisionCode: subdivisionCodes[0] ?? null,
    subdivisionName: subdivisionNames[0] ?? null,
    subdivisionCodes,
    subdivisionNames,
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

export function coalesceSubdivisionCodes(search: {
  subdivisionCodes?: readonly string[] | null;
  subdivisionCode?: string | null;
}): string[] {
  if (search.subdivisionCodes && search.subdivisionCodes.length > 0) {
    return [...search.subdivisionCodes];
  }

  const single = search.subdivisionCode?.trim();
  return single ? [single] : [];
}

export function coalesceSubdivisionNames(search: {
  subdivisionNames?: readonly string[] | null;
  subdivisionName?: string | null;
}): string[] {
  if (search.subdivisionNames && search.subdivisionNames.length > 0) {
    return [...search.subdivisionNames];
  }

  const single = search.subdivisionName?.trim();
  return single ? [single] : [];
}
