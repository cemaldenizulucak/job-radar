import type { SourceId } from '../common/domain.types.js';
import { MATCH_STATUS, parseMatchStatus } from '../matching/match-status.js';

import type {
  TelegramJobFields,
  TelegramJobItem,
  TelegramNotifyInput,
} from './telegram-types.js';

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const MAX_FIELD_LENGTH = 300;
const MAX_URL_LENGTH = 1500;

export function isSafeHttpUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function sourceDisplayName(sourceId: SourceId): string {
  return sourceId === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}

export function matchStatusLabel(status: TelegramJobItem['matchStatus']): string {
  return status === MATCH_STATUS.unverifiedSourceCandidate
    ? 'Olası eşleşme'
    : 'Doğrulanmış';
}

export function groupJobsForTelegram(
  input: TelegramNotifyInput,
): TelegramJobItem[] {
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]));
  const searchesById = new Map(
    input.searches.map((search) => [search.id, search.name]),
  );
  const grouped = new Map<string, TelegramJobItem>();

  for (const match of input.matches) {
    const job = jobsById.get(match.jobId);
    if (!job) {
      continue;
    }

    const status = parseMatchStatus(match.matchStatus);
    const searchName = sanitizeField(searchesById.get(match.savedSearchId) ?? '');
    const existing = grouped.get(job.id);

    if (!existing) {
      grouped.set(job.id, toTelegramJobItem(job, status, searchName));
      continue;
    }

    if (status === MATCH_STATUS.verified) {
      existing.matchStatus = MATCH_STATUS.verified;
    }
    if (searchName && !existing.searchNames.includes(searchName)) {
      existing.searchNames.push(searchName);
    }
  }

  return [...grouped.values()];
}

export function splitTelegramMessages(
  jobs: readonly TelegramJobItem[],
): { text: string; jobIds: string[] }[] {
  if (jobs.length === 0) {
    return [];
  }

  const bodies = jobs.map((job) => ({
    jobId: job.jobId,
    body: fitJobBody(formatJobBody(job)),
  }));

  const messages: { text: string; jobIds: string[] }[] = [];
  let chunk: { jobId: string; body: string }[] = [];

  const flush = (): void => {
    if (chunk.length === 0) {
      return;
    }
    messages.push({
      text: composeMessage(chunk.map((item) => item.body)),
      jobIds: chunk.map((item) => item.jobId),
    });
    chunk = [];
  };

  for (const item of bodies) {
    const next = [...chunk, item];
    const candidate = composeMessage(next.map((entry) => entry.body));
    if (candidate.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      chunk = next;
      continue;
    }

    flush();
    const alone = composeMessage([item.body]);
    if (alone.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      chunk = [item];
      continue;
    }

    messages.push({
      text: alone.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH),
      jobIds: [item.jobId],
    });
  }

  flush();
  return messages;
}

function toTelegramJobItem(
  job: TelegramJobFields,
  status: TelegramJobItem['matchStatus'],
  searchName: string,
): TelegramJobItem {
  return {
    jobId: job.id,
    title: sanitizeField(job.title),
    companyName: sanitizeField(job.companyName),
    location: sanitizeField(job.location ?? '') || null,
    sourceId: job.sourceId,
    matchStatus: status,
    searchNames: searchName ? [searchName] : [],
    listingUrl: isSafeHttpUrl(job.canonicalUrl),
  };
}

function formatJobBody(job: TelegramJobItem): string {
  const lines = [
    `Pozisyon: ${displayValue(job.title)}`,
    `Şirket: ${displayValue(job.companyName)}`,
    `Konum: ${displayValue(job.location)}`,
    `Kaynak: ${sourceDisplayName(job.sourceId)}`,
    `Eşleşme: ${matchStatusLabel(job.matchStatus)}`,
    `Arama: ${displayValue(job.searchNames.join(', '))}`,
  ];

  if (job.listingUrl) {
    lines.push(`İlanı aç: ${job.listingUrl}`);
  }

  return lines.join('\n');
}

function composeMessage(bodies: readonly string[]): string {
  const header =
    bodies.length === 1 ? '🔔 Yeni iş ilanı' : `🔔 ${bodies.length} yeni iş ilanı`;
  return [header, ...bodies].join('\n\n');
}

function fitJobBody(body: string): string {
  const headerLength = '🔔 Yeni iş ilanı\n\n'.length;
  const maxBody = TELEGRAM_MAX_MESSAGE_LENGTH - headerLength;
  if (body.length <= maxBody) {
    return body;
  }
  return `${body.slice(0, Math.max(0, maxBody - 1))}…`;
}

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '—';
}

function sanitizeField(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}
