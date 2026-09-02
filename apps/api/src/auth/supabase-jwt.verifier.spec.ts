import { createHmac } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import {
  readBearerToken,
  SupabaseJwtVerifier,
  verifyHs256AccessToken,
} from './supabase-jwt.verifier.js';

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('readBearerToken', () => {
  it('reads a Bearer access token', () => {
    expect(readBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null when the header is missing or malformed', () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken('Basic abc')).toBeNull();
    expect(readBearerToken('Bearer ')).toBeNull();
  });
});

describe('verifyHs256AccessToken', () => {
  const secret = 'test-jwt-secret';

  it('returns the subject when the signature is valid', () => {
    const token = signHs256(
      { sub: 'user-1', email: 'ada@example.com', exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    );

    expect(verifyHs256AccessToken(token, secret)).toEqual({
      id: 'user-1',
      email: 'ada@example.com',
    });
  });

  it('rejects expired tokens and bad signatures', () => {
    const expired = signHs256(
      { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 10 },
      secret,
    );
    const tampered = `${signHs256({ sub: 'user-1' }, secret)}x`;

    expect(verifyHs256AccessToken(expired, secret)).toBeNull();
    expect(verifyHs256AccessToken(tampered, secret)).toBeNull();
    expect(verifyHs256AccessToken(signHs256({ sub: 'user-1' }, secret), 'other')).toBeNull();
  });
});

describe('SupabaseJwtVerifier', () => {
  it('uses the Auth API when no JWT secret is configured', async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: 'user-1', email: 'ada@example.com' } },
      error: null,
    }));
    const verifier = new SupabaseJwtVerifier(
      { getClient: () => ({ auth: { getUser } }) } as unknown as SupabaseService,
      { get: () => undefined } as unknown as ConfigService,
    );

    await expect(verifier.verifyAccessToken('access-token')).resolves.toEqual({
      id: 'user-1',
      email: 'ada@example.com',
    });
    expect(getUser).toHaveBeenCalledWith('access-token');
  });

  it('rejects invalid Auth API responses', async () => {
    const verifier = new SupabaseJwtVerifier(
      {
        getClient: () => ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: { message: 'bad' } }),
          },
        }),
      } as unknown as SupabaseService,
      { get: () => undefined } as unknown as ConfigService,
    );

    await expect(verifier.verifyAccessToken('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
