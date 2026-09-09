import { inspect } from 'node:util';

import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { hashTelegramLinkCode } from './telegram-code.js';
import { MemoryRateLimiter } from './telegram-rate-limit.js';
import { FakeTelegramStore } from './telegram-store.fake.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';
import type { TelegramHttpPost } from './telegram-http.js';

const TOKEN = '123456:WEBHOOK-BOT-TOKEN';
const SECRET = 'webhook-secret-value';
const CODE = 'JR-1234567890';
const USER_A = 'user-a';
const USER_B = 'user-b';
const CHAT_A = '70001';
const CHAT_B = '70002';

function config(values: Record<string, string | undefined> = {
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_WEBHOOK_SECRET: SECRET,
}): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function privateText(updateId: number, chatId: string, text: string) {
  return {
    update_id: updateId,
    message: {
      message_id: 1,
      text,
      chat: { id: Number(chatId), type: 'private' },
      from: { id: Number(chatId), username: 'ada_lovelace' },
    },
  };
}

function createService(options: {
  store?: FakeTelegramStore;
  env?: Record<string, string | undefined>;
  httpPost?: TelegramHttpPost;
} = {}) {
  const store = options.store ?? new FakeTelegramStore();
  const httpPost =
    options.httpPost ??
    (vi.fn(async () => okResponse()) as unknown as TelegramHttpPost);
  const service = new TelegramWebhookService(
    config(options.env),
    { getClient: () => store } as unknown as SupabaseService,
    new MemoryRateLimiter(),
    httpPost,
  );
  return { service, store, httpPost };
}

function postedText(httpPost: TelegramHttpPost, index = 0): string {
  const body = JSON.parse(String(vi.mocked(httpPost).mock.calls[index]?.[1]?.body)) as {
    text?: string;
  };
  return body.text ?? '';
}

describe('TelegramWebhookService', () => {
  it('rejects a missing or wrong webhook secret with 401', async () => {
    const { service } = createService();

    await expect(service.handleWebhook(undefined, { update_id: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.handleWebhook('nope', { update_id: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('links a valid private /link code', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service, httpPost } = createService({ store });

    await expect(
      service.handleWebhook(SECRET, privateText(11, CHAT_A, `/link ${CODE}`)),
    ).resolves.toEqual({ ok: true });

    expect(store.connections.get(USER_A)?.telegram_chat_id).toBe(CHAT_A);
    expect(postedText(httpPost)).toContain('JobRadar hesabın Telegram’a bağlandı');
  });

  it('rejects expired, used, and malformed codes without leaking internals', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, httpPost } = createService({ store });

    await service.handleWebhook(SECRET, privateText(21, CHAT_A, `/link ${CODE}`));
    await service.handleWebhook(SECRET, privateText(22, CHAT_A, '/link JR-0000000000'));
    await service.handleWebhook(SECRET, privateText(23, CHAT_A, '/link not-a-code'));

    expect(store.connections.size).toBe(0);
    expect(postedText(httpPost, 0)).toBe('Bağlantı kodu geçersiz veya süresi dolmuş.');
    expect(postedText(httpPost, 1)).toBe('Bağlantı kodu geçersiz veya süresi dolmuş.');
    expect(postedText(httpPost, 2)).toBe('Bağlantı kodu geçersiz veya süresi dolmuş.');

    const dumped = `${JSON.stringify(warn.mock.calls)}\n${JSON.stringify(error.mock.calls)}`;
    expect(dumped).not.toContain(CODE);
    expect(dumped).not.toContain(hashTelegramLinkCode(CODE));
    expect(dumped).not.toContain(TOKEN);
    expect(dumped).not.toContain(SECRET);
    expect(dumped).not.toContain(CHAT_A);
    warn.mockRestore();
    error.mockRestore();
  });

  it('lets two JobRadar users bind two different Telegram chats', async () => {
    const otherCode = 'JR-0987654321';
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    store.addCode({
      userId: USER_B,
      codeHash: hashTelegramLinkCode(otherCode),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service } = createService({ store });

    await service.handleWebhook(SECRET, privateText(101, CHAT_A, `/link ${CODE}`));
    await service.handleWebhook(SECRET, privateText(102, CHAT_B, `/link ${otherCode}`));

    expect(store.connections.get(USER_A)?.telegram_chat_id).toBe(CHAT_A);
    expect(store.connections.get(USER_B)?.telegram_chat_id).toBe(CHAT_B);
  });

  it('does not attach the same Telegram chat to a second JobRadar user', async () => {
    const store = new FakeTelegramStore();
    store.addConnection({ userId: USER_A, chatId: CHAT_A });
    store.addCode({
      userId: USER_B,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service, httpPost } = createService({ store });

    await service.handleWebhook(SECRET, privateText(31, CHAT_A, `/link ${CODE}`));

    expect(store.connections.get(USER_A)?.telegram_chat_id).toBe(CHAT_A);
    expect(store.connections.has(USER_B)).toBe(false);
    expect(postedText(httpPost)).toContain('başka bir JobRadar hesabına bağlı');
  });

  it('ignores a repeated update_id', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service, httpPost } = createService({ store });
    const update = privateText(41, CHAT_A, `/link ${CODE}`);

    await service.handleWebhook(SECRET, update);
    await service.handleWebhook(SECRET, update);

    expect(vi.mocked(httpPost)).toHaveBeenCalledOnce();
    expect(store.connections.size).toBe(1);
  });

  it('rejects group messages', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service, httpPost } = createService({ store });

    await service.handleWebhook(SECRET, {
      update_id: 51,
      message: {
        text: `/link ${CODE}`,
        chat: { id: 9001, type: 'group' },
        from: { id: 1 },
      },
    });

    expect(store.connections.size).toBe(0);
    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
  });

  it('ignores media messages', async () => {
    const { service, httpPost } = createService();

    await service.handleWebhook(SECRET, {
      update_id: 61,
      message: {
        photo: [{ file_id: 'x' }],
        chat: { id: 1, type: 'private' },
        caption: `/link ${CODE}`,
      },
    });

    expect(vi.mocked(httpPost)).not.toHaveBeenCalled();
  });

  it('answers /start and /help in Turkish', async () => {
    const { service, httpPost } = createService();

    await service.handleWebhook(SECRET, privateText(71, CHAT_A, '/start'));
    await service.handleWebhook(SECRET, privateText(72, CHAT_A, '/help'));

    expect(postedText(httpPost, 0)).toContain('JobRadar bildirim botu');
    expect(postedText(httpPost, 1)).toContain('/link');
  });

  it('consumes a code only once when two updates race', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service } = createService({ store });

    await Promise.all([
      service.handleWebhook(SECRET, privateText(81, CHAT_A, `/link ${CODE}`)),
      service.handleWebhook(SECRET, privateText(82, CHAT_B, `/link ${CODE}`)),
    ]);

    const consumed = [...store.linkCodes.values()].filter((row) => row.consumed_at);
    expect(consumed).toHaveLength(1);
    expect(store.connections.size).toBe(1);
  });

  it('rejects a code that was already consumed', async () => {
    const store = new FakeTelegramStore();
    store.addCode({
      userId: USER_A,
      codeHash: hashTelegramLinkCode(CODE),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const { service, httpPost } = createService({ store });

    await service.handleWebhook(SECRET, privateText(91, CHAT_A, `/link ${CODE}`));
    await service.handleWebhook(SECRET, privateText(92, CHAT_B, `/link ${CODE}`));

    expect(store.connections.size).toBe(1);
    expect(postedText(httpPost, 1)).toBe('Bağlantı kodu geçersiz veya süresi dolmuş.');
  });

  it('starts without telegram env and still rejects webhooks', async () => {
    const { service } = createService({
      env: {},
    });

    expect(inspect(service)).toBe('TelegramWebhookService');
    await expect(service.handleWebhook('x', { update_id: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
