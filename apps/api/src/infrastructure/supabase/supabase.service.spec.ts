import { inspect } from 'node:util';

import { ConfigService } from '@nestjs/config';

import { SupabaseService } from './supabase.service.js';

function configService(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('SupabaseService', () => {
  it('fails fast when SUPABASE_URL is missing', () => {
    expect(
      () =>
        new SupabaseService(
          configService({
            SUPABASE_SECRET_KEY: 'test-secret',
          }),
        ),
    ).toThrow('Missing required environment variable SUPABASE_URL');
  });

  it('fails fast when SUPABASE_SECRET_KEY is missing', () => {
    expect(
      () =>
        new SupabaseService(
          configService({
            SUPABASE_URL: 'https://example.supabase.co',
          }),
        ),
    ).toThrow('Missing required environment variable SUPABASE_SECRET_KEY');
  });

  it('does not expose the secret key through serialization or inspect', () => {
    const secretKey = 'sb_secret_test_value_must_not_leak';
    const service = new SupabaseService(
      configService({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: secretKey,
      }),
    );

    expect(JSON.stringify(service)).not.toContain(secretKey);
    expect(inspect(service)).not.toContain(secretKey);
    expect(inspect(service)).toBe('SupabaseService');
  });
});
