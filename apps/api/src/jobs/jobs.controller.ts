import { Controller, Get, Param, Patch, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SourceId } from '../common/domain.types.js';
import { parseMatchStatusFilter } from '../matching/match-status.js';
import { parseBooleanFlag } from '../scheduler/scheduler-config.service.js';
import { parseJobFeedLimit } from './job-feed-visibility.js';
import { JobsService } from './jobs.service.js';
import type { JobDetail, JobListResult, JobTabs } from './jobs.types.js';

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('tabs')
  getTabs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('matchedOnly') matchedOnly?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<JobTabs> {
    return this.jobsService.getTabs(
      user.id,
      parseMatchedOnly(matchedOnly),
      parseBooleanFlag(includeInactive, false),
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sourceId') sourceId?: string,
    @Query('savedSearchId') savedSearchId?: string,
    @Query('matchStatus') matchStatus?: string,
    @Query('cursor') cursor?: string,
    @Query('matchedOnly') matchedOnly?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('limit') limit?: string,
  ): Promise<JobListResult> {
    return this.jobsService.listForUser({
      userId: user.id,
      sourceId: parseSourceFilter(sourceId),
      savedSearchId: parseSavedSearchId(savedSearchId),
      matchStatus: parseMatchStatusFilter(matchStatus),
      cursor,
      matchedOnly: parseMatchedOnly(matchedOnly),
      includeInactive: parseBooleanFlag(includeInactive, false),
      limit: parseJobFeedLimit(limit),
    });
  }

  @Patch(':id/seen')
  markSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<JobDetail> {
    return this.jobsService.markSeenForUser(user.id, id);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<JobDetail> {
    return this.jobsService.getByIdForUserOrThrow(user.id, id);
  }
}

function parseSavedSearchId(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === 'all') {
    return undefined;
  }

  return trimmed;
}

function parseSourceFilter(
  sourceId: string | undefined,
): SourceId | 'all' | undefined {
  if (sourceId === 'linkedin' || sourceId === 'kariyer_net' || sourceId === 'all') {
    return sourceId;
  }

  return undefined;
}

function parseMatchedOnly(value: string | undefined): boolean {
  return parseBooleanFlag(value, false);
}
