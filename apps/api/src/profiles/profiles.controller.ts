import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { isRecord } from '../common/request.js';
import { ProfilesService } from './profiles.service.js';
import type { ProfileRecord } from './profiles.types.js';

@Controller('v1/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<ProfileRecord> {
    return this.profilesService.getByUserId(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<ProfileRecord> {
    return this.profilesService.updateNotificationsEnabled(
      user.id,
      readBoolean(body, 'notificationsEnabled'),
    );
  }
}

function readBoolean(body: unknown, field: string): boolean {
  if (!isRecord(body) || typeof body[field] !== 'boolean') {
    throw new BadRequestException(`${field} is required.`);
  }

  return body[field];
}
