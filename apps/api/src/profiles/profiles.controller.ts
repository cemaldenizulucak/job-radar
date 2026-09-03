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
import { trimLocation } from '../common/search-location.js';
import { ProfilesService } from './profiles.service.js';
import type { ProfileRecord, ProfileUpdateInput } from './profiles.types.js';

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
    return this.profilesService.update(user.id, parseProfileUpdate(body));
  }
}

function parseProfileUpdate(body: unknown): ProfileUpdateInput {
  if (!isRecord(body)) {
    throw new BadRequestException('Profile payload is required.');
  }

  const patch: ProfileUpdateInput = {};

  if ('notificationsEnabled' in body) {
    if (typeof body.notificationsEnabled !== 'boolean') {
      throw new BadRequestException('notificationsEnabled must be a boolean.');
    }

    patch.notificationsEnabled = body.notificationsEnabled;
  }

  if ('country' in body) {
    patch.country = readNullableString(body.country, 'country');
  }

  if ('city' in body) {
    patch.city = readNullableString(body.city, 'city');
  }

  if (
    patch.notificationsEnabled === undefined &&
    patch.country === undefined &&
    patch.city === undefined
  ) {
    throw new BadRequestException(
      'Provide notificationsEnabled, country, or city.',
    );
  }

  return patch;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string or null.`);
  }

  return trimLocation(value);
}
