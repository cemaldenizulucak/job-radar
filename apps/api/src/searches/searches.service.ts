import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import {
  retryTransientQuery,
  supabaseFailureLogFields,
  type TransientQueryTelemetry,
} from '../infrastructure/supabase/transient-query.js';
import {
  mapSavedSearchRow,
  mapSavedSearchRows,
  SAVED_SEARCH_SELECT,
} from './searches.mapper.js';
import type { SavedSearch, SavedSearchWriteInput } from './searches.types.js';

const EMPTY_LOAD_TELEMETRY: TransientQueryTelemetry = {
  attemptCount: 1,
  recoveredAfterRetry: false,
};

@Injectable()
export class SearchesService {
  private readonly logger = new Logger(SearchesService.name);
  private lastActiveLoadTelemetry: TransientQueryTelemetry = EMPTY_LOAD_TELEMETRY;

  constructor(private readonly supabase: SupabaseService) {}

  consumeActiveLoadTelemetry(): TransientQueryTelemetry {
    const telemetry = this.lastActiveLoadTelemetry;
    this.lastActiveLoadTelemetry = EMPTY_LOAD_TELEMETRY;
    return telemetry;
  }

  async getActiveSearches(): Promise<SavedSearch[]> {
    try {
      const loaded = await retryTransientQuery(async () => {
        const { data, error } = await this.supabase
          .getClient()
          .from('saved_searches')
          .select(SAVED_SEARCH_SELECT)
          .eq('is_active', true);

        if (error) {
          throw error;
        }

        return mapSavedSearchRows(data);
      });
      this.lastActiveLoadTelemetry = {
        attemptCount: loaded.attemptCount,
        recoveredAfterRetry: loaded.recoveredAfterRetry,
      };
      if (loaded.recoveredAfterRetry) {
        this.logger.warn({
          message: 'Loaded saved searches after a transient database error',
          attemptCount: loaded.attemptCount,
          recoveredAfterRetry: true,
        });
      }
      return loaded.value;
    } catch (error) {
      this.lastActiveLoadTelemetry = EMPTY_LOAD_TELEMETRY;
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load saved searches.');
    }
  }

  async listActive(): Promise<SavedSearch[]> {
    return this.getActiveSearches();
  }

  async listActiveByUser(userId: string): Promise<SavedSearch[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select(SAVED_SEARCH_SELECT)
      .eq('is_active', true)
      .eq('user_id', userId);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load saved searches.');
    }

    return mapSavedSearchRows(data);
  }

  async listForUser(userId: string): Promise<SavedSearch[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select(SAVED_SEARCH_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load saved searches.');
    }

    return mapSavedSearchRows(data);
  }

  async getByIdForUser(userId: string, id: string): Promise<SavedSearch> {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .select(SAVED_SEARCH_SELECT)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load saved search.');
    }

    const search = mapSavedSearchRow(data);
    if (!search) {
      throw new NotFoundException('Search not found.');
    }

    return search;
  }

  async createForUser(
    userId: string,
    input: SavedSearchWriteInput,
  ): Promise<SavedSearch> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .insert(toRowPayload(userId, input, now))
      .select(SAVED_SEARCH_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to create saved search.');
    }

    const search = mapSavedSearchRow(data);
    if (!search) {
      throw new InternalServerErrorException('Failed to create saved search.');
    }

    return search;
  }

  async updateForUser(
    userId: string,
    id: string,
    input: SavedSearchWriteInput,
  ): Promise<SavedSearch> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .update({
        ...toRowPayload(userId, input, now),
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SAVED_SEARCH_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update saved search.');
    }

    const search = mapSavedSearchRow(data);
    if (!search) {
      throw new NotFoundException('Search not found.');
    }

    return search;
  }

  async toggleActiveForUser(
    userId: string,
    id: string,
    isActive: boolean,
  ): Promise<SavedSearch> {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SAVED_SEARCH_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update saved search.');
    }

    const search = mapSavedSearchRow(data);
    if (!search) {
      throw new NotFoundException('Search not found.');
    }

    return search;
  }

  async markDiscoveredAt(
    searchIds: readonly string[],
    discoveredAt: Date | string = new Date(),
  ): Promise<void> {
    const uniqueIds = [
      ...new Set(searchIds.filter((id) => id.trim().length > 0)),
    ];
    if (uniqueIds.length === 0) {
      return;
    }

    const iso =
      discoveredAt instanceof Date ? discoveredAt.toISOString() : discoveredAt;

    const { error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .update({ last_discovered_at: iso })
      .in('id', uniqueIds);

    if (error) {
      this.logger.warn({
        message: 'Could not persist last_discovered_at',
        code: error.code,
        details: error.details,
      });
    }
  }

  async deleteForUser(userId: string, id: string): Promise<void> {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to delete saved search.');
    }

    if (!isRecord(data) || typeof data.id !== 'string') {
      throw new NotFoundException('Search not found.');
    }
  }

  private logSupabaseError(error: unknown): void {
    const fields = supabaseFailureLogFields(error);
    this.logger.error({
      message: fields.message,
      code: fields.code,
    });
  }
}

function toRowPayload(
  userId: string,
  input: SavedSearchWriteInput,
  now: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    name: input.name,
    is_active: input.isActive,
    keywords: [...input.keywords],
    technologies: [...input.technologies],
    locations: [...input.locations],
    country_code: input.countryCode,
    country_name: input.countryName,
    subdivision_code: input.subdivisionCode,
    subdivision_name: input.subdivisionName,
    subdivision_codes: [...input.subdivisionCodes],
    subdivision_names: [...input.subdivisionNames],
    work_types: [...input.workTypes],
    experience_levels: [...input.experienceLevels],
    sources: [...input.sources],
    updated_at: now,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
