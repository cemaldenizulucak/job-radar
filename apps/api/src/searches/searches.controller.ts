import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  forwardRef,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import {
  FAILED_DISCOVERY_RESULT,
  SKIPPED_DISCOVERY_RESULT,
  toImmediateDiscoveryResult,
  type ImmediateDiscoveryResult,
} from '../discovery/discovery.types.js';
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
  private readonly logger = new Logger(SearchesController.name);

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
    return { items: items.map((item) => toSavedSearchResponse(item, profile)) };
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
    return toSavedSearchResponse(search, profile);
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

  private async withDiscovery(
    search: SavedSearch,
    shouldRun: boolean,
  ): Promise<SavedSearchWriteResponse> {
    const profile = await this.profilesService.getByUserId(search.userId);

    return {
      search: toSavedSearchResponse(search, profile),
      discovery: shouldRun
        ? await this.runDiscovery(search)
        : SKIPPED_DISCOVERY_RESULT,
    };
  }

  private async runDiscovery(
    search: SavedSearch,
  ): Promise<ImmediateDiscoveryResult> {
    try {
      const summary = await this.discoveryService.runForSavedSearch(search);
      return toImmediateDiscoveryResult(summary);
    } catch (error) {
      this.logger.error({
        message: 'Immediate discovery failed after the search was saved',
        savedSearchId: search.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return FAILED_DISCOVERY_RESULT;
    }
  }
}
