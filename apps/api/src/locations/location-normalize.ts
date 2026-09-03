import type { LocationCountry, LocationSubdivision } from './locations.types.js';

export function normalizeCountries(value: unknown): LocationCountry[] {
  const rows = asRecords(value);
  const byCode = new Map<string, LocationCountry>();

  for (const row of rows) {
    const code = readCode(row, ['iso2', 'cca2', 'code', 'country_code']);
    if (!code) {
      continue;
    }

    const name = readName(row);
    if (!name) {
      continue;
    }

    byCode.set(code, { code, name });
  }

  return [...byCode.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'tr'),
  );
}

export function normalizeSubdivisions(
  value: unknown,
  countryCode: string,
): LocationSubdivision[] {
  const needle = countryCode.trim().toUpperCase();
  if (!needle) {
    return [];
  }

  const rows = asRecords(value);
  const byCode = new Map<string, LocationSubdivision>();

  for (const row of rows) {
    const rowCountry = readCode(row, ['country_code', 'cca2', 'countryCode']);
    if (rowCountry !== needle) {
      continue;
    }

    const code = readCode(row, ['iso2', 'state_code', 'code', 'iso3166_2']);
    const name = readName(row);
    if (!code || !name) {
      continue;
    }

    byCode.set(`${needle}:${code}`, { code, name });
  }

  return [...byCode.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'tr'),
  );
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.data)) {
    return value.data.filter(isRecord);
  }

  if (Array.isArray(value.countries)) {
    return value.countries.filter(isRecord);
  }

  if (Array.isArray(value.states)) {
    return value.states.filter(isRecord);
  }

  return [];
}

function readCode(
  row: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toUpperCase();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readName(row: Record<string, unknown>): string | null {
  const native = trimName(row.native);
  if (native) {
    return native;
  }

  const name = row.name;
  if (isRecord(name)) {
    const localized = readNativeNameMap(name.nativeName);
    if (localized) {
      return localized;
    }

    const common = trimName(name.common) ?? trimName(name.official);
    if (common) {
      return common;
    }
  }

  return readNativeNameMap(row.nativeName) ?? trimName(name);
}

function readNativeNameMap(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const preferred = value.tur;
  if (isRecord(preferred)) {
    const turkish = trimName(preferred.common) ?? trimName(preferred.official);
    if (turkish) {
      return turkish;
    }
  }

  for (const entry of Object.values(value)) {
    if (!isRecord(entry)) {
      continue;
    }

    const common = trimName(entry.common) ?? trimName(entry.official);
    if (common) {
      return common;
    }
  }

  return null;
}

function trimName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
