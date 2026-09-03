const TR_MONTHS = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseJobDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTurkishJobDate(date: Date, now: Date = new Date()): string {
  const daysAgo = calendarDaysBetween(startOfLocalDay(date), startOfLocalDay(now));

  if (daysAgo === 0) {
    return `Bugün ${formatTurkishTime(date)}`;
  }

  if (daysAgo === 1) {
    return `Dün ${formatTurkishTime(date)}`;
  }

  if (daysAgo >= 2 && daysAgo <= 7) {
    return `${daysAgo} gün önce`;
  }

  return formatTurkishAbsoluteDate(date);
}

export function formatTurkishJobDateFromIso(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const date = parseJobDate(iso);
  return date ? formatTurkishJobDate(date, now) : null;
}

export function formatJobListingDate(
  publishedAt: string | null,
  discoveredAt: string,
  now: Date = new Date(),
): string {
  const published = formatTurkishJobDateFromIso(publishedAt, now);
  if (published) {
    return published;
  }

  const discovered = formatTurkishJobDateFromIso(discoveredAt, now);
  return discovered ? `Bulundu: ${discovered}` : 'Tarih yok';
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function formatTurkishTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatTurkishAbsoluteDate(date: Date): string {
  const month = TR_MONTHS[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
