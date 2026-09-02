import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  isApplicationStatus,
  type ApplicationStatus,
} from '../common/domain.types.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import type { ApplicationRecord } from './applications.types.js';

const APPLICATION_SELECT = 'id, user_id, job_id, status, created_at, updated_at';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
  ) {}

  async listForUser(
    userId: string,
    status?: ApplicationStatus,
  ): Promise<ApplicationRecord[]> {
    let request = this.supabase
      .getClient()
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (status) {
      request = request.eq('status', status);
    }

    const { data, error } = await request;

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to load applications.');
    }

    return this.attachJobs(mapApplicationRows(data));
  }

  async upsert(
    userId: string,
    jobId: string,
    status: ApplicationStatus,
  ): Promise<ApplicationRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('applications')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          status,
          updated_at: now,
        },
        { onConflict: 'user_id,job_id' },
      )
      .select(APPLICATION_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to save application.');
    }

    return this.requireMapped(data);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: ApplicationStatus,
  ): Promise<ApplicationRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('applications')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(APPLICATION_SELECT)
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to update application.');
    }

    if (!data) {
      throw new NotFoundException('Application not found.');
    }

    return this.requireMapped(data);
  }

  async remove(id: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .getClient()
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to delete application.');
    }

    if (!data) {
      throw new NotFoundException('Application not found.');
    }
  }

  private async requireMapped(value: unknown): Promise<ApplicationRecord> {
    const row = mapApplicationRow(value);
    if (!row) {
      throw new InternalServerErrorException('Failed to save application.');
    }

    const [mapped] = await this.attachJobs([row]);
    if (!mapped) {
      throw new InternalServerErrorException('Failed to save application.');
    }

    return mapped;
  }

  private async attachJobs(
    rows: ApplicationRecord[],
  ): Promise<ApplicationRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const jobs = await this.jobsService.getMappedByIds(
      rows.map((row) => row.jobId),
      rows[0]?.userId,
    );
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    return rows.map((row) => {
      const job = jobsById.get(row.jobId);
      if (!job) {
        return row;
      }

      return {
        ...row,
        title: job.title,
        companyName: job.companyName,
        sourceId: job.sourceId,
        canonicalUrl: job.canonicalUrl,
      };
    });
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

export function parseApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string' || !isApplicationStatus(value)) {
    throw new BadRequestException('A valid application status is required.');
  }

  return value;
}

function mapApplicationRows(value: unknown): ApplicationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: ApplicationRecord[] = [];
  for (const row of value) {
    const mapped = mapApplicationRow(row);
    if (mapped) {
      rows.push(mapped);
    }
  }

  return rows;
}

function mapApplicationRow(value: unknown): ApplicationRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const userId = readString(value, 'user_id');
  const jobId = readString(value, 'job_id');
  const statusRaw = readString(value, 'status');
  const createdAt = readString(value, 'created_at') ?? new Date(0).toISOString();
  const updatedAt = readString(value, 'updated_at') ?? createdAt;

  if (!id || !userId || !jobId || !statusRaw || !isApplicationStatus(statusRaw)) {
    return null;
  }

  return {
    id,
    userId,
    jobId,
    status: statusRaw,
    createdAt,
    updatedAt,
    title: '',
    companyName: '',
    sourceId: 'linkedin',
    canonicalUrl: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
