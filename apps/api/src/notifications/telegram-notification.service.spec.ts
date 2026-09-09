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
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const OTHER_CHAT_ID = '1122334455';

type LedgerRow = {
  id: string;
  user_id: string;
  job_id: string;
  status: 'pending' | 'sending' | 'sent';
  payload: unknown;
  claimed_at: string | null;
  sent_at: string | null;
};

type ConnectionRow = {
  user_id: string;
  telegram_chat_id: string;
};

class FakeTelegramDb {
  readonly ledger = new Map<string, LedgerRow>();
  readonly connections = new Map<string, ConnectionRow>();

  addConnection(userId: string, chatId: string): void {
    this.connections.set(userId, {
      user_id: userId,
      telegram_chat_id: chatId,
    });
  }

  ledgerKey(userId: string, jobId: string): string {
    return `${userId}:${jobId}`;
  }

  getLedger(userId: string, jobId: string): LedgerRow | undefined {
    return this.ledger.get(this.ledgerKey(userId, jobId));
  }

  from(table: string) {
    if (table === 'user_telegram_connections') {
      return connectionQuery(this.connections);
    }
    if (table !== 'telegram_job_notifications') {
      throw new Error(`unexpected table ${table}`);
    }

    let action: 'insert' | 'update' | 'select' = 'select';
    let insertValues: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> = {};
    const filters: { op: 'eq' | 'in' | 'lt'; col: string; val: unknown }[] = [];

    const run = async (single: boolean) => {
      if (action === 'insert' && insertValues) {
        const userId = String(insertValues.user_id);
        const jobId = String(insertValues.job_id);
        const key = this.ledgerKey(userId, jobId);
        if (this.ledger.has(key)) {
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint',
            },
          };
        }

        const row: LedgerRow = {
          id: `tg-${key}`,
          user_id: userId,
          job_id: jobId,
          status: (insertValues.status as LedgerRow['status']) ?? 'pending',
          payload: insertValues.payload,
          claimed_at: (insertValues.claimed_at as string | null) ?? null,
          sent_at: (insertValues.sent_at as string | null) ?? null,
        };
        this.ledger.set(key, row);
        return { data: single ? row : [row], error: null };
      }

      const matched = [...this.ledger.values()].filter((row) =>
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
          this.ledger.set(this.ledgerKey(next.user_id, next.job_id), next);
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

function connectionQuery(connections: Map<string, ConnectionRow>) {
  const filters: { col: string; val: unknown }[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, val: unknown) => {
    filters.push({ col, val });
    return chain;
  };
  chain.in = (col: string, val: unknown) => {
    filters.push({ col, val });
    return chain;
  };
  chain.maybeSingle = async () => {
    const matched = [...connections.values()].filter((row) =>
      connectionMatches(row, filters),
    );
    return { data: matched[0] ?? null, error: null };
  };
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: [...connections.values()].filter((row) =>
        connectionMatches(row, filters),
      ),
      error: null,
    }).then(resolve, reject);
  return chain;
}

function connectionMatches(
  row: ConnectionRow,
  filters: { col: string; val: unknown }[],
): boolean {
  return filters.every((filter) => {
    const actual = row[filter.col as keyof ConnectionRow];
    if (Array.isArray(filter.val)) {
      return filter.val.includes(actual);
    }
    return actual === filter.val;
  });
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
    searches: [{ id: 'search-a', name: 'Frontend', userId: USER_ID }],
    ...overrides,
  };
}

function ledgerPayload(userId = USER_ID) {
  return {
    jobId: 'job-1',
    userId,
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
    db?: FakeTelegramDb;
    seedConnection?: boolean;
  } = {},
): {
  service: TelegramNotificationService;
  httpPost: TelegramHttpPost;
  db: FakeTelegramDb;
} {
  const db = options.db ?? new FakeTelegramDb();
  if (options.seedConnection !== false) {
    db.addConnection(USER_ID, CHAT_ID);
  }
  const httpPost =
    options.httpPost ??
    (vi.fn(async () => okResponse()) as unknown as TelegramHttpPost);
  const service = new TelegramNotificationService(
    config(options.env),
    { getClient: () => db } as unknown as SupabaseService,
    httpPost,
  );
  return { service, httpPost, db };
}

function postedText(httpPost: TelegramHttpPost, index = 0): string {
  const calls = vi.mocked(httpPost).mock.calls;
  const init = calls[index]?.[1];
  const body = JSON.parse(String(init?.body)) as { text?: string };
  return body.text ?? '';
}

function postedChatId(httpPost: TelegramHttpPost, index = 0): string {
  const calls = vi.mocked(httpPost).mock.calls;
  const init = calls[index]?.[1];
  const body = JSON.parse(String(init?.body)) as { chat_id?: string };
  return body.chat_id ?? '';
}

function loggerOutput(spy: { mock: { calls: unknown[][] } }): string {
  return JSON.stringify(spy.mock.calls);
}

describe('TelegramNotificationService', () => {
  it('sends a verified new listing', async () => {
    const { service, httpPost, db } = createService();

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
    expect(postedChatId(httpPost)).toBe(CHAT_ID);
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sent');
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
          { id: 'search-a', name: 'Frontend', userId: USER_ID },
          { id: 'search-b', name: 'Angular', userId: USER_ID },
        ],
      }),
    );

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(postedText(httpPost)).toContain('Arama: Frontend, Angular');
  });

  it('sends the same listing to two connected users separately', async () => {
    const db = new FakeTelegramDb();
    db.addConnection(USER_ID, CHAT_ID);
    db.addConnection(OTHER_USER_ID, OTHER_CHAT_ID);
    const { service, httpPost } = createService({ db, seedConnection: false });

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
          { id: 'search-a', name: 'Frontend', userId: USER_ID },
          { id: 'search-b', name: 'Backend', userId: OTHER_USER_ID },
        ],
      }),
    );

    expect(vi.mocked(httpPost)).toHaveBeenCalledTimes(2);
    expect(postedChatId(httpPost, 0)).not.toBe(postedChatId(httpPost, 1));
    expect([postedChatId(httpPost, 0), postedChatId(httpPost, 1)].sort()).toEqual(
      [CHAT_ID, OTHER_CHAT_ID].sort(),
    );
    const texts = [postedText(httpPost, 0), postedText(httpPost, 1)];
    expect(texts.some((text) => text.includes('Arama: Frontend') && !text.includes('Backend'))).toBe(
      true,
    );
    expect(texts.some((text) => text.includes('Arama: Backend') && !text.includes('Arama: Frontend'))).toBe(
      true,
    );
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sent');
    expect(db.getLedger(OTHER_USER_ID, 'job-1')?.status).toBe('sent');
  });

  it('does not send another user a listing that only matched their own search', async () => {
    const db = new FakeTelegramDb();
    db.addConnection(USER_ID, CHAT_ID);
    db.addConnection(OTHER_USER_ID, OTHER_CHAT_ID);
    const { service, httpPost } = createService({ db, seedConnection: false });

    await service.notifyNewMatches(
      notifyInput({
        searches: [{ id: 'search-a', name: 'Frontend', userId: USER_ID }],
      }),
    );

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(postedChatId(httpPost)).toBe(CHAT_ID);
    expect(postedText(httpPost)).toContain('Arama: Frontend');
    expect(db.getLedger(OTHER_USER_ID, 'job-1')).toBeUndefined();
  });

  it('skips users without a Telegram connection without failing', async () => {
    const { service, httpPost, db } = createService({ seedConnection: false });

    await expect(service.notifyNewMatches(notifyInput())).resolves.toBeUndefined();
    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
    expect(db.ledger.size).toBe(0);
  });

  it('does not send TELEGRAM_CHAT_ID fallback without a mapped user', async () => {
    const { service, httpPost } = createService({
      env: {
        TELEGRAM_BOT_TOKEN: TOKEN,
        TELEGRAM_CHAT_ID: CHAT_ID,
      },
      seedConnection: false,
    });

    await service.notifyNewMatches(notifyInput());
    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
  });

  it('uses TELEGRAM_CHAT_ID only for the mapped legacy user', async () => {
    const { service, httpPost } = createService({
      env: {
        TELEGRAM_BOT_TOKEN: TOKEN,
        TELEGRAM_CHAT_ID: CHAT_ID,
        TELEGRAM_LEGACY_USER_ID: USER_ID,
      },
      seedConnection: false,
    });

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
          { id: 'search-a', name: 'Frontend', userId: USER_ID },
          { id: 'search-b', name: 'Backend', userId: OTHER_USER_ID },
        ],
      }),
    );

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(postedChatId(httpPost)).toBe(CHAT_ID);
    expect(postedText(httpPost)).toContain('Frontend');
    expect(postedText(httpPost)).not.toContain('Backend');
  });

  it('leaves the listing retryable when Telegram returns an error', async () => {
    const { service, httpPost, db } = createService({
      httpPost: vi.fn(async () => failResponse()),
    });

    await expect(service.notifyNewMatches(notifyInput())).resolves.toBeUndefined();
    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('pending');
  });

  it('does not send when two workers race to claim the same listing', async () => {
    const db = new FakeTelegramDb();
    const first = createService({ db });
    await first.service.notifyNewMatches(notifyInput());
    expect(vi.mocked(first.httpPost)).toHaveBeenCalledOnce();

    const second = createService({ db, seedConnection: false });
    await second.service.notifyNewMatches(notifyInput());
    expect(vi.mocked(second.httpPost)).not.toHaveBeenCalled();
  });

  it('lets only one concurrent worker send the same pending listing', async () => {
    const db = new FakeTelegramDb();
    const first = createService({ db });
    const second = createService({ db, seedConnection: false });

    await Promise.all([
      first.service.notifyNewMatches(notifyInput()),
      second.service.notifyNewMatches(notifyInput()),
    ]);

    const sendCount =
      vi.mocked(first.httpPost).mock.calls.length +
      vi.mocked(second.httpPost).mock.calls.length;
    expect(sendCount).toBe(1);
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sent');
  });

  it('retries a failed send on the next discovery run', async () => {
    const httpPost = vi
      .fn()
      .mockResolvedValueOnce(failResponse())
      .mockResolvedValueOnce(okResponse());
    const { service, db } = createService({ httpPost });

    await service.notifyNewMatches(notifyInput());
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('pending');

    await service.notifyNewMatches(notifyInput());
    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sent');
  });

  it('reclaims a listing stuck in sending past the stale window', async () => {
    const db = new FakeTelegramDb();
    const staleAt = new Date(Date.now() - TELEGRAM_CLAIM_STALE_MS - 1_000).toISOString();
    db.ledger.set(db.ledgerKey(USER_ID, 'job-1'), {
      id: 'tg-job-1',
      user_id: USER_ID,
      job_id: 'job-1',
      status: 'sending',
      payload: ledgerPayload(),
      claimed_at: staleAt,
      sent_at: null,
    });
    const { service, httpPost } = createService({ db });

    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sent');
  });

  it('does not steal an in-flight sending claim', async () => {
    const db = new FakeTelegramDb();
    db.ledger.set(db.ledgerKey(USER_ID, 'job-1'), {
      id: 'tg-job-1',
      user_id: USER_ID,
      job_id: 'job-1',
      status: 'sending',
      payload: ledgerPayload(),
      claimed_at: new Date().toISOString(),
      sent_at: null,
    });
    const { service, httpPost } = createService({ db });

    await service.notifyNewMatches(notifyInput());

    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
    expect(db.getLedger(USER_ID, 'job-1')?.status).toBe('sending');
  });

  it('starts with Telegram disabled when env vars are missing', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramNotificationService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => new FakeTelegramDb() },
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
      searches: [{ id: 'search-a', name: 'Frontend', userId: USER_ID }],
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
