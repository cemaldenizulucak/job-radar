import { inspect } from 'node:util';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { MATCH_STATUS } from '../matching/match-status.js';
import { TELEGRAM_MAX_MESSAGE_LENGTH } from './telegram-message.js';
import {
  TELEGRAM_CLAIM_STALE_MS,
  TelegramNotificationService,
  type TelegramHttpPost,
} from './telegram-notification.service.js';
import type { TelegramNotifyInput } from './telegram-types.js';

const TOKEN = '123456:TEST-BOT-TOKEN-VALUE';
const CHAT_ID = '9988776655';

type LedgerRow = {
  id: string;
  job_id: string;
  status: 'pending' | 'sending' | 'sent';
  payload: unknown;
  claimed_at: string | null;
  sent_at: string | null;
};

class FakeTelegramLedger {
  readonly rows = new Map<string, LedgerRow>();

  from(table: string) {
    if (table !== 'telegram_job_notifications') {
      throw new Error(`unexpected table ${table}`);
    }

    let action: 'insert' | 'update' | 'select' = 'select';
    let insertValues: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> = {};
    const filters: { op: 'eq' | 'in' | 'lt'; col: string; val: unknown }[] = [];

    const run = async (single: boolean) => {
      if (action === 'insert' && insertValues) {
        const jobId = String(insertValues.job_id);
        if (this.rows.has(jobId)) {
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint',
            },
          };
        }

        const row: LedgerRow = {
          id: `tg-${jobId}`,
          job_id: jobId,
          status: (insertValues.status as LedgerRow['status']) ?? 'pending',
          payload: insertValues.payload,
          claimed_at: (insertValues.claimed_at as string | null) ?? null,
          sent_at: (insertValues.sent_at as string | null) ?? null,
        };
        this.rows.set(jobId, row);
        return { data: single ? row : [row], error: null };
      }

      const matched = [...this.rows.values()].filter((row) =>
        rowMatches(row, filters),
      );

      if (action === 'update') {
        const updated: LedgerRow[] = [];
        for (const row of matched) {
          const next: LedgerRow = {
            ...row,
            ...(patch.status
              ? { status: patch.status as LedgerRow['status'] }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'payload')
              ? { payload: patch.payload }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'claimed_at')
              ? { claimed_at: (patch.claimed_at as string | null) ?? null }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'sent_at')
              ? { sent_at: (patch.sent_at as string | null) ?? null }
              : {}),
          };
          this.rows.set(row.job_id, next);
          updated.push(next);
        }
        return { data: single ? (updated[0] ?? null) : updated, error: null };
      }

      return { data: single ? (matched[0] ?? null) : matched, error: null };
    };

    const chain: Record<string, unknown> = {};
    chain.insert = (values: Record<string, unknown>) => {
      action = 'insert';
      insertValues = values;
      return chain;
    };
    chain.update = (values: Record<string, unknown>) => {
      action = 'update';
      patch = values;
      return chain;
    };
    chain.select = () => chain;
    chain.eq = (col: string, val: unknown) => {
      filters.push({ op: 'eq', col, val });
      return chain;
    };
    chain.in = (col: string, val: unknown) => {
      filters.push({ op: 'in', col, val });
      return chain;
    };
    chain.lt = (col: string, val: unknown) => {
      filters.push({ op: 'lt', col, val });
      return chain;
    };
    chain.maybeSingle = () => run(true);
    chain.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => run(false).then(resolve, reject);
    return chain;
  }
}

function rowMatches(
  row: LedgerRow,
  filters: { op: 'eq' | 'in' | 'lt'; col: string; val: unknown }[],
): boolean {
  const record = row as unknown as Record<string, unknown>;
  return filters.every((filter) => {
    const actual = record[filter.col];
    if (filter.op === 'eq') {
      return actual === filter.val;
    }
    if (filter.op === 'in') {
      return Array.isArray(filter.val) && filter.val.includes(actual);
    }
    return typeof actual === 'string' && typeof filter.val === 'string'
      ? actual < filter.val
      : false;
  });
}

function config(
  values: Record<string, string | undefined> = {
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_CHAT_ID: CHAT_ID,
  },
): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failResponse(): Response {
  return new Response(JSON.stringify({ ok: false, description: 'bot failed' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notifyInput(
  overrides: Partial<TelegramNotifyInput> = {},
): TelegramNotifyInput {
  return {
    matches: [
      {
        jobId: 'job-1',
        savedSearchId: 'search-a',
        matchStatus: MATCH_STATUS.verified,
      },
    ],
    jobs: [
      {
        id: 'job-1',
        sourceId: 'kariyer_net',
        title: 'Frontend Developer',
        companyName: 'ACME',
        location: 'İstanbul',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/job-1',
      },
    ],
    searches: [{ id: 'search-a', name: 'Frontend' }],
    ...overrides,
  };
}

function ledgerPayload() {
  return {
    jobId: 'job-1',
    title: 'Frontend Developer',
    companyName: 'ACME',
    location: 'İstanbul',
    sourceId: 'kariyer_net' as const,
    matchStatus: MATCH_STATUS.verified,
    searchNames: ['Frontend'],
    listingUrl: 'https://www.kariyer.net/is-ilani/job-1',
  };
}

function createService(
  options: {
    env?: Record<string, string | undefined>;
    httpPost?: TelegramHttpPost;
    ledger?: FakeTelegramLedger;
  } = {},
): {
  service: TelegramNotificationService;
  httpPost: TelegramHttpPost;
  ledger: FakeTelegramLedger;
} {
  const ledger = options.ledger ?? new FakeTelegramLedger();
  const httpPost =
    options.httpPost ??
    (vi.fn(async () => okResponse()) as unknown as TelegramHttpPost);
  const service = new TelegramNotificationService(
    config(options.env),
    { getClient: () => ledger } as unknown as SupabaseService,
    httpPost,
  );
  return { service, httpPost, ledger };
}

function postedText(httpPost: TelegramHttpPost, index = 0): string {
  const calls = vi.mocked(httpPost).mock.calls;
  const init = calls[index]?.[1];
  const body = JSON.parse(String(init?.body)) as { text?: string };
  return body.text ?? '';
}

function loggerOutput(spy: { mock: { calls: unknown[][] } }): string {
  return JSON.stringify(spy.mock.calls);
}

describe('TelegramNotificationService', () => {
  it('sends a verified new listing', async () => {
    const { service, httpPost, ledger } = createService();

    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    const text = postedText(httpPost);
    expect(text).toContain('🔔 Yeni iş ilanı');
    expect(text).toContain('Pozisyon: Frontend Developer');
    expect(text).toContain('Şirket: ACME');
    expect(text).toContain('Konum: İstanbul');
    expect(text).toContain('Kaynak: Kariyer.net');
    expect(text).toContain('Eşleşme: Doğrulanmış');
    expect(text).toContain('Arama: Frontend');
    expect(text).toContain('İlanı aç: https://www.kariyer.net/is-ilani/job-1');
    expect(JSON.parse(String(vi.mocked(httpPost).mock.calls[0]?.[1]?.body))).not.toHaveProperty(
      'parse_mode',
    );
    expect(ledger.rows.get('job-1')?.status).toBe('sent');
  });

  it('sends possible-match copy for unverified source candidates', async () => {
    const { service, httpPost } = createService();

    await service.notifyNewMatches(
      notifyInput({
        matches: [
          {
            jobId: 'job-1',
            savedSearchId: 'search-a',
            matchStatus: MATCH_STATUS.unverifiedSourceCandidate,
          },
        ],
      }),
    );

    expect(postedText(httpPost)).toContain('Eşleşme: Olası eşleşme');
  });

  it('does not send the same listing again after a successful delivery', async () => {
    const { service, httpPost } = createService();

    await service.notifyNewMatches(notifyInput());
    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
  });

  it('deduplicates one listing that matched several searches', async () => {
    const { service, httpPost } = createService();

    await service.notifyNewMatches(
      notifyInput({
        matches: [
          {
            jobId: 'job-1',
            savedSearchId: 'search-a',
            matchStatus: MATCH_STATUS.verified,
          },
          {
            jobId: 'job-1',
            savedSearchId: 'search-b',
            matchStatus: MATCH_STATUS.verified,
          },
        ],
        searches: [
          { id: 'search-a', name: 'Frontend' },
          { id: 'search-b', name: 'Angular' },
        ],
      }),
    );

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(postedText(httpPost)).toContain('Arama: Frontend, Angular');
  });

  it('leaves the listing retryable when Telegram returns an error', async () => {
    const { service, httpPost, ledger } = createService({
      httpPost: vi.fn(async () => failResponse()),
    });

    await expect(service.notifyNewMatches(notifyInput())).resolves.toBeUndefined();
    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(ledger.rows.get('job-1')?.status).toBe('pending');
  });

  it('does not send when two workers race to claim the same listing', async () => {
    const ledger = new FakeTelegramLedger();
    const first = createService({ ledger });
    await first.service.notifyNewMatches(notifyInput());
    expect(vi.mocked(first.httpPost)).toHaveBeenCalledOnce();

    const second = createService({ ledger });
    await second.service.notifyNewMatches(notifyInput());
    expect(vi.mocked(second.httpPost)).not.toHaveBeenCalled();
  });

  it('lets only one concurrent worker send the same pending listing', async () => {
    const ledger = new FakeTelegramLedger();
    const first = createService({ ledger });
    const second = createService({ ledger });

    await Promise.all([
      first.service.notifyNewMatches(notifyInput()),
      second.service.notifyNewMatches(notifyInput()),
    ]);

    const sendCount =
      vi.mocked(first.httpPost).mock.calls.length +
      vi.mocked(second.httpPost).mock.calls.length;
    expect(sendCount).toBe(1);
    expect(ledger.rows.get('job-1')?.status).toBe('sent');
  });

  it('retries a failed send on the next discovery run', async () => {
    const httpPost = vi
      .fn()
      .mockResolvedValueOnce(failResponse())
      .mockResolvedValueOnce(okResponse());
    const { service, ledger } = createService({ httpPost });

    await service.notifyNewMatches(notifyInput());
    expect(ledger.rows.get('job-1')?.status).toBe('pending');

    await service.notifyNewMatches(notifyInput());
    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(ledger.rows.get('job-1')?.status).toBe('sent');
  });

  it('reclaims a listing stuck in sending past the stale window', async () => {
    const ledger = new FakeTelegramLedger();
    const staleAt = new Date(Date.now() - TELEGRAM_CLAIM_STALE_MS - 1_000).toISOString();
    ledger.rows.set('job-1', {
      id: 'tg-job-1',
      job_id: 'job-1',
      status: 'sending',
      payload: ledgerPayload(),
      claimed_at: staleAt,
      sent_at: null,
    });
    const { service, httpPost } = createService({ ledger });

    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(ledger.rows.get('job-1')?.status).toBe('sent');
  });

  it('does not steal an in-flight sending claim', async () => {
    const ledger = new FakeTelegramLedger();
    ledger.rows.set('job-1', {
      id: 'tg-job-1',
      job_id: 'job-1',
      status: 'sending',
      payload: ledgerPayload(),
      claimed_at: new Date().toISOString(),
      sent_at: null,
    });
    const { service, httpPost } = createService({ ledger });

    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
    expect(ledger.rows.get('job-1')?.status).toBe('sending');
  });

  it('starts with Telegram disabled when env vars are missing', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramNotificationService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => new FakeTelegramLedger() },
        },
      ],
    }).compile();

    const service = moduleRef.get(TelegramNotificationService);
    service.onModuleInit();

    expect(service.isEnabled()).toBe(false);
    await expect(
      service.notifyNewMatches(notifyInput()),
    ).resolves.toBeUndefined();
    expect(warn.mock.calls.some((call) => JSON.stringify(call).includes('disabled'))).toBe(
      true,
    );
    warn.mockRestore();
  });

  it('does not leak the bot token or chat id through logs or serialization', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const { service } = createService({
      httpPost: vi.fn(async (url) => {
        throw new Error(`request to ${url} failed`);
      }),
    });

    await service.notifyNewMatches(notifyInput());

    const dumped = [
      loggerOutput(warn),
      loggerOutput(error),
      loggerOutput(log),
      JSON.stringify(service),
      inspect(service),
    ].join('\n');

    expect(dumped).not.toContain(TOKEN);
    expect(dumped).not.toContain(CHAT_ID);
    expect(dumped).not.toContain(`bot${TOKEN}`);
    expect(inspect(service)).toBe('TelegramNotificationService enabled=true');

    warn.mockRestore();
    error.mockRestore();
    log.mockRestore();
  });

  it('splits long batches so each Telegram payload stays within the limit', async () => {
    const jobs = Array.from({ length: 40 }, (_, index) => ({
      id: `job-${index}`,
      sourceId: 'kariyer_net' as const,
      title: `Uzun pozisyon ${index} ${'A'.repeat(90)}`,
      companyName: 'ACME',
      location: 'İstanbul',
      canonicalUrl: `https://www.kariyer.net/is-ilani/job-${index}`,
    }));
    const { service, httpPost } = createService();

    await service.notifyNewMatches({
      matches: jobs.map((job) => ({
        jobId: job.id,
        savedSearchId: 'search-a',
        matchStatus: MATCH_STATUS.verified,
      })),
      jobs,
      searches: [{ id: 'search-a', name: 'Frontend' }],
    });

    const calls = vi.mocked(httpPost).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    for (let index = 0; index < calls.length; index += 1) {
      expect(postedText(httpPost, index).length).toBeLessThanOrEqual(
        TELEGRAM_MAX_MESSAGE_LENGTH,
      );
    }
  });

  it('does not add a listing link for a non-http URL', async () => {
    const { service, httpPost } = createService();

    await service.notifyNewMatches(
      notifyInput({
        jobs: [
          {
            id: 'job-1',
            sourceId: 'kariyer_net',
            title: 'Frontend Developer',
            companyName: 'ACME',
            location: 'İstanbul',
            canonicalUrl: 'javascript:alert(1)',
          },
        ],
      }),
    );

    const text = postedText(httpPost);
    expect(text).not.toContain('İlanı aç:');
    expect(text).not.toContain('javascript:');
  });
});
