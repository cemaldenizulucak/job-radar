import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { FavoriteRecord } from './favorites.types.js';

const FAVORITE_SELECT = 'id, user_id, job_id, created_at';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
  ) {}

  async listForUser(userId: string): Promise<FavoriteRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('favorites')
      .select(FAVORITE_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load favorites.');
    }

    const rows = mapFavoriteRows(data);
    if (rows.length === 0) {
      return [];
    }

    const jobs = await this.jobsService.getMappedByIds(
      rows.map((row) => row.jobId),
      userId,
    );
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    return rows.map((row) => ({
      ...row,
      job: jobsById.get(row.jobId) ?? null,
    }));
  }

  async add(userId: string, jobId: string): Promise<FavoriteRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('favorites')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
        },
        { onConflict: 'user_id,job_id' },
      )
      .select(FAVORITE_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to save favorite.');
    }

    const favorite = mapFavoriteRow(data);
    if (!favorite) {
      throw new InternalServerErrorException('Failed to save favorite.');
    }

    const [job] = await this.jobsService.getMappedByIds([jobId]);
    return { ...favorite, job: job ?? null };
  }

  async remove(userId: string, jobId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('job_id', jobId);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to remove favorite.');
    }
  }

  private logSupabaseError(error: SafeSupabaseError): void {
    this.logger.error({
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

function mapFavoriteRows(value: unknown): FavoriteRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: FavoriteRecord[] = [];
  for (const row of value) {
    const mapped = mapFavoriteRow(row);
    if (mapped) {
      rows.push(mapped);
    }
  }

  return rows;
}

function mapFavoriteRow(value: unknown): FavoriteRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const jobId = readString(value, 'job_id');
  const createdAt = readString(value, 'created_at') ?? new Date(0).toISOString();

  if (!id || !userId || !jobId) {
    return null;
  }

  return {
    id,
    userId,
    jobId,
    createdAt,
    job: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
