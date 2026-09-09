export type FakeLinkCodeRow = {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type FakeConnectionRow = {
  id: string;
  user_id: string;
  telegram_chat_id: string;
  telegram_user_id: string | null;
  telegram_username: string | null;
  connected_at: string;
  updated_at: string;
};

export class FakeTelegramStore {
  readonly connections = new Map<string, FakeConnectionRow>();
  readonly linkCodes = new Map<string, FakeLinkCodeRow>();
  readonly processedUpdates = new Set<number>();
  readonly rawCodes = undefined;

  addConnection(input: {
    userId: string;
    chatId: string;
    username?: string | null;
    telegramUserId?: string | null;
  }): void {
    const now = new Date().toISOString();
    this.connections.set(input.userId, {
      id: `conn-${input.userId}`,
      user_id: input.userId,
      telegram_chat_id: input.chatId,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.username ?? null,
      connected_at: now,
      updated_at: now,
    });
  }

  addCode(input: {
    userId: string;
    codeHash: string;
    expiresAt: string;
    consumedAt?: string | null;
  }): FakeLinkCodeRow {
    const row: FakeLinkCodeRow = {
      id: `code-${this.linkCodes.size + 1}`,
      user_id: input.userId,
      code_hash: input.codeHash,
      expires_at: input.expiresAt,
      consumed_at: input.consumedAt ?? null,
      created_at: new Date().toISOString(),
    };
    this.linkCodes.set(row.id, row);
    return row;
  }

  from(table: string) {
    if (table === 'user_telegram_connections') {
      return this.connectionQuery();
    }
    if (table === 'telegram_link_codes') {
      return this.codeQuery();
    }
    if (table === 'telegram_processed_updates') {
      return this.updateQuery();
    }
    throw new Error(`unexpected table ${table}`);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    if (name !== 'link_telegram_account') {
      throw new Error(`unexpected rpc ${name}`);
    }
    return this.linkAccount(args);
  }

  private async linkAccount(args: Record<string, unknown>) {
    const hash = String(args.p_code_hash ?? '');
    const chatId = String(args.p_telegram_chat_id ?? '');
    const now = new Date();
    const code = [...this.linkCodes.values()].find((row) => row.code_hash === hash);
    if (
      !code ||
      code.consumed_at !== null ||
      new Date(code.expires_at).getTime() <= now.getTime()
    ) {
      return { data: { ok: false, reason: 'invalid_or_expired' }, error: null };
    }

    const taken = [...this.connections.values()].find(
      (row) => row.telegram_chat_id === chatId && row.user_id !== code.user_id,
    );
    if (taken) {
      return { data: { ok: false, reason: 'chat_linked_to_other_user' }, error: null };
    }

    await Promise.resolve();

    if (code.consumed_at !== null) {
      return { data: { ok: false, reason: 'invalid_or_expired' }, error: null };
    }
    code.consumed_at = now.toISOString();

    this.addConnection({
      userId: code.user_id,
      chatId,
      telegramUserId: String(args.p_telegram_user_id ?? '') || null,
      username: String(args.p_telegram_username ?? '') || null,
    });

    return { data: { ok: true, user_id: code.user_id }, error: null };
  }

  private connectionQuery() {
    return tableQuery({
      rows: () => [...this.connections.values()],
      onInsert: () => {
        throw new Error('use rpc for insert');
      },
      onUpdate: () => [...this.connections.values()],
      onDelete: (matched) => {
        for (const row of matched as FakeConnectionRow[]) {
          this.connections.delete(row.user_id);
        }
      },
    });
  }

  private codeQuery() {
    return tableQuery({
      rows: () => [...this.linkCodes.values()],
      onInsert: (values) => {
        const active = [...this.linkCodes.values()].some(
          (row) => row.user_id === values.user_id && row.consumed_at === null,
        );
        if (active) {
          return {
            error: { code: '23505', message: 'duplicate key' },
          };
        }
        this.addCode({
          userId: String(values.user_id),
          codeHash: String(values.code_hash),
          expiresAt: String(values.expires_at),
        });
        return { error: null };
      },
      onUpdate: (matched, patch) => {
        for (const row of matched as FakeLinkCodeRow[]) {
          if (Object.prototype.hasOwnProperty.call(patch, 'consumed_at')) {
            row.consumed_at = (patch.consumed_at as string | null) ?? null;
          }
        }
        return matched;
      },
    });
  }

  private updateQuery() {
    return tableQuery({
      rows: () =>
        [...this.processedUpdates].map((update_id) => ({ update_id })),
      onInsert: (values) => {
        const updateId = Number(values.update_id);
        if (this.processedUpdates.has(updateId)) {
          return {
            error: { code: '23505', message: 'duplicate key' },
          };
        }
        this.processedUpdates.add(updateId);
        return { error: null };
      },
    });
  }
}

function tableQuery(options: {
  rows: () => Record<string, unknown>[];
  onInsert?: (
    values: Record<string, unknown>,
  ) => { error: { code: string; message: string } | null };
  onUpdate?: (
    matched: Record<string, unknown>[],
    patch: Record<string, unknown>,
  ) => Record<string, unknown>[];
  onDelete?: (matched: Record<string, unknown>[]) => void;
}) {
  let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let insertValues: Record<string, unknown> = {};
  let patch: Record<string, unknown> = {};
  const filters: { op: 'eq' | 'in' | 'is'; col: string; val: unknown }[] = [];

  const matchedRows = () =>
    options.rows().filter((row) =>
      filters.every((filter) => {
        const actual = row[filter.col];
        if (filter.op === 'in') {
          return Array.isArray(filter.val) && filter.val.includes(actual);
        }
        if (filter.op === 'is') {
          return actual === filter.val;
        }
        return actual === filter.val;
      }),
    );

  const run = async (single: boolean) => {
    if (action === 'insert') {
      const result = options.onInsert?.(insertValues) ?? { error: null };
      return { data: null, error: result.error };
    }

    const matched = matchedRows();
    if (action === 'update') {
      const updated = options.onUpdate?.(matched, patch) ?? matched;
      return { data: single ? (updated[0] ?? null) : updated, error: null };
    }
    if (action === 'delete') {
      options.onDelete?.(matched);
      return { data: single ? (matched[0] ?? null) : matched, error: null };
    }
    return { data: single ? (matched[0] ?? null) : matched, error: null };
  };

  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
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
  chain.delete = () => {
    action = 'delete';
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    filters.push({ op: 'eq', col, val });
    return chain;
  };
  chain.in = (col: string, val: unknown) => {
    filters.push({ op: 'in', col, val });
    return chain;
  };
  chain.is = (col: string, val: unknown) => {
    filters.push({ op: 'is', col, val });
    return chain;
  };
  chain.maybeSingle = () => run(true);
  chain.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => run(false).then(resolve, reject);
  return chain;
}
