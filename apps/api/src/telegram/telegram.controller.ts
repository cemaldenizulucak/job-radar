import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { TelegramLinkService } from './telegram-link.service.js';
import { TelegramWebhookService } from './telegram-webhook.service.js';
import type {
  TelegramLinkCodeResponse,
  TelegramStatusResponse,
} from './telegram.types.js';

@Controller('v1/telegram')
export class TelegramController {
  constructor(
    private readonly linkService: TelegramLinkService,
    private readonly webhookService: TelegramWebhookService,
  ) {}

  @Post('link-code')
  @HttpCode(201)
  createLinkCode(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TelegramLinkCodeResponse> {
    return this.linkService.createLinkCode(user.id);
  }

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser): Promise<TelegramStatusResponse> {
    return this.linkService.getStatus(user.id);
  }

  @Delete('connection')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.linkService.disconnect(user.id);
    return { ok: true };
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    return this.webhookService.handleWebhook(normalizeHeader(secret), body);
  }
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
