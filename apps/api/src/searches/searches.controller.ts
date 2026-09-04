import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  forwardRef,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import { SKIPPED_DISCOVERY_RESULT } from '../discovery/discovery.types.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { shouldTriggerSavedSearchDiscovery } from './search-discovery.js';
import { SearchesService } from './searches.service.js';
import type {
  SavedSearch,
  SavedSearchResponse,
  SavedSearchWriteResponse,
} from './searches.types.js';
import {
  parseSavedSearchWrite,
  parseToggleActive,
  toSavedSearchResponse,
} from './searches.write.js';

@Controller('v1/searches')
export class SearchesController {
  constructor(
    private readonly searchesService: SearchesService,
    @Inject(forwardRef(() => DiscoveryService))
    private readonly discoveryService: DiscoveryService,
    private readonly profilesService: ProfilesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: SavedSearchResponse[] }> {
    const [items, profile] = await Promise.all([
      this.searchesService.listForUser(user.id),
      this.profilesService.getByUserId(user.id),
    ]);
    return {
      items: items.map((item) =>
        this.toSearchResponse(item, profile),
      ),
    };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<SavedSearchWriteResponse> {
    const created = await this.searchesService.createForUser(
      user.id,
      parseSavedSearchWrite(body),
    );
    return this.withDiscovery(
      created,
      shouldTriggerSavedSearchDiscovery(null, created),
    );
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SavedSearchResponse> {
    const [search, profile] = await Promise.all([
      this.searchesService.getByIdForUser(user.id, id),
      this.profilesService.getByUserId(user.id),
    ]);
    return this.toSearchResponse(search, profile);
  }

  @Patch(':id/toggle')
  async toggle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SavedSearchWriteResponse> {
    const previous = await this.searchesService.getByIdForUser(user.id, id);
    const updated = await this.searchesService.toggleActiveForUser(
      user.id,
      id,
      parseToggleActive(body),
    );
    return this.withDiscovery(
      updated,
      shouldTriggerSavedSearchDiscovery(previous, updated),
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SavedSearchWriteResponse> {
    const previous = await this.searchesService.getByIdForUser(user.id, id);
    const updated = await this.searchesService.updateForUser(
      user.id,
      id,
      parseSavedSearchWrite(body),
    );
    return this.withDiscovery(
      updated,
      shouldTriggerSavedSearchDiscovery(previous, updated),
    );
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.searchesService.deleteForUser(user.id, id);
    return { ok: true };
  }

  private toSearchResponse(
    search: SavedSearch,
    profile: Awaited<ReturnType<ProfilesService['getByUserId']>>,
  ): SavedSearchResponse {
    return toSavedSearchResponse(search, profile, {
      discovery: this.discoveryService.getImmediateRun(search.id),
    });
  }

  private async withDiscovery(
    search: SavedSearch,
    shouldRun: boolean,
  ): Promise<SavedSearchWriteResponse> {
    const profile = await this.profilesService.getByUserId(search.userId);
    const discovery = shouldRun
      ? this.discoveryService.enqueueForSavedSearch(search)
      : SKIPPED_DISCOVERY_RESULT;

    return {
      search: toSavedSearchResponse(search, profile, { discovery }),
      discovery,
    };
  }
}
