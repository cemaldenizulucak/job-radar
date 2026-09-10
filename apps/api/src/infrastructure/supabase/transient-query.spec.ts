import {
  classifySupabaseFailure,
  retryTransientQuery,
  supabaseFailureLogFields,
  transientRetryDelayMs,
} from './transient-query.js';

describe('classifySupabaseFailure', () => {
  it('treats PGRST303 and gateway timeouts as transient', () => {
    expect(classifySupabaseFailure({ code: 'PGRST303', message: 'JWT issued at future' })).toBe(
      'transient',
    );
    expect(classifySupabaseFailure({ message: 'JWT issued at future' })).toBe('transient');
    expect(classifySupabaseFailure({ status: 502, message: 'Bad Gateway' })).toBe('transient');
    expect(classifySupabaseFailure({ status: 503, message: 'unavailable' })).toBe('transient');
    expect(classifySupabaseFailure({ status: 504, message: 'Gateway Timeout' })).toBe(
      'transient',
    );
    expect(classifySupabaseFailure({ code: 'ECONNRESET', message: 'socket hang up' })).toBe(
      'transient',
    );
    expect(classifySupabaseFailure(new TypeError('fetch failed'))).toBe('transient');
  });

  it('does not retry auth, RLS, or missing-column errors', () => {
    expect(classifySupabaseFailure({ code: 'PGRST204', message: 'column missing' })).toBe(
      'permanent',
    );
    expect(
      classifySupabaseFailure({ code: '42501', message: 'permission denied' }),
    ).toBe('permanent');
    expect(
      classifySupabaseFailure({
        message: 'new row violates row-level security policy',
      }),
    ).toBe('permanent');
    expect(classifySupabaseFailure({ status: 401, message: 'Invalid API key' })).toBe(
      'permanent',
    );
    expect(classifySupabaseFailure({ code: 'PGRST301', message: 'JWT expired' })).toBe(
      'permanent',
    );
  });
});

describe('retryTransientQuery', () => {
  it('does not delay when the first attempt succeeds', async () => {
    const sleeps: number[] = [];
    const result = await retryTransientQuery(async () => 'ok', {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
    });

    expect(result).toEqual({
      value: 'ok',
      attemptCount: 1,
      recoveredAfterRetry: false,
    });
    expect(sleeps).toEqual([]);
  });

  it('retries PGRST303 once and then succeeds', async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const result = await retryTransientQuery(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw { code: 'PGRST303', message: 'JWT issued at future' };
        }
        return ['search'];
      },
      {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        random: () => 0.5,
      },
    );

    expect(result).toEqual({
      value: ['search'],
      attemptCount: 2,
      recoveredAfterRetry: true,
    });
    expect(sleeps).toEqual([transientRetryDelayMs(1, 0.5)]);
  });

  it('fails after three transient attempts', async () => {
    let attempts = 0;
    await expect(
      retryTransientQuery(
        async () => {
          attempts += 1;
          throw { code: 'PGRST303', message: 'JWT issued at future' };
        },
        {
          sleep: async () => undefined,
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({ code: 'PGRST303' });
    expect(attempts).toBe(3);
  });

  it('does not retry a missing-column error', async () => {
    let attempts = 0;
    await expect(
      retryTransientQuery(
        async () => {
          attempts += 1;
          throw { code: 'PGRST204', message: 'column does not exist' };
        },
        {
          sleep: async () => undefined,
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({ code: 'PGRST204' });
    expect(attempts).toBe(1);
  });
});

describe('supabaseFailureLogFields', () => {
  it('does not log JWTs or secrets', () => {
    const fields = supabaseFailureLogFields({
      code: 'PGRST303',
      message:
        'JWT issued at future bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb sb_secret=super-secret',
    });

    expect(fields.code).toBe('PGRST303');
    expect(fields.message).not.toContain('eyJ');
    expect(fields.message).not.toContain('super-secret');
    expect(fields.message).toContain('[redacted');
  });
});
