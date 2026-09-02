import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type { AuthenticatedUser } from './auth.types.js';

@Injectable()
export class SupabaseJwtVerifier {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET')?.trim();
    if (secret) {
      const localUser = verifyHs256AccessToken(token, secret);
      if (localUser) {
        return localUser;
      }
    }

    return this.verifyViaSupabaseAuth(token);
  }

  private async verifyViaSupabaseAuth(
    token: string,
  ): Promise<AuthenticatedUser> {
    const { data, error } = await this.supabase
      .getClient()
      .auth.getUser(token);

    if (error || !data.user?.id) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? null,
    };
  }
}

export function readBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export function verifyHs256AccessToken(
  token: string,
  secret: string,
): AuthenticatedUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return null;
  }

  const header = parseJsonRecord(decodeBase64Url(headerB64));
  if (!header || header.alg !== 'HS256') {
    return null;
  }

  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signatureB64, 'base64url');
  } catch {
    return null;
  }

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  const payload = parseJsonRecord(decodeBase64Url(payloadB64));
  if (!payload) {
    return null;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return null;
  }

  const id = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!id) {
    return null;
  }

  return {
    id,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
