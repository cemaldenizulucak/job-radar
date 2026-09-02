import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module.js';
import { AuthGuard } from './auth.guard.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

@Module({
  imports: [SupabaseModule],
  providers: [
    SupabaseJwtVerifier,
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [SupabaseJwtVerifier, AuthGuard],
})
export class AuthModule {}
