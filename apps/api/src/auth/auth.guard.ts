import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { readBearerToken, SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: SupabaseJwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Authentication required.');
    }

    request.user = await this.jwtVerifier.verifyAccessToken(token);
    return true;
  }
}
