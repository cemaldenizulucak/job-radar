import { inspect } from 'node:util';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = readRequired(configService, 'SUPABASE_URL');
    const secretKey = readRequired(configService, 'SUPABASE_SECRET_KEY');

    this.client = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  toJSON(): { name: string } {
    return { name: 'SupabaseService' };
  }

  [inspect.custom](): string {
    return 'SupabaseService';
  }
}

function readRequired(
  configService: ConfigService,
  name: 'SUPABASE_URL' | 'SUPABASE_SECRET_KEY',
): string {
  const value = configService.get<string>(name);

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value.trim();
}
