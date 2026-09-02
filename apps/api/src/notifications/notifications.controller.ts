import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { isRecord, requireUserId } from '../common/request.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationRecord } from './notifications.types.js';

@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: NotificationRecord[] }> {
    return this.notificationsService
      .listForUser(user.id)
      .then((items) => ({ items }));
  }

  /**
   * TEMPORARY development endpoint.
   * Disabled unless ENABLE_DEV_ENDPOINTS=true. Do not call from the mobile app.
   * Body still includes userId so local seeding can target a known account.
   */
  @Public()
  @UseGuards(DevEndpointsGuard)
  @Post('test')
  createTest(@Body() body: unknown): Promise<NotificationRecord> {
    return this.notificationsService.createTestNotification(
      readUserIdFromBody(body),
    );
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationRecord> {
    return this.notificationsService.markRead(id, user.id);
  }
}

function readUserIdFromBody(body: unknown): string {
  if (!isRecord(body) || typeof body.userId !== 'string') {
    return requireUserId(undefined);
  }

  return requireUserId(body.userId);
}
