import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { readRequiredString } from '../common/request.js';
import { FavoritesService } from './favorites.service.js';
import type { FavoriteRecord } from './favorites.types.js';

@Controller('v1/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: FavoriteRecord[] }> {
    return this.favoritesService
      .listForUser(user.id)
      .then((items) => ({ items }));
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<FavoriteRecord> {
    return this.favoritesService.add(user.id, readRequiredString(body, 'jobId'));
  }

  @Delete(':jobId')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ): Promise<{ ok: true }> {
    await this.favoritesService.remove(user.id, jobId);
    return { ok: true };
  }
}
