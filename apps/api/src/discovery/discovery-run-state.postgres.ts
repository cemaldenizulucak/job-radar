import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import type { SourceId } from '../common/domain.types.js';
import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { DEFAULT_DETAIL_CLAIM_LEASE_MS, clampNonNegativeIndex } from './detail-queue-claim.js';
import {
  DiscoveryRunStateStore,
  nextDetailAttemptAt,
  shouldRetireDetailJob,
  type DetailQueueEnqueueInput,
  type DetailQueueItem,
  type DetailQueueReason,
} from './discovery-run-state.js';
import type { SearchSourceCursor } from './discovery-scan-cursor.js';

@Injectable()
export class PostgresDiscoveryRunStateStore extends DiscoveryRunStateStore {
  private readonly logger = new Logger(PostgresDiscoveryRunStateStore.name);

  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async readQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    fingerprint: string,
  ): Promise<SearchSourceCursor> {
    const { data, error } = await this.supabase
      .getClient()
      .from('discovery_query_cursors')
      .select('fingerprint, next_index')
      .eq('saved_search_id', savedSearchId)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      this.logger.warn({
        message: 'Query cursor read failed; starting at index 0',
        error: error.message,
      });
      return { fingerprint, nextIndex: 0 };
    }

    const row = asRecord(data);
    const storedFingerprint =
      typeof row?.fingerprint === 'string' ? row.fingerprint : '';
    if (!row || storedFingerprint !== fingerprint) {
      return { fingerprint, nextIndex: 0 };
    }

    const nextIndex =
      typeof row.next_index === 'number' && Number.isFinite(row.next_index)
        ? clampNonNegativeIndex(row.next_index)
        : 0;
    return { fingerprint, nextIndex };
  }

  async writeQueryCursor(
    savedSearchId: string,
    sourceId: SourceId,
    cursor: SearchSourceCursor,
    observedNextIndex: number,
  ): Promise<void> {
    const { error } = await this.supabase.getClient().rpc('upsert_discovery_query_cursor', {
      p_saved_search_id: savedSearchId,
      p_source_id: sourceId,
      p_fingerprint: cursor.fingerprint,
      p_next_index: clampNonNegativeIndex(cursor.nextIndex),
      p_observed_next_index: clampNonNegativeIndex(observedNextIndex),
    });

    if (error) {
      this.logger.warn({
        message: 'Query cursor write failed',
        error: error.message,
      });
    }
  }

  async deleteCursorsForSearch(savedSearchId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('discovery_query_cursors')
      .delete()
      .eq('saved_search_id', savedSearchId);

    if (error) {
      this.logger.warn({
        message: 'Query cursor delete failed',
        error: error.message,
      });
    }
  }

  async enqueueDetails(
    items: readonly DetailQueueEnqueueInput[],
  ): Promise<{ queuedCount: number }> {
    let queuedCount = 0;
    const now = new Date().toISOString();

    for (const item of items) {
      const { data: existingRow, error: readError } = await this.supabase
        .getClient()
        .from('job_detail_fetch_queue')
        .select('priority, attempts, next_attempt_at, status, last_error_category')
        .eq('job_id', item.jobId)
        .maybeSingle();

      if (readError && readError.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to enqueue detail fetch.');
      }

      const existing = asRecord(existingRow);
      if (!existing) {
        const { error } = await this.supabase
          .getClient()
          .from('job_detail_fetch_queue')
          .insert(toQueueRow(item, now));
        if (error) {
          throw new InternalServerErrorException('Failed to enqueue detail fetch.');
        }
        queuedCount += 1;
        continue;
      }

      const currentPriority =
        typeof existing.priority === 'number' ? existing.priority : item.priority;
      if (item.priority >= currentPriority) {
        continue;
      }

      const { error } = await this.supabase
        .getClient()
        .from('job_detail_fetch_queue')
        .update({
          priority: item.priority,
          reason: item.reason,
          query_term_kind: item.queryTermKind,
          query_term: item.queryTerm,
          query_location: item.queryLocation,
          source_url: item.sourceUrl,
          status: existing.status,
          updated_at: now,
        })
        .eq('job_id', item.jobId);

      if (error) {
        throw new InternalServerErrorException('Failed to update detail fetch queue.');
      }
    }

    return { queuedCount };
  }

  async listDueDetails(
    sourceId: SourceId,
    nowIso: string,
    limit: number,
  ): Promise<DetailQueueItem[]> {
    const { data, error } = await this.supabase.getClient().rpc('claim_job_detail_fetch', {
      p_source_id: sourceId,
      p_limit: Math.max(0, limit),
      p_now: nowIso,
      p_lease_seconds: Math.round(DEFAULT_DETAIL_CLAIM_LEASE_MS / 1000),
    });

    if (error) {
      throw new InternalServerErrorException('Failed to claim detail fetch queue.');
    }

    return (Array.isArray(data) ? data : [])
      .map(mapQueueRow)
      .filter((item): item is DetailQueueItem => item !== null);
  }

  async completeDetail(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('job_detail_fetch_queue')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      throw new InternalServerErrorException('Failed to complete detail fetch.');
    }
  }

  async failDetail(
    jobId: string,
    errorCategory: string,
    nowIso: string,
  ): Promise<void> {
    const { data, error: readError } = await this.supabase
      .getClient()
      .from('job_detail_fetch_queue')
      .select('attempts, next_attempt_at')
      .eq('job_id', jobId)
      .maybeSingle();

    if (readError) {
      throw new InternalServerErrorException('Failed to update detail fetch attempt.');
    }

    const row = asRecord(data);
    const attempts =
      (typeof row?.attempts === 'number' ? row.attempts : 0) + 1;
    const retired = shouldRetireDetailJob(attempts);
    const { error } = await this.supabase
      .getClient()
      .from('job_detail_fetch_queue')
      .update({
        attempts,
        last_error_category: errorCategory,
        status: retired ? 'failed' : 'pending',
        next_attempt_at: retired
          ? row?.next_attempt_at
          : nextDetailAttemptAt(attempts, Date.parse(nowIso)),
        lease_expires_at: null,
        updated_at: nowIso,
      })
      .eq('job_id', jobId);

    if (error) {
      throw new InternalServerErrorException('Failed to update detail fetch attempt.');
    }
  }

  async listQueueItems(): Promise<DetailQueueItem[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('job_detail_fetch_queue')
      .select(
        'job_id, source_id, source_job_id, source_url, priority, reason, query_term_kind, query_term, query_location, attempts, next_attempt_at, status, last_error_category, lease_expires_at',
      );

    if (error) {
      throw new InternalServerErrorException('Failed to list detail fetch queue.');
    }

    return (Array.isArray(data) ? data : [])
      .map(mapQueueRow)
      .filter((item): item is DetailQueueItem => item !== null);
  }
}

function toQueueRow(item: DetailQueueEnqueueInput, now: string): Record<string, unknown> {
  return {
    job_id: item.jobId,
    source_id: item.sourceId,
    source_job_id: item.sourceJobId,
    source_url: item.sourceUrl,
    priority: item.priority,
    reason: item.reason,
    query_term_kind: item.queryTermKind,
    query_term: item.queryTerm,
    query_location: item.queryLocation,
    attempts: 0,
    next_attempt_at: now,
    status: 'pending',
    lease_expires_at: null,
    created_at: now,
    updated_at: now,
  };
}

function mapQueueRow(value: unknown): DetailQueueItem | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }

  const jobId = typeof row.job_id === 'string' ? row.job_id : null;
  const sourceId = row.source_id === 'kariyer_net' || row.source_id === 'linkedin'
    ? row.source_id
    : null;
  const sourceJobId = typeof row.source_job_id === 'string' ? row.source_job_id : null;
  const sourceUrl = typeof row.source_url === 'string' ? row.source_url : null;
  if (!jobId || !sourceId || !sourceJobId || !sourceUrl) {
    return null;
  }

  return {
    jobId,
    sourceId,
    sourceJobId,
    sourceUrl,
    priority: typeof row.priority === 'number' ? row.priority : 3,
    reason: asReason(row.reason),
    queryTermKind:
      row.query_term_kind === 'user' || row.query_term_kind === 'profession_variant'
        ? row.query_term_kind
        : null,
    queryTerm: typeof row.query_term === 'string' ? row.query_term : null,
    queryLocation: typeof row.query_location === 'string' ? row.query_location : null,
    attempts: typeof row.attempts === 'number' ? row.attempts : 0,
    nextAttemptAt:
      typeof row.next_attempt_at === 'string'
        ? row.next_attempt_at
        : new Date(0).toISOString(),
    status:
      row.status === 'in_progress' || row.status === 'failed' ? row.status : 'pending',
    lastErrorCategory:
      typeof row.last_error_category === 'string' ? row.last_error_category : null,
    leaseExpiresAt:
      typeof row.lease_expires_at === 'string' ? row.lease_expires_at : null,
  };
}

function asReason(value: unknown): DetailQueueReason {
  if (
    value === 'profession_variant' ||
    value === 'user_query' ||
    value === 'catalog_empty' ||
    value === 'backfill'
  ) {
    return value;
  }
  return 'catalog_empty';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
