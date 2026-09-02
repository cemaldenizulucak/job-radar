import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required.');
    }

    return user;
  },
);
