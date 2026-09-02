import { randomUUID } from 'node:crypto';

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import type { DuplicateGroup } from './duplicates.types.js';

type SafeSupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

@Injectable()
export class DuplicateGroupsService {
  private readonly logger = new Logger(DuplicateGroupsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async saveGroups(groups: readonly DuplicateGroup[]): Promise<number> {
    let created = 0;

    for (const group of groups) {
      const existingGroupId = await this.findExistingGroupId(group.memberIds);

      if (existingGroupId) {
        await this.addMissingMembers(existingGroupId, group.memberIds);
        continue;
      }

      const groupId = await this.insertGroup();
      await this.addMissingMembers(groupId, group.memberIds);
      created += 1;
    }

    return created;
  }

  private async findExistingGroupId(
    memberIds: readonly string[],
  ): Promise<string | null> {
    if (memberIds.length === 0) {
      return null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select('id, duplicate_group_id')
      .in('id', [...memberIds]);

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException(
        'Failed to load duplicate group members.',
      );
    }

    if (!Array.isArray(data)) {
      return null;
    }

    for (const row of data) {
      if (!isRecord(row)) {
        continue;
      }

      const groupId = row.duplicate_group_id;
      if (typeof groupId === 'string' && groupId.length > 0) {
        return groupId;
      }
    }

    return null;
  }

  private async insertGroup(): Promise<string> {
    const id = randomUUID();
    const { error } = await this.supabase
      .getClient()
      .from('duplicate_groups')
      .insert({ id });

    if (error) {
      this.logSupabaseError(error);
      throw new InternalServerErrorException('Failed to create duplicate group.');
    }

    return id;
  }

  private async addMissingMembers(
    groupId: string,
    memberIds: readonly string[],
  ): Promise<void> {
    for (const jobId of memberIds) {
      const alreadyMember = await this.hasMember(jobId);
      if (alreadyMember) {
        continue;
      }

      const { error } = await this.supabase
        .getClient()
        .from('jobs')
        .update({ duplicate_group_id: groupId })
        .eq('id', jobId);

      if (error) {
        this.logSupabaseError(error);
        throw new InternalServerErrorException(
          'Failed to store duplicate group member.',
        );
      }
    }
  }

  private async hasMember(jobId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('jobs')
      .select('duplicate_group_id')
      .eq('id', jobId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      this.logSupabaseError(error);
      throw new InternalServerErrorException(
        'Failed to look up duplicate group member.',
      );
    }

    if (!isRecord(data)) {
      return false;
    }

    return (
      typeof data.duplicate_group_id === 'string' &&
      data.duplicate_group_id.length > 0
    );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
