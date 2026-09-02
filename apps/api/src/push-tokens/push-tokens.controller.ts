import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { isRecord } from '../common/request.js';
import { PushTokensService } from './push-tokens.service.js';
import type { UserPushToken } from './push-tokens.types.js';

@Controller('v1/push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<UserPushToken> {
    const parsed = parseTokenBody(body);
    return this.pushTokensService.register({
      userId: user.id,
      expoPushToken: parsed.expoPushToken,
      platform: parsed.platform,
    });
  }

  @Delete()
  async unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const parsed = parseTokenBody(body);
    await this.pushTokensService.unregister({
      userId: user.id,
      expoPushToken: parsed.expoPushToken,
    });
    return { ok: true };
  }
}

function parseTokenBody(body: unknown): {
  expoPushToken: string;
  platform?: string;
} {
  if (!isRecord(body)) {
    throw new BadRequestException('expoPushToken is required.');
  }

  return {
    expoPushToken: requireNonEmptyString(body.expoPushToken, 'expoPushToken'),
    platform:
      body.platform === undefined || body.platform === null
        ? undefined
        : requireNonEmptyString(body.platform, 'platform'),
  };
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required.`);
  }

  return value.trim();
}
